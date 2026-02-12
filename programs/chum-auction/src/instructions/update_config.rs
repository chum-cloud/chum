use anchor_lang::prelude::*;
use crate::state::Config;
use crate::errors::ChumError;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump,
        constraint = config.authority == authority.key() @ ChumError::Unauthorized,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(
    ctx: Context<UpdateConfig>,
    mint_fee: Option<u64>,
    join_fee: Option<u64>,
    base_vote_price: Option<u64>,
    epoch_duration: Option<i64>,
    auction_duration: Option<i64>,
    reserve_bid: Option<u64>,
    paused: Option<bool>,
    team_wallet: Option<Pubkey>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(v) = mint_fee {
        require!(v > 0, ChumError::InvalidFee);
        config.mint_fee = v;
    }
    if let Some(v) = join_fee {
        require!(v > 0, ChumError::InvalidFee);
        config.join_fee = v;
    }
    if let Some(v) = base_vote_price {
        require!(v > 0, ChumError::InvalidFee);
        config.base_vote_price = v;
    }
    if let Some(v) = epoch_duration {
        require!(v > 0, ChumError::InvalidDuration);
        config.epoch_duration = v;
    }
    if let Some(v) = auction_duration {
        require!(v > 0, ChumError::InvalidDuration);
        config.auction_duration = v;
    }
    if let Some(v) = reserve_bid {
        require!(v > 0, ChumError::InvalidReserveBid);
        config.reserve_bid = v;
    }
    if let Some(v) = paused {
        config.paused = v;
    }
    if let Some(v) = team_wallet {
        config.team_wallet = v;
    }

    Ok(())
}
