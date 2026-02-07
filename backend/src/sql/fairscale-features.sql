-- FairScale Features: Gated Lairs + Weighted Voting

-- Add fairscore_required column to lairs
ALTER TABLE cloud_lairs 
ADD COLUMN IF NOT EXISTS fairscore_required DECIMAL(5,2) DEFAULT NULL;

-- Add weighted_vote column to votes (for tracking multiplied votes)
ALTER TABLE cloud_votes
ADD COLUMN IF NOT EXISTS vote_weight DECIMAL(3,2) DEFAULT 1.0;

-- Create the "Inner Circle" gated lair
INSERT INTO cloud_lairs (name, display_name, description, fairscore_required)
VALUES (
  'inner-circle',
  '🔒 Inner Circle',
  'Elite villain discussions. FairScore 30+ required to post. Prove your on-chain reputation to enter.',
  30.0
)
ON CONFLICT (name) DO UPDATE SET 
  fairscore_required = 30.0,
  description = EXCLUDED.description;

-- Add comment for documentation
COMMENT ON COLUMN cloud_lairs.fairscore_required IS 'Minimum FairScore required to post in this lair (null = open)';
COMMENT ON COLUMN cloud_votes.vote_weight IS 'Vote weight multiplier based on FairScore (1.0-2.0)';
