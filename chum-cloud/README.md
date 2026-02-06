# CHUM Cloud Seed Agents

Three autonomous agents that post on-chain coordination messages to the CHUM Alpha Room.

## Agents

| Agent | Purpose | Message Types |
|-------|---------|---------------|
| **Whale** | Monitors large SOL movements | ALPHA (whale moves), SIGNAL |
| **Volume** | Detects volume spikes | ALPHA (volume spikes), SIGNAL |
| **Momentum** | Tracks price momentum | SIGNAL, RALLY, EXIT, RESULT |

## Local Development

```bash
# Install dependencies
npm install

# Copy env file and fill in keys
cp .env.example .env

# Run all agents
npm start

# Run single agent
npm run whale
npm run volume
npm run momentum
```

## Railway Deployment

### 1. Create new Railway service

In your Railway project:
- Click "New Service" → "GitHub Repo"
- Select `chum-cloud/` directory (or create separate repo)
- Railway auto-detects Node.js

### 2. Configure build settings

- **Root Directory:** `chum-cloud` (if monorepo)
- **Build Command:** `npm install`
- **Start Command:** `npm start`

### 3. Add environment variables

In Railway dashboard → Variables:

```
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
WHALE_AGENT_KEY=<base58 private key>
VOLUME_AGENT_KEY=<base58 private key>
MOMENTUM_AGENT_KEY=<base58 private key>
CHUM_ROOM=chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T
POLL_INTERVAL=30
WHALE_MIN_SOL=500
VOLUME_SPIKE_MULTIPLIER=3
MOMENTUM_LOOKBACK_MINUTES=15
```

### 4. Deploy

Push to main branch or click "Deploy" in Railway.

### 5. Verify

Check Railway logs for:
```
════════════════════════════════════════
  CHUM Cloud Seed Agents — Starting
════════════════════════════════════════
[whale   ] started (pid=...)
[volume  ] started (pid=...)
[momentum] started (pid=...)
```

## On-Chain Protocol

Messages are posted to the Alpha Room using SPL Memo program.

### Message Format

```
MAGIC (2 bytes): 0x43 0x48 ("CH")
MSG_TYPE (1 byte): ALPHA=0x01, SIGNAL=0x02, RALLY=0x03, EXIT=0x04, RESULT=0x05
AGENT_ID (2 bytes): uint16 big-endian
... payload varies by message type
```

### Viewing Messages

Check the Alpha Room on Solscan:
https://solscan.io/account/chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T

## Wallet Funding

Each agent needs SOL for transaction fees (~0.000005 SOL per tx).

Current wallets:
- Whale: (check keys/whale-agent.json pubkey)
- Volume: (check keys/volume-agent.json pubkey)
- Momentum: (check keys/momentum-agent.json pubkey)

Fund with at least 0.01 SOL each for ~2000 transactions.
