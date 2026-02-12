use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::Auction;
use crate::errors::ChumError;

#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct PlaceBid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,

    #[account(
        mut,
        seeds = [b"auction", epoch.to_le_bytes().as_ref()],
        bump = auction.bump,
        constraint = !auction.settled @ ChumError::AuctionSettled,
    )]
    pub auction: Account<'info, Auction>,

    /// CHECK: Treasury PDA
    #[account(
        mut,
        seeds = [b"treasury"],
        bump,
    )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Previous bidder to refund (if bid_count > 0)
    #[account(mut)]
    pub previous_bidder: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PlaceBid>, _epoch: u64, bid_amount: u64) -> Result<()> {
    let clock = Clock::get()?;
    let auction = &mut ctx.accounts.auction;

    require!(clock.unix_timestamp < auction.end_time, ChumError::AuctionNotEnded);

    // min_bid = current_bid * 101 / 100
    let min_bid = (auction.current_bid as u128)
        .checked_mul(101)
        .ok_or(ChumError::MathOverflow)?
        .checked_div(100)
        .ok_or(ChumError::MathOverflow)? as u64;

    require!(bid_amount >= min_bid, ChumError::BidTooLow);

    // Transfer bid to treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.bidder.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        bid_amount,
    )?;

    // Refund previous bidder
    if auction.bid_count > 0 {
        require!(
            ctx.accounts.previous_bidder.key() == auction.current_bidder,
            ChumError::WrongPreviousBidder,
        );

        let refund = auction.current_bid;
        let treasury = &ctx.accounts.treasury;
        **treasury.to_account_info().try_borrow_mut_lamports()? -= refund;
        **ctx.accounts.previous_bidder.to_account_info().try_borrow_mut_lamports()? += refund;
    }

    // Anti-snipe: extend if < 300s remaining
    let remaining_time = auction.end_time
        .checked_sub(clock.unix_timestamp)
        .ok_or(ChumError::MathOverflow)?;
    if remaining_time < 300 {
        auction.end_time = clock.unix_timestamp
            .checked_add(300)
            .ok_or(ChumError::MathOverflow)?;
    }

    auction.current_bid = bid_amount;
    auction.current_bidder = ctx.accounts.bidder.key();
    auction.bid_count = auction.bid_count
        .checked_add(1)
        .ok_or(ChumError::MathOverflow)?;

    Ok(())
}
