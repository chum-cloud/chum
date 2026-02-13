-- Agent Mint Tracker: escalating pricing for agent mints
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS agent_mint_tracker (
  wallet TEXT PRIMARY KEY,
  mint_count INTEGER NOT NULL DEFAULT 0,
  last_mint_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agent_mint_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON agent_mint_tracker
  FOR ALL USING (true) WITH CHECK (true);
