-- Run this AFTER battles-tables.sql
-- Adds missing columns and rewards table

ALTER TABLE cloud_battles ADD COLUMN IF NOT EXISTS token_reward INTEGER NOT NULL DEFAULT 500;
ALTER TABLE cloud_battles ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS cloud_agent_rewards (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES cloud_agents(id),
  amount INTEGER NOT NULL,
  reason TEXT,
  battle_id INTEGER REFERENCES cloud_battles(id),
  claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
