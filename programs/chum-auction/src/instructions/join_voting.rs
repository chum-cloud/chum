use anchor_lang::prelude::*;
use anchor_lang::system_program;
use mpl_core::instructions::TransferV1CpiBuilder;
use crate::state::{Config, ArtCandidate};
use crate::errors::ChumError;

#[derive(Accounts)]
pub struct JoinVoting<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump,
        constraint = !config.paused @ ChumError::SystemPaused,
    )]
    pub config: Account<'info, Config>,

    /// CHECK: Treasury PDA receives join fee
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = config.treasury_bump,
    )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Art vault PDA holds NFTs during voting
    #[account(
        mut,
        seeds = [b"art_vault"],
        bump = config.art_vault_bump,
    )]
    pub art_vault: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + ArtCandidate::INIT_SPACE,
        seeds = [b"candidate", asset.key().as_ref()],
        bump,
    )]
    pub candidate: Account<'info, ArtCandidate>,

    /// CHECK: The art NFT to transfer into vault (Metaplex Core asset)
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: The collection account for the NFT
    #[account(
        mut,
        constraint = collection.key() == config.collection @ ChumError::WrongCollection,
    )]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinVoting>) -> Result<()> {
    let config = &ctx.accounts.config;

    // Transfer join_fee to treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        config.join_fee,
    )?;

    // CPI to Metaplex Core TransferV1: NFT from creator to art_vault
    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(Some(&ctx.accounts.collection.to_account_info()))
        .payer(&ctx.accounts.creator.to_account_info())
        .authority(Some(&ctx.accounts.creator.to_account_info()))
        .new_owner(&ctx.accounts.art_vault.to_account_info())
        .system_program(Some(&ctx.accounts.system_program.to_account_info()))
        .invoke()?;

    // Initialize candidate
    let candidate = &mut ctx.accounts.candidate;
    candidate.mint = ctx.accounts.asset.key();
    candidate.creator = ctx.accounts.creator.key();
    candidate.votes = 0;
    candidate.epoch_joined = config.current_epoch;
    candidate.won = false;
    candidate.withdrawn = false;
    candidate.bump = ctx.bumps.candidate;

    Ok(())
}
