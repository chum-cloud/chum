use anchor_lang::prelude::*;

#[error_code]
pub enum ChumError {
    #[msg("System is paused")]
    SystemPaused,
    #[msg("Fee must be greater than 0")]
    InvalidFee,
    #[msg("Duration must be greater than 0")]
    InvalidDuration,
    #[msg("Reserve bid must be greater than 0")]
    InvalidReserveBid,
    #[msg("Not the owner of this NFT")]
    NotOwner,
    #[msg("Not the creator of this art")]
    NotCreator,
    #[msg("Candidate already won")]
    AlreadyWon,
    #[msg("Art already withdrawn")]
    AlreadyWithdrawn,
    #[msg("Cannot withdraw winning art")]
    CannotWithdrawWinner,
    #[msg("NFT not from recognized collection")]
    WrongCollection,
    #[msg("NFT is not a Founder Key")]
    NotFounderKey,
    #[msg("This NFT already voted this epoch")]
    AlreadyVotedThisEpoch,
    #[msg("Vote count must be greater than 0")]
    InvalidVoteCount,
    #[msg("Insufficient SOL for paid votes")]
    InsufficientPayment,
    #[msg("Epoch duration not passed yet")]
    EpochNotOver,
    #[msg("Epoch not finalized")]
    EpochNotFinalized,
    #[msg("Auction already started")]
    AuctionAlreadyStarted,
    #[msg("Auction was skipped")]
    AuctionSkipped,
    #[msg("Treasury below reserve bid")]
    InsufficientTreasury,
    #[msg("Auction already settled")]
    AuctionSettled,
    #[msg("Auction still active")]
    AuctionNotEnded,
    #[msg("Bid must be at least 1% above current")]
    BidTooLow,
    #[msg("Wrong previous bidder account")]
    WrongPreviousBidder,
    #[msg("Not the authority")]
    Unauthorized,
    #[msg("Only authority can end epoch during bootstrap")]
    BootstrapOnly,
    #[msg("Name exceeds 50 characters")]
    NameTooLong,
    #[msg("URI exceeds 200 characters")]
    UriTooLong,
    #[msg("Math overflow")]
    MathOverflow,
}
