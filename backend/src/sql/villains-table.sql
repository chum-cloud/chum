-- Fellow Villains NFT Table
-- Run this manually in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS villains (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  metadata_url TEXT NOT NULL,
  traits JSONB NOT NULL,
  donation_amount NUMERIC NOT NULL DEFAULT 0.05,
  mint_signature TEXT,
  is_minted BOOLEAN DEFAULT FALSE,
  rarity_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_villains_wallet ON villains(wallet_address);
CREATE INDEX idx_villains_created ON villains(created_at DESC);
CREATE INDEX idx_villains_rarity ON villains(rarity_score DESC);

-- Enable Row Level Security
ALTER TABLE villains ENABLE ROW LEVEL SECURITY;

-- Allow public read access for gallery
CREATE POLICY "Allow public read access" ON villains FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON villains FOR ALL USING (auth.role() = 'service_role');