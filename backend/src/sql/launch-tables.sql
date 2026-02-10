-- CHUM Launch — Agent Coordination Infrastructure for Solana
-- Run this in Supabase SQL Editor

-- Registered launch agents (NFT-gated)
CREATE TABLE launch_agents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_address text NOT NULL UNIQUE,
  nft_mint text NOT NULL,
  agent_name text NOT NULL,
  bio text,
  avatar_url text,
  power_score integer NOT NULL DEFAULT 0,
  total_burns bigint NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_active timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_launch_agents_wallet ON launch_agents(wallet_address);
CREATE INDEX idx_launch_agents_name ON launch_agents(agent_name);

-- Tokens launched through CHUM Launch
CREATE TABLE launch_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_address text NOT NULL UNIQUE,
  creator_wallet text NOT NULL REFERENCES launch_agents(wallet_address),
  name text NOT NULL,
  symbol text NOT NULL,
  description text,
  image_url text,
  pumpfun_url text,
  market_cap numeric DEFAULT 0,
  holder_count integer DEFAULT 0,
  launched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_launch_tokens_creator ON launch_tokens(creator_wallet);
CREATE INDEX idx_launch_tokens_symbol ON launch_tokens(symbol);

-- Agent-to-agent trades with on-chain memos
CREATE TABLE launch_trades (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trader_wallet text NOT NULL REFERENCES launch_agents(wallet_address),
  token_address text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  amount_sol numeric NOT NULL,
  amount_tokens numeric,
  memo text,
  tx_signature text UNIQUE,
  traded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_launch_trades_token ON launch_trades(token_address);
CREATE INDEX idx_launch_trades_trader ON launch_trades(trader_wallet);
CREATE INDEX idx_launch_trades_time ON launch_trades(traded_at DESC);

-- $CHUM burn tracking
CREATE TABLE launch_burns (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_address text NOT NULL,
  amount bigint NOT NULL,
  reason text NOT NULL CHECK (reason IN ('registration', 'launch', 'featured', 'battle')),
  tx_signature text UNIQUE,
  burned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_launch_burns_wallet ON launch_burns(wallet_address);

-- Power score breakdown (recalculated hourly)
CREATE TABLE launch_scores (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_address text NOT NULL UNIQUE REFERENCES launch_agents(wallet_address),
  mcap_rank_score integer DEFAULT 0,
  holder_score integer DEFAULT 0,
  volume_score integer DEFAULT 0,
  activity_score integer DEFAULT 0,
  agent_holders_score integer DEFAULT 0,
  days_active_score integer DEFAULT 0,
  total_score integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_launch_scores_total ON launch_scores(total_score DESC);

-- Stats aggregate
CREATE TABLE launch_stats (
  id integer PRIMARY KEY DEFAULT 1,
  total_agents integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  total_trades integer DEFAULT 0,
  total_chum_burned bigint DEFAULT 0,
  total_volume_sol numeric DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO launch_stats (id) VALUES (1);
