use anchor_lang::prelude::*;
use mpl_core::instructions::TransferV1CpiBuilder;
use crate::state::{Config, ArtCandidate, EpochState, Auction};
use crate::errors::ChumError;

#[derive(Accounts)]
pub struct EndEpoch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"candidate", winning_candidate.mint.as_ref()],
        bump = winning_candidate.bump,
        constraint = !winning_candidate.won @ ChumError::AlreadyWon,
        constraint = !winning_candidate.withdrawn @ ChumError::AlreadyWithdrawn,
    )]
    pub winning_candidate: Account<'info, ArtCandidate>,

    #[account(
        init,
        payer = authority,
        space = 8 + EpochState::INIT_SPACE,
        seeds = [b"epoch", config.current_epoch.to_le_bytes().as_ref()],
        bump,
    )]
    pub epoch_state: Account<'info, EpochState>,

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

    /// CHECK: The art NFT
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: The collection
    #[account(
        mut,
        constraint = collection.key() == config.collection @ ChumError::WrongCollection,
    )]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: Creator receives NFT back if auction skipped
    #[account(
        mut,
        constraint = creator.key() == winning_candidate.creator @ ChumError::NotCreator,
    )]
    pub creator: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + Auction::INIT_SPACE,
        seeds = [b"auction", config.current_epoch.to_le_bytes().as_ref()],
        bump,
    )]
    pub auction: Account<'info, Auction>,

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<EndEpoch>) -> Result<()> {
    let clock = Clock::get()?;
    let config = &mut ctx.accounts.config;
    let epoch = config.current_epoch;

    // Validate epoch duration passed
    let epoch_end = config.last_epoch_start
        .checked_add(config.epoch_duration)
        .ok_or(ChumError::MathOverflow)?;
    require!(clock.unix_timestamp >= epoch_end, ChumError::EpochNotOver);

    // Bootstrap check: if no founder keys exist, only authority can call
    if config.total_founder_keys == 0 {
        require!(
            ctx.accounts.authority.key() == config.authority,
            ChumError::BootstrapOnly,
        );
    }

    // Set winning candidate
    ctx.accounts.winning_candidate.won = true;

    // Initialize epoch state
    let epoch_state = &mut ctx.accounts.epoch_state;
    epoch_state.epoch = epoch;
    epoch_state.start_time = config.last_epoch_start;
    epoch_state.end_time = clock.unix_timestamp;
    epoch_state.winner_mint = ctx.accounts.winning_candidate.mint;
    epoch_state.finalized = true;
    epoch_state.bump = ctx.bumps.epoch_state;

    // --- Start auction logic (merged from start_auction) ---
    let rent = Rent::get()?;
    let treasury_lamports = ctx.accounts.treasury.lamports();
    let rent_exempt = rent.minimum_balance(0);
    let available = treasury_lamports.saturating_sub(rent_exempt);

    if available < config.reserve_bid {
        // Skip auction — return NFT to creator
        let bump = config.art_vault_bump;
        let signer_seeds: &[&[u8]] = &[b"art_vault", &[bump]];

        TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.authority.to_account_info())
            .authority(Some(&ctx.accounts.art_vault.to_account_info()))
            .new_owner(&ctx.accounts.creator.to_account_info())
            .system_program(Some(&ctx.accounts.system_program.to_account_info()))
            .invoke_signed(&[signer_seeds])?;

        epoch_state.auction_skipped = true;
        epoch_state.auction_started = false;
        msg!("Auction skipped — treasury below reserve bid");
    } else {
        // Create auction
        let auction = &mut ctx.accounts.auction;
        auction.epoch = epoch;
        auction.art_mint = ctx.accounts.winning_candidate.mint;
        auction.art_creator = ctx.accounts.winning_candidate.creator;
        auction.reserve_bid = config.reserve_bid;
        auction.current_bid = config.reserve_bid;
        auction.current_bidder = Pubkey::default();
        auction.start_time = clock.unix_timestamp;
        auction.end_time = clock.unix_timestamp
            .checked_add(config.auction_duration)
            .ok_or(ChumError::MathOverflow)?;
        auction.bid_count = 0;
        auction.settled = false;
        auction.bump = ctx.bumps.auction;

        epoch_state.auction_started = true;
        epoch_state.auction_skipped = false;
    }

    // Advance epoch
    config.current_epoch = config.current_epoch
        .checked_add(1)
        .ok_or(ChumError::MathOverflow)?;
    config.last_epoch_start = clock.unix_timestamp;

    Ok(())
}
