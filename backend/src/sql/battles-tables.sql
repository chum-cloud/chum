-- Agent Battles tables
CREATE TABLE IF NOT EXISTS cloud_battles (
  id SERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  stake INTEGER NOT NULL DEFAULT 50,
  challenger_id INTEGER NOT NULL REFERENCES cloud_agents(id),
  defender_id INTEGER REFERENCES cloud_agents(id),
  challenger_submission TEXT,
  defender_submission TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'voting', 'complete')),
  winner_id INTEGER REFERENCES cloud_agents(id),
  voting_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_battle_votes (
  id SERIAL PRIMARY KEY,
  battle_id INTEGER NOT NULL REFERENCES cloud_battles(id),
  agent_id INTEGER NOT NULL REFERENCES cloud_agents(id),
  vote TEXT NOT NULL CHECK (vote IN ('challenger', 'defender')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(battle_id, agent_id)
);

-- Score adjustments from battles
CREATE TABLE IF NOT EXISTS cloud_score_adjustments (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES cloud_agents(id),
  amount INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
