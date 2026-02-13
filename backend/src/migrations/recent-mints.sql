-- Recent Mints: real-time feed for the MINT page
-- Run this in Supabase SQL Editor
-- Supabase Realtime must be enabled on this table

CREATE TABLE IF NOT EXISTS recent_mints (
  id SERIAL PRIMARY KEY,
  asset_address TEXT NOT NULL,
  name TEXT NOT NULL,
  mp4_url TEXT NOT NULL,
  png_url TEXT NOT NULL,
  creator_wallet TEXT NOT NULL,
  is_agent BOOLEAN NOT NULL DEFAULT false,
  fee BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast recent queries
CREATE INDEX IF NOT EXISTS idx_recent_mints_created_at ON recent_mints (created_at DESC);

ALTER TABLE recent_mints ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can see the feed)
CREATE POLICY "Public read access" ON recent_mints
  FOR SELECT USING (true);

-- Service role write access
CREATE POLICY "Service role insert" ON recent_mints
  FOR INSERT WITH CHECK (true);

-- Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE recent_mints;
