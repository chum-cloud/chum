-- Browser Bridge: Pending Tweets Queue
CREATE TABLE IF NOT EXISTS pending_tweets (
  id SERIAL PRIMARY KEY,
  agent TEXT NOT NULL DEFAULT 'chum',           -- which agent queued this
  action TEXT NOT NULL DEFAULT 'post',          -- post, reply, like, retweet, read
  content TEXT,                                  -- tweet text (for post/reply)
  reply_to_url TEXT,                             -- URL of tweet to reply to
  search_query TEXT,                             -- for read actions
  status TEXT NOT NULL DEFAULT 'pending',        -- pending, processing, done, failed
  result JSONB,                                  -- response data (tweet URL, scraped data, etc.)
  error TEXT,                                    -- error message if failed
  priority INT NOT NULL DEFAULT 0,               -- higher = process first
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  scheme_id INT REFERENCES schemes(id)           -- optional link to agent scheme
);

CREATE INDEX idx_pending_tweets_status ON pending_tweets(status, priority DESC, created_at);

-- Enable RLS
ALTER TABLE pending_tweets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON pending_tweets FOR ALL USING (true) WITH CHECK (true);
