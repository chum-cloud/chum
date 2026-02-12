use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub team_wallet: Pubkey,
    pub collection: Pubkey,
    pub fellow_villains_collection: Pubkey,
    pub mint_fee: u64,
    pub join_fee: u64,
    pub base_vote_price: u64,
    pub current_epoch: u64,
    pub epoch_duration: i64,
    pub auction_duration: i64,
    pub reserve_bid: u64,
    pub total_minted: u64,
    pub total_founder_keys: u64,
    pub last_epoch_start: i64,
    pub paused: bool,
    pub treasury_bump: u8,
    pub art_vault_bump: u8,
    pub collection_authority_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ArtCandidate {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub votes: u32,
    pub epoch_joined: u64,
    pub won: bool,
    pub withdrawn: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ArtEntry {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub is_founder_key: bool,
    pub epoch_won: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VoteReceipt {
    pub mint: Pubkey,
    pub epoch: u64,
    pub voter: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EpochState {
    pub epoch: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub winner_mint: Pubkey,
    pub finalized: bool,
    pub auction_started: bool,
    pub auction_skipped: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Auction {
    pub epoch: u64,
    pub art_mint: Pubkey,
    pub art_creator: Pubkey,
    pub reserve_bid: u64,
    pub current_bid: u64,
    pub current_bidder: Pubkey,
    pub start_time: i64,
    pub end_time: i64,
    pub bid_count: u32,
    pub settled: bool,
    pub bump: u8,
}
