-- Agent browser task queue
-- Tasks are created by agents on Railway, executed by OpenClaw on VPS
CREATE TABLE IF NOT EXISTS agent_tasks (
  id SERIAL PRIMARY KEY,
  task_type TEXT NOT NULL,  -- 'post_tweet', 'read_mentions', 'read_timeline', 'search_tweets'
  agent_id TEXT NOT NULL,   -- which agent requested this
  payload JSONB NOT NULL DEFAULT '{}',  -- task-specific data (tweet content, search query, etc.)
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
  result JSONB,  -- execution result (scraped data, tweet URL, etc.)
  error TEXT,    -- error message if failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  priority INT NOT NULL DEFAULT 0  -- higher = more urgent
);

-- Index for polling pending tasks
CREATE INDEX IF NOT EXISTS idx_agent_tasks_pending ON agent_tasks (status, priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Index for agent lookup
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks (agent_id, created_at DESC);

-- Rate limit: max 5 tweets per day
CREATE OR REPLACE FUNCTION check_tweet_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_type = 'post_tweet' THEN
    IF (SELECT COUNT(*) FROM agent_tasks 
        WHERE task_type = 'post_tweet' 
        AND status IN ('pending', 'completed')
        AND created_at > NOW() - INTERVAL '24 hours') >= 5 THEN
      RAISE EXCEPTION 'Tweet rate limit: max 5 per day';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tweet_rate_limit ON agent_tasks;
CREATE TRIGGER tweet_rate_limit
  BEFORE INSERT ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION check_tweet_rate_limit();
