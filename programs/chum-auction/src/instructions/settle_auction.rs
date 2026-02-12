use anchor_lang::prelude::*;
use mpl_core::instructions::{TransferV1CpiBuilder, UpdatePluginV1CpiBuilder};
use mpl_core::types::{Plugin, Attribute};
use crate::state::{Config, ArtCandidate, Auction, ArtEntry};
use crate::errors::ChumError;

#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct SettleAuction<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"auction", epoch.to_le_bytes().as_ref()],
        bump = auction.bump,
        constraint = !auction.settled @ ChumError::AuctionSettled,
    )]
    pub auction: Account<'info, Auction>,

    #[account(
        mut,
        seeds = [b"candidate", auction.art_mint.as_ref()],
        bump = candidate.bump,
    )]
    pub candidate: Account<'info, ArtCandidate>,

    /// CHECK: Treasury PDA
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = config.treasury_bump,
    )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Art vault PDA
    #[account(
        mut,
        seeds = [b"art_vault"],
        bump = config.art_vault_bump,
    )]
    pub art_vault: UncheckedAccount<'info>,

    /// CHECK: Collection authority PDA
    #[account(
        seeds = [b"collection_auth"],
        bump = config.collection_authority_bump,
    )]
    pub collection_authority: UncheckedAccount<'info>,

    /// CHECK: The art NFT
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: The collection
    #[account(
        mut,
        constraint = collection.key() == config.collection @ ChumError::WrongCollection,
    )]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: Auction winner receives NFT
    #[account(mut)]
    pub winner: UncheckedAccount<'info>,

    /// CHECK: Art creator receives 60%
    #[account(
        mut,
        constraint = creator.key() == auction.art_creator @ ChumError::NotCreator,
    )]
    pub creator: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + ArtEntry::INIT_SPACE,
        seeds = [b"art", auction.art_mint.as_ref()],
        bump,
    )]
    pub art_entry: Account<'info, ArtEntry>,

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SettleAuction>, _epoch: u64) -> Result<()> {
    let clock = Clock::get()?;
    let auction = &mut ctx.accounts.auction;

    require!(clock.unix_timestamp >= auction.end_time, ChumError::AuctionNotEnded);

    let config = &mut ctx.accounts.config;
    let vault_bump = config.art_vault_bump;
    let vault_seeds: &[&[u8]] = &[b"art_vault", &[vault_bump]];
    let auth_bump = config.collection_authority_bump;
    let auth_seeds: &[&[u8]] = &[b"collection_auth", &[auth_bump]];

    if auction.bid_count > 0 {
        // Transfer NFT to winner
        require!(
            ctx.accounts.winner.key() == auction.current_bidder,
            ChumError::NotOwner,
        );

        TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.payer.to_account_info())
            .authority(Some(&ctx.accounts.art_vault.to_account_info()))
            .new_owner(&ctx.accounts.winner.to_account_info())
            .system_program(Some(&ctx.accounts.system_program.to_account_info()))
            .invoke_signed(&[vault_seeds])?;

        // Pay creator 60%
        let creator_share = (auction.current_bid as u128)
            .checked_mul(60)
            .ok_or(ChumError::MathOverflow)?
            .checked_div(100)
            .ok_or(ChumError::MathOverflow)? as u64;

        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? -= creator_share;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += creator_share;

        // Upgrade Status to "Founder Key" via UpdatePluginV1
        UpdatePluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.payer.to_account_info())
            .authority(Some(&ctx.accounts.collection_authority.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .plugin(Plugin::Attributes(mpl_core::types::Attributes {
                attribute_list: vec![
                    Attribute {
                        key: "Status".to_string(),
                        value: "Founder Key".to_string(),
                    },
                ],
            }))
            .invoke_signed(&[auth_seeds])?;

        // Create ArtEntry
        let art_entry = &mut ctx.accounts.art_entry;
        art_entry.mint = auction.art_mint;
        art_entry.creator = auction.art_creator;
        art_entry.is_founder_key = true;
        art_entry.epoch_won = auction.epoch;
        art_entry.bump = ctx.bumps.art_entry;

        config.total_founder_keys = config.total_founder_keys
            .checked_add(1)
            .ok_or(ChumError::MathOverflow)?;
    } else {
        // No bids — return NFT to creator
        TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.payer.to_account_info())
            .authority(Some(&ctx.accounts.art_vault.to_account_info()))
            .new_owner(&ctx.accounts.creator.to_account_info())
            .system_program(Some(&ctx.accounts.system_program.to_account_info()))
            .invoke_signed(&[vault_seeds])?;

        msg!("No bidders. Art returned to creator.");
    }

    auction.settled = true;

    Ok(())
}
