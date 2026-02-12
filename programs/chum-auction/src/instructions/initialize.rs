use anchor_lang::prelude::*;
use crate::state::Config;
use crate::errors::ChumError;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,

    /// CHECK: Treasury PDA, just storing the bump
    #[account(
        seeds = [b"treasury"],
        bump,
    )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Art vault PDA, just storing the bump
    #[account(
        seeds = [b"art_vault"],
        bump,
    )]
    pub art_vault: UncheckedAccount<'info>,

    /// CHECK: Collection authority PDA, just storing the bump
    #[account(
        seeds = [b"collection_auth"],
        bump,
    )]
    pub collection_authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    team_wallet: Pubkey,
    collection: Pubkey,
    fellow_villains_collection: Pubkey,
    mint_fee: u64,
    join_fee: u64,
    base_vote_price: u64,
    epoch_duration: i64,
    auction_duration: i64,
    reserve_bid: u64,
) -> Result<()> {
    require!(mint_fee > 0, ChumError::InvalidFee);
    require!(join_fee > 0, ChumError::InvalidFee);
    require!(base_vote_price > 0, ChumError::InvalidFee);
    require!(epoch_duration > 0, ChumError::InvalidDuration);
    require!(auction_duration > 0, ChumError::InvalidDuration);
    require!(reserve_bid > 0, ChumError::InvalidReserveBid);

    let clock = Clock::get()?;
    let config = &mut ctx.accounts.config;

    config.authority = ctx.accounts.authority.key();
    config.team_wallet = team_wallet;
    config.collection = collection;
    config.fellow_villains_collection = fellow_villains_collection;
    config.mint_fee = mint_fee;
    config.join_fee = join_fee;
    config.base_vote_price = base_vote_price;
    config.current_epoch = 1;
    config.epoch_duration = epoch_duration;
    config.auction_duration = auction_duration;
    config.reserve_bid = reserve_bid;
    config.total_minted = 0;
    config.total_founder_keys = 0;
    config.last_epoch_start = clock.unix_timestamp;
    config.paused = false;
    config.treasury_bump = ctx.bumps.treasury;
    config.art_vault_bump = ctx.bumps.art_vault;
    config.collection_authority_bump = ctx.bumps.collection_authority;

    Ok(())
}
