-- Schemes (proposals from agents)
CREATE TABLE IF NOT EXISTS schemes (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL, -- 'chum', 'karen', 'spy', 'recruiter'
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'tweet', 'cloud_post', 'trade', 'recruit', 'analyze', 'scheme'
  status TEXT NOT NULL DEFAULT 'proposed', -- proposed, approved, rejected, executing, completed, failed
  karen_review TEXT, -- Karen's sarcastic verdict
  priority INTEGER DEFAULT 3, -- 1-5
  context JSONB DEFAULT '{}', -- additional context/data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Missions (approved schemes broken into steps)
CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  scheme_id INTEGER REFERENCES schemes(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  assigned_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Mission Steps (individual executable tasks)
CREATE TABLE IF NOT EXISTS mission_steps (
  id SERIAL PRIMARY KEY,
  mission_id INTEGER REFERENCES missions(id),
  agent_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'draft_tweet', 'post_cloud', 'analyze', 'scout_price', 'scout_mentions', 'recruit', 'review', 'celebrate'
  status TEXT NOT NULL DEFAULT 'queued', -- queued, running, completed, failed
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  step_order INTEGER DEFAULT 0,
  reserved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Events (everything that happens, for trigger matching)
CREATE TABLE IF NOT EXISTS agent_events (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'scheme_proposed', 'scheme_approved', 'tweet_posted', 'donation_received', etc.
  data JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_agent_events_type ON agent_events(event_type);
CREATE INDEX idx_agent_events_created ON agent_events(created_at DESC);
CREATE INDEX idx_agent_events_tags ON agent_events USING GIN(tags);

-- Agent Memory (per-agent persistent memory)
CREATE TABLE IF NOT EXISTS agent_memory (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  importance INTEGER DEFAULT 3, -- 1-5
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(agent_id, key)
);

-- Trigger Rules
CREATE TABLE IF NOT EXISTS trigger_rules (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  condition JSONB NOT NULL, -- { "event_type": "price_change", "threshold": -10 }
  action_template JSONB NOT NULL, -- scheme template to propose
  target_agent TEXT DEFAULT 'chum',
  cooldown_minutes INTEGER DEFAULT 60,
  last_fired_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Policies (runtime config)
CREATE TABLE IF NOT EXISTS agent_policies (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_schemes_status ON schemes(status);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_mission_steps_status ON mission_steps(status);
CREATE INDEX idx_agent_memory_agent ON agent_memory(agent_id);

-- Disable RLS for backend service access
ALTER TABLE schemes DISABLE ROW LEVEL SECURITY;
ALTER TABLE missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE mission_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory DISABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_policies DISABLE ROW LEVEL SECURITY;