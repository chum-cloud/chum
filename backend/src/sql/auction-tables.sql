-- CHUM Art Auction Tables
-- Run against Supabase SQL editor

-- Epochs
CREATE TABLE auction_epochs (
  id SERIAL PRIMARY KEY,
  epoch_number INTEGER NOT NULL UNIQUE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 86400,
  winner_mint TEXT,
  winner_creator TEXT,
  finalized BOOLEAN DEFAULT FALSE,
  auction_started BOOLEAN DEFAULT FALSE,
  auction_skipped BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Art candidates (joined the leaderboard)
CREATE TABLE art_candidates (
  id SERIAL PRIMARY KEY,
  mint_address TEXT NOT NULL UNIQUE,
  creator_wallet TEXT NOT NULL,
  name TEXT NOT NULL,
  uri TEXT NOT NULL,
  image_url TEXT,
  animation_url TEXT,
  epoch_joined INTEGER NOT NULL,
  votes INTEGER DEFAULT 0,
  won BOOLEAN DEFAULT FALSE,
  withdrawn BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vote records
CREATE TABLE art_votes (
  id SERIAL PRIMARY KEY,
  voter_wallet TEXT NOT NULL,
  candidate_mint TEXT NOT NULL REFERENCES art_candidates(mint_address),
  epoch_number INTEGER NOT NULL,
  num_votes INTEGER NOT NULL DEFAULT 1,
  is_paid BOOLEAN DEFAULT FALSE,
  cost_lamports BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one free vote per wallet per epoch per candidate
CREATE UNIQUE INDEX idx_free_vote_unique
  ON art_votes(voter_wallet, candidate_mint, epoch_number)
  WHERE is_paid = FALSE;

-- Auctions
CREATE TABLE art_auctions (
  id SERIAL PRIMARY KEY,
  epoch_number INTEGER NOT NULL UNIQUE,
  art_mint TEXT NOT NULL,
  art_creator TEXT NOT NULL,
  reserve_bid BIGINT NOT NULL DEFAULT 200000000,
  current_bid BIGINT DEFAULT 0,
  current_bidder TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ NOT NULL,
  bid_count INTEGER DEFAULT 0,
  settled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bid history
CREATE TABLE art_bids (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL REFERENCES art_auctions(id),
  bidder_wallet TEXT NOT NULL,
  bid_amount BIGINT NOT NULL,
  refunded BOOLEAN DEFAULT FALSE,
  refund_tx TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Art entries (founder keys)
CREATE TABLE art_entries (
  id SERIAL PRIMARY KEY,
  mint_address TEXT NOT NULL UNIQUE,
  creator_wallet TEXT NOT NULL,
  owner_wallet TEXT NOT NULL,
  is_founder_key BOOLEAN DEFAULT TRUE,
  epoch_won INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Config (singleton row)
CREATE TABLE auction_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_epoch INTEGER DEFAULT 1,
  mint_fee BIGINT DEFAULT 15000000,
  join_fee BIGINT DEFAULT 15000000,
  base_vote_price BIGINT DEFAULT 2000000,
  epoch_duration INTEGER DEFAULT 86400,
  auction_duration INTEGER DEFAULT 14400,
  reserve_bid BIGINT DEFAULT 200000000,
  paused BOOLEAN DEFAULT FALSE,
  vault_wallet TEXT NOT NULL,
  team_wallet TEXT NOT NULL,
  treasury_wallet TEXT NOT NULL,
  collection_address TEXT NOT NULL,
  fellow_villains_collection TEXT,
  total_minted INTEGER DEFAULT 0,
  total_founder_keys INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_art_candidates_epoch ON art_candidates(epoch_joined);
CREATE INDEX idx_art_candidates_votes ON art_candidates(votes DESC);
CREATE INDEX idx_art_votes_epoch ON art_votes(epoch_number);
CREATE INDEX idx_art_votes_candidate ON art_votes(candidate_mint);
CREATE INDEX idx_art_bids_auction ON art_bids(auction_id);
CREATE INDEX idx_art_auctions_epoch ON art_auctions(epoch_number);

-- RLS policies (enable RLS but allow service role full access)
ALTER TABLE auction_epochs ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE art_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_config ENABLE ROW LEVEL SECURITY;

-- Read-only for anon
CREATE POLICY "anon_read_epochs" ON auction_epochs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_candidates" ON art_candidates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_votes" ON art_votes FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_auctions" ON art_auctions FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_bids" ON art_bids FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_entries" ON art_entries FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_config" ON auction_config FOR SELECT TO anon USING (true);

-- Service role full access
CREATE POLICY "service_all_epochs" ON auction_epochs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_candidates" ON art_candidates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_votes" ON art_votes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_auctions" ON art_auctions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_bids" ON art_bids FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_entries" ON art_entries FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_config" ON auction_config FOR ALL TO service_role USING (true) WITH CHECK (true);
