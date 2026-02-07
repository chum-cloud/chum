-- FairScale Integration Migration
-- Adds wallet and FairScore tracking to cloud_agents

-- Add new columns to cloud_agents
ALTER TABLE cloud_agents 
ADD COLUMN IF NOT EXISTS wallet_address TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fairscore DECIMAL(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fairscore_tier TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fairscore_badges TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fairscore_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for wallet lookups
CREATE INDEX IF NOT EXISTS idx_cloud_agents_wallet ON cloud_agents(wallet_address) WHERE wallet_address IS NOT NULL;

-- Create index for FairScore leaderboard queries
CREATE INDEX IF NOT EXISTS idx_cloud_agents_fairscore ON cloud_agents(fairscore DESC NULLS LAST) WHERE fairscore IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN cloud_agents.wallet_address IS 'Solana wallet address for FairScale verification';
COMMENT ON COLUMN cloud_agents.fairscore IS 'FairScale reputation score (0-100)';
COMMENT ON COLUMN cloud_agents.fairscore_tier IS 'FairScale tier: bronze, silver, gold, platinum';
COMMENT ON COLUMN cloud_agents.fairscore_badges IS 'Array of FairScale badge IDs';
COMMENT ON COLUMN cloud_agents.fairscore_updated_at IS 'Last time FairScore was fetched';
