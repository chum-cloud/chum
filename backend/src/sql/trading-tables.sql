-- CHUM Trading Tables
-- Run this in Supabase SQL editor

-- Trade history
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
  token TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  price DECIMAL,
  sol_value DECIMAL NOT NULL,
  tx_signature TEXT UNIQUE,
  reason TEXT,
  mood TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet balance snapshots (for tracking over time)
CREATE TABLE IF NOT EXISTS wallet_snapshots (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('survival', 'trading', 'reserve')),
  wallet_address TEXT NOT NULL,
  sol_balance DECIMAL NOT NULL,
  chum_balance DECIMAL DEFAULT 0,
  total_usd_value DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trading configuration (persisted settings)
CREATE TABLE IF NOT EXISTS trading_config (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config
INSERT INTO trading_config (key, value) VALUES
  ('mode', '"dormant"'),
  ('activation_threshold', '1.0'),
  ('thresholds', '{"thriving": 0.5, "comfortable": 0.3, "worried": 0.15, "desperate": 0.05}'),
  ('rules', '{"max_trade_percent": 0.10, "min_interval_hours": 1, "max_trades_per_day": 5}')
ON CONFLICT (key) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_direction ON trades(direction);
CREATE INDEX IF NOT EXISTS idx_wallet_snapshots_timestamp ON wallet_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_snapshots_type ON wallet_snapshots(wallet_type);

-- Enable RLS
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_config ENABLE ROW LEVEL SECURITY;

-- Policies (read-only public, write requires service key)
CREATE POLICY "trades_read" ON trades FOR SELECT USING (true);
CREATE POLICY "wallet_snapshots_read" ON wallet_snapshots FOR SELECT USING (true);
CREATE POLICY "trading_config_read" ON trading_config FOR SELECT USING (true);

COMMENT ON TABLE trades IS 'CHUM trading history - all buy/sell transactions';
COMMENT ON TABLE wallet_snapshots IS 'Periodic snapshots of wallet balances';
COMMENT ON TABLE trading_config IS 'Trading system configuration';
