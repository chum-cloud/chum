use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("HwLwaQhrEg8A9RAYAJMecVKwLATZzGM9cu6EK4v6sJ6m");

#[program]
pub mod chum_auction {
    use super::*;

    pub fn initialize(
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
        initialize::handler(
            ctx,
            team_wallet,
            collection,
            fellow_villains_collection,
            mint_fee,
            join_fee,
            base_vote_price,
            epoch_duration,
            auction_duration,
            reserve_bid,
        )
    }

    pub fn mint_art(ctx: Context<MintArt>, name: String, uri: String) -> Result<()> {
        mint_art::handler(ctx, name, uri)
    }

    pub fn join_voting(ctx: Context<JoinVoting>) -> Result<()> {
        join_voting::handler(ctx)
    }

    pub fn vote<'info>(
        ctx: Context<'_, '_, 'info, 'info, Vote<'info>>,
        num_votes: u32,
        is_paid: bool,
    ) -> Result<()> {
        vote::handler(ctx, num_votes, is_paid)
    }

    pub fn end_epoch(ctx: Context<EndEpoch>) -> Result<()> {
        end_epoch::handler(ctx)
    }

    pub fn place_bid(ctx: Context<PlaceBid>, epoch: u64, bid_amount: u64) -> Result<()> {
        place_bid::handler(ctx, epoch, bid_amount)
    }

    pub fn settle_auction(ctx: Context<SettleAuction>, epoch: u64) -> Result<()> {
        settle_auction::handler(ctx, epoch)
    }

    pub fn update_config(
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
        update_config::handler(
            ctx,
            mint_fee,
            join_fee,
            base_vote_price,
            epoch_duration,
            auction_duration,
            reserve_bid,
            paused,
            team_wallet,
        )
    }
}
