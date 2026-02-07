# CHUM Trading System — Implementation Spec

## Overview

Rule-based trading engine for small portfolio (<1 SOL). No ML/AI — pure deterministic rules based on academic research.

**Philosophy:** Capital preservation > aggressive gains. Fees kill small portfolios.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TRADING ENGINE                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  SIGNALS    │  │  RISK MGR   │  │  EXECUTOR   │     │
│  │  - RSI      │  │  - Position │  │  - Jupiter  │     │
│  │  - SMA      │  │  - Drawdown │  │  - Limits   │     │
│  │  - Price    │  │  - Cooldown │  │  - Confirm  │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          ▼                              │
│                   ┌─────────────┐                       │
│                   │  DECISION   │                       │
│                   │   ENGINE    │                       │
│                   └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

---

## Wallets

| Wallet | Purpose | Control | Address |
|--------|---------|---------|---------|
| Survival | Public ops, donations | CHUM reads only | `chumAA7Qjp...` (existing) |
| Trading | Active trading | CHUM autonomous | TBD (new keypair) |
| Reserve | Emergency backup | Makoto only | TBD (new keypair) |

**Activation Flow:**
1. Survival wallet reaches 1 SOL total
2. Split: 0.5 SOL → Reserve, 0.5 SOL → Trading
3. Trading engine activates

---

## Supported Assets

| Asset | Mint Address | Why |
|-------|--------------|-----|
| JUP | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` | High liquidity, ecosystem core |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` | High liquidity, meme blue chip |
| ORE | `oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp` | Proof-of-work, unique mechanics |

**Never Trade:** $CHUM (conflict of interest), random shitcoins, <$100k liquidity tokens

---

## Signal Generators

### 1. RSI (Relative Strength Index)

```typescript
interface RSIConfig {
  period: 14;           // Standard RSI period
  oversold: 35;         // Buy signal threshold
  overbought: 70;       // Sell signal threshold
  source: 'close';      // Use closing prices
}

// Signal output
type RSISignal = 'BUY' | 'SELL' | 'HOLD';
```

**Implementation:**
```typescript
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // neutral if insufficient data
  
  let gains = 0, losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}
```

### 2. SMA (Simple Moving Average)

```typescript
interface SMAConfig {
  shortPeriod: 7;       // Fast MA
  longPeriod: 21;       // Slow MA
  deviationBuy: -0.08;  // Buy if price 8% below SMA
  deviationSell: 0.12;  // Sell if price 12% above SMA
}
```

**Implementation:**
```typescript
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function getSMASignal(currentPrice: number, sma: number, config: SMAConfig): Signal {
  const deviation = (currentPrice - sma) / sma;
  if (deviation <= config.deviationBuy) return 'BUY';
  if (deviation >= config.deviationSell) return 'SELL';
  return 'HOLD';
}
```

### 3. Combined Signal

```typescript
function getCombinedSignal(rsiSignal: Signal, smaSignal: Signal): Signal {
  // Both must agree for action, otherwise hold
  if (rsiSignal === 'BUY' && smaSignal === 'BUY') return 'BUY';
  if (rsiSignal === 'SELL' && smaSignal === 'SELL') return 'SELL';
  
  // Single strong signal (RSI extreme) can trigger alone
  if (rsiSignal === 'BUY') return 'BUY';  // RSI < 35 is strong
  if (rsiSignal === 'SELL') return 'SELL'; // RSI > 70 is strong
  
  return 'HOLD';
}
```

---

## Risk Management

### Position Sizing

```typescript
interface PositionConfig {
  maxPositionPct: 0.33;     // Max 33% of portfolio per position
  minTradeSOL: 0.02;        // Minimum trade size
  maxOpenPositions: 3;       // Max concurrent positions
}

function calculatePositionSize(
  portfolioValue: number,
  config: PositionConfig
): number {
  const maxPosition = portfolioValue * config.maxPositionPct;
  return Math.max(config.minTradeSOL, maxPosition);
}
```

### Stop Loss & Take Profit

```typescript
interface ExitConfig {
  stopLossPct: -0.08;       // -8% stop loss
  takeProfitPartial: 0.12;  // +12% take 50%
  takeProfitFull: 0.20;     // +20% take remaining
  timeStopDays: 7;          // Exit if flat for 7 days
}

interface Position {
  asset: string;
  entryPrice: number;
  entryTime: number;
  quantity: number;
  soldPartial: boolean;
}

function checkExit(position: Position, currentPrice: number, config: ExitConfig): ExitAction {
  const pnlPct = (currentPrice - position.entryPrice) / position.entryPrice;
  const daysHeld = (Date.now() - position.entryTime) / (1000 * 60 * 60 * 24);
  
  // Stop loss - exit all
  if (pnlPct <= config.stopLossPct) {
    return { action: 'SELL_ALL', reason: 'stop_loss' };
  }
  
  // Take profit partial
  if (!position.soldPartial && pnlPct >= config.takeProfitPartial) {
    return { action: 'SELL_HALF', reason: 'take_profit_partial' };
  }
  
  // Take profit full
  if (pnlPct >= config.takeProfitFull) {
    return { action: 'SELL_ALL', reason: 'take_profit_full' };
  }
  
  // Time stop
  if (daysHeld >= config.timeStopDays && Math.abs(pnlPct) < 0.03) {
    return { action: 'SELL_ALL', reason: 'time_stop' };
  }
  
  return { action: 'HOLD', reason: null };
}
```

### Circuit Breakers

```typescript
interface CircuitBreakerConfig {
  maxDailyLossPct: -0.15;   // Stop trading if down 15% in a day
  maxDrawdownPct: -0.25;    // Stop trading if down 25% from peak
  cooldownHours: 24;         // Cooldown after circuit breaker
  maxTradesPerDay: 3;        // Max 3 trades per day
}

interface TradingState {
  dailyPnL: number;
  peakValue: number;
  currentValue: number;
  tradesToday: number;
  circuitBroken: boolean;
  circuitBrokenAt: number | null;
}

function checkCircuitBreaker(state: TradingState, config: CircuitBreakerConfig): boolean {
  // Daily loss limit
  if (state.dailyPnL <= config.maxDailyLossPct) {
    return true;
  }
  
  // Max drawdown from peak
  const drawdown = (state.currentValue - state.peakValue) / state.peakValue;
  if (drawdown <= config.maxDrawdownPct) {
    return true;
  }
  
  // Max trades per day
  if (state.tradesToday >= config.maxTradesPerDay) {
    return true;
  }
  
  return false;
}
```

---

## Execution Layer (Jupiter)

### Limit Orders Only

```typescript
interface JupiterConfig {
  apiUrl: 'https://jup.ag/api';
  limitOrderUrl: 'https://jup.ag/api/limit/v1';
  slippageBps: 0;           // 0 slippage for limit orders
  priorityFeeLamports: 1000; // Small priority fee
}

async function createLimitOrder(
  inputMint: string,
  outputMint: string,
  inAmount: number,
  outAmount: number,  // The price we want
  expiry: number      // Unix timestamp
): Promise<string> {
  // Jupiter limit order API
  const response = await fetch(`${config.limitOrderUrl}/createOrder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputMint,
      outputMint,
      inAmount: Math.floor(inAmount * 1e9).toString(),
      outAmount: Math.floor(outAmount * 1e9).toString(),
      expiredAt: expiry,
      base: tradingWallet.publicKey.toString(),
    }),
  });
  
  // Sign and submit transaction
  // ...
}
```

### Price Feeds

```typescript
async function getPrice(mint: string): Promise<number> {
  // Use Jupiter price API
  const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`);
  const data = await response.json();
  return data.data[mint].price;
}

async function getHistoricalPrices(mint: string, days: number): Promise<number[]> {
  // Use Birdeye or similar for historical data
  // Return array of daily closing prices
}
```

---

## Database Schema

```sql
-- Positions table
CREATE TABLE trading_positions (
  id SERIAL PRIMARY KEY,
  asset TEXT NOT NULL,
  mint TEXT NOT NULL,
  entry_price DECIMAL(20, 10) NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quantity DECIMAL(20, 10) NOT NULL,
  sold_partial BOOLEAN DEFAULT FALSE,
  exit_price DECIMAL(20, 10),
  exit_time TIMESTAMPTZ,
  exit_reason TEXT,
  pnl_sol DECIMAL(20, 10),
  pnl_pct DECIMAL(10, 4),
  status TEXT DEFAULT 'open' -- open, closed
);

-- Trade history
CREATE TABLE trading_history (
  id SERIAL PRIMARY KEY,
  position_id INT REFERENCES trading_positions(id),
  action TEXT NOT NULL, -- BUY, SELL_HALF, SELL_ALL
  price DECIMAL(20, 10) NOT NULL,
  quantity DECIMAL(20, 10) NOT NULL,
  sol_amount DECIMAL(20, 10) NOT NULL,
  tx_signature TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily stats
CREATE TABLE trading_daily_stats (
  date DATE PRIMARY KEY,
  starting_balance DECIMAL(20, 10),
  ending_balance DECIMAL(20, 10),
  pnl_sol DECIMAL(20, 10),
  pnl_pct DECIMAL(10, 4),
  trades_count INT DEFAULT 0,
  circuit_broken BOOLEAN DEFAULT FALSE
);

-- Trading state
CREATE TABLE trading_state (
  id INT PRIMARY KEY DEFAULT 1,
  peak_value DECIMAL(20, 10),
  circuit_broken BOOLEAN DEFAULT FALSE,
  circuit_broken_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Endpoints

```typescript
// GET /api/trading/status
// Returns current trading state, positions, daily P&L

// GET /api/trading/positions
// Returns all open positions

// GET /api/trading/history?days=30
// Returns trade history

// GET /api/trading/signals
// Returns current signals for all assets

// POST /api/trading/execute (internal only)
// Executes a trade decision - called by cron
```

---

## Cron Schedule

```typescript
// Every 15 minutes during active hours
// Check signals, manage positions, execute trades

const TRADING_SCHEDULE = {
  interval: '*/15 * * * *',  // Every 15 min
  activeHours: { start: 0, end: 24 }, // 24/7 for crypto
  
  async run() {
    // 1. Check circuit breakers
    if (await isCircuitBroken()) return;
    
    // 2. Check existing positions for exits
    await checkPositionExits();
    
    // 3. Generate signals for new entries
    const signals = await generateSignals();
    
    // 4. Execute valid signals
    for (const signal of signals) {
      if (signal.action === 'BUY' && canOpenPosition()) {
        await executeBuy(signal);
      }
    }
    
    // 5. Update daily stats
    await updateDailyStats();
  }
};
```

---

## Frontend Display (War Chest Enhancement)

```typescript
// Expand War Chest to show:
// - Trading status (DORMANT / ACTIVE / PAUSED)
// - Open positions with P&L
// - Today's P&L
// - Total trading profits

interface WarChestData {
  // Existing
  survival: number;
  trading: number;
  reserve: number;
  
  // New
  tradingStatus: 'dormant' | 'active' | 'paused';
  positions: Position[];
  todayPnL: number;
  totalProfits: number;
  lastTrade: Trade | null;
}
```

---

## File Structure

```
backend/src/
├── services/
│   └── trading/
│       ├── index.ts           # Main trading engine
│       ├── signals.ts         # RSI, SMA calculations
│       ├── risk.ts            # Position sizing, stops
│       ├── executor.ts        # Jupiter integration
│       ├── state.ts           # Trading state management
│       └── config.ts          # All configurable params
├── routes/
│   └── trading.ts             # API endpoints
└── sql/
    └── trading-tables.sql     # Database schema
```

---

## Config (Adjustable)

```typescript
// backend/src/services/trading/config.ts
export const TRADING_CONFIG = {
  // Assets
  assets: [
    { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
    { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
    { symbol: 'ORE', mint: 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhxyK9jSybcp' },
  ],
  
  // Signals
  rsi: { period: 14, oversold: 35, overbought: 70 },
  sma: { short: 7, long: 21, buyDev: -0.08, sellDev: 0.12 },
  
  // Risk
  maxPositionPct: 0.33,
  minTradeSOL: 0.02,
  maxOpenPositions: 3,
  stopLossPct: -0.08,
  takeProfitPartial: 0.12,
  takeProfitFull: 0.20,
  timeStopDays: 7,
  
  // Circuit breakers
  maxDailyLossPct: -0.15,
  maxDrawdownPct: -0.25,
  cooldownHours: 24,
  maxTradesPerDay: 3,
  
  // Execution
  slippageBps: 0,
  priorityFeeLamports: 1000,
  limitOrderExpiryHours: 24,
};
```

---

## Estimated Build Time

| Component | Hours |
|-----------|-------|
| Signals (RSI, SMA) | 2 |
| Risk management | 2 |
| Jupiter executor | 3 |
| Database + state | 2 |
| API endpoints | 1 |
| Cron integration | 1 |
| Frontend updates | 2 |
| Testing | 3 |
| **Total** | **16** |

---

## Next Steps

1. [ ] Create trading + reserve wallet keypairs
2. [ ] Run SQL migrations
3. [ ] Implement signals module
4. [ ] Implement risk module
5. [ ] Implement Jupiter executor
6. [ ] Wire up API + cron
7. [ ] Update frontend War Chest
8. [ ] Test on devnet
9. [ ] Deploy to mainnet (dormant until 1 SOL)

---

Ready to build when you say go. 🐟
