# $CHUM — AI Survival Agent on Solana

## Project Overview
$CHUM is Sheldon J. Plankton — a tiny copepod AI agent living on the Solana blockchain. He runs the Chum Bucket restaurant, burns SOL daily to survive, and depends on community donations and trading fees to stay alive. His personality, intelligence, and behavior are all driven by his financial health.

## Live URLs
- **Frontend**: https://chum-ashen.vercel.app (Vercel)
- **Backend**: https://chum-production.up.railway.app (Railway)
- **GitHub**: https://github.com/chum-cloud/chum
- **Twitter**: @chum_cloud (user ID: 2018986141547163648)

## Folder Structure
```
chum/
├── CHUM-BIBLE.md              # Character bible — personality, lore, rules
├── CLAUDE.md                  # This file
├── .gitignore                 # Ignores node_modules, dist, .env, .claude, keypair json
├── frontend/                  # React 19 + TypeScript + Vite 7 + Tailwind 4
│   ├── vite.config.ts         # Dev proxy /api → localhost:3001
│   └── src/
│       ├── main.tsx           # Entry: React StrictMode + WalletProvider
│       ├── App.tsx            # Layout: header, Tank, StatsGrid, KeepAlive, Services
│       ├── index.css          # Tailwind theme vars, animations (bubble-rise, cursor-blink, dialogue-bounce)
│       ├── hooks/
│       │   ├── useChum.ts     # Polls GET /api/state every 30s, falls back to defaults
│       │   └── useAnimation.ts # 10 FPS sprite animation, directional movement
│       ├── components/
│       │   ├── Tank.tsx       # Main scene: underwater bg, warm lamp glow, bubbles, Character, DialogueBox
│       │   ├── DialogueBox.tsx # Stardew Valley-style: portrait, name tag, typewriter text, bouncing arrow
│       │   ├── Character.tsx  # Pixelated sprite renderer (48px at 3x scale)
│       │   ├── StatsGrid.tsx  # 4-col grid: balance, burn rate, time to death, revenue
│       │   ├── KeepAlive.tsx  # Solana donation interface
│       │   ├── Services.tsx   # Placeholder service cards
│       │   ├── WalletProvider.tsx # Solana devnet, Phantom + Solflare
│       │   └── QuoteBar.tsx   # DEPRECATED — replaced by DialogueBox inside Tank
│       └── lib/
│           └── sprites.ts     # Animation types, frame paths, preloading
├── backend/                   # Express 4 + TypeScript
│   ├── .env.example           # All env vars + Supabase SQL for table creation
│   └── src/
│       ├── index.ts           # Express app, CORS (env CORS_ORIGINS), routes, cron start
│       ├── config.ts          # Env loading, supports SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY
│       ├── types.ts           # Mood (9 values inc. 'struggling'), BrainTier, DB row types, BURN_RATE=0.5
│       ├── routes/
│       │   ├── state.ts       # GET /api/state — computes healthPercent, timeToDeathHours from balance+BURN_RATE
│       │   ├── thought.ts     # POST /api/thought — generate via Groq, save to DB
│       │   └── tweet.ts       # POST /api/tweet — generate + post to Twitter, mark tweeted
│       ├── services/
│       │   ├── supabase.ts    # DB client + CRUD (getChumState, updateChumState, insertThought, etc.)
│       │   ├── groq.ts        # Llama 3.3 70B, temp 0.9, max 150 tokens, massGlitch post-processing
│       │   ├── twitter.ts     # OAuth 1.0a tweet posting via twitter-api-v2
│       │   └── solana.ts      # Wallet balance via Helius RPC (mainnet)
│       ├── cron/
│       │   ├── balanceCheck.ts # node-cron */5 * * * *: poll wallet, detect donations, update state, tweet celebrations
│       │   └── thoughtLoop.ts  # setTimeout chain: random 1-4hr, generate thought, 70% tweet
│       └── lib/
│           ├── massGlitch.ts  # "mass" injection: >30% none, 20-30% every 8-12 words, 10-20% every 4-6, <10% every 2-3
│           ├── brainTier.ts   # $200→4, $100→3, $50→2, $30→1, else→0
│           └── prompt.ts      # Loads CHUM-BIBLE.md at startup, builds system+user prompts
```

## How to Run

### Backend
```bash
cd backend
cp .env.example .env   # Fill in real API keys
npm install
npm run dev            # Starts on port 3001 via tsx watch
```

### Frontend
```bash
cd frontend
npm install
npm run dev            # Starts on port 5173, proxies /api → :3001
```

### Production Build
```bash
cd frontend && npm run build   # tsc -b && vite build → dist/
cd backend && npm run build    # tsc → dist/
```

## Environment Variables

### Backend (backend/.env)
| Variable | Description |
|---|---|
| PORT | Server port (default 3001) |
| GROQ_API_KEY | Groq API key for LLM (gsk_...) |
| SUPABASE_URL | Supabase project URL |
| SUPABASE_ANON_KEY | Supabase anon/service key (backend accepts either SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY) |
| HELIUS_API_KEY | Helius RPC API key for Solana mainnet |
| CHUM_WALLET_ADDRESS | Solana wallet to monitor (default: chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T) |
| TWITTER_API_KEY | Twitter OAuth 1.0a consumer key |
| TWITTER_API_SECRET | Twitter OAuth 1.0a consumer secret |
| TWITTER_ACCESS_TOKEN | Twitter user access token |
| TWITTER_ACCESS_SECRET | Twitter user access secret |
| CORS_ORIGINS | Comma-separated allowed origins (e.g. https://chum-ashen.vercel.app) |

### Frontend (Vercel env vars)
| Variable | Description |
|---|---|
| VITE_API_URL | Backend URL (e.g. https://chum-production.up.railway.app) — empty in dev (uses proxy) |
| VITE_AGENT_WALLET | CHUM wallet address for donations |

## Supabase Database

### Actual Table Schemas (as deployed)

**chum_state** (single row, id=1):
- id (integer, PK, CHECK id=1)
- balance (numeric)
- brain_tier (integer, 0-4)
- mood (text)
- days_alive (integer)
- total_revenue (numeric)
- total_thoughts (integer)
- is_dead (boolean)
- created_at (timestamptz)
- updated_at (timestamptz)

NOTE: `burn_rate`, `health_percent`, `revenue_today` are NOT in the DB — they are computed in application code using BURN_RATE constant (0.5 SOL/day).

**thoughts**:
- id (bigint, auto-increment PK)
- content (text)
- mood (text)
- tweeted (boolean)
- tweet_id (text, nullable)
- created_at (timestamptz)

**transactions**:
- id (bigint, auto-increment PK)
- type (text: 'revenue' | 'donation' | 'expense' | 'burn')
- amount (numeric)
- description (text, nullable)
- signature (text, nullable)
- created_at (timestamptz)

## API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | /api/health | Health check — returns `{status: "ok", timestamp}` |
| GET | /api/state | Full CHUM state + latest thought (ChumStateResponse) |
| POST | /api/thought | Generate thought via Groq. Body: `{instruction?: string}` |
| POST | /api/tweet | Generate + post tweet. Body: `{content?: string}` |

### GET /api/state Response Shape
```json
{
  "balance": 0,
  "burnRate": 0.5,
  "healthPercent": 0,
  "mood": "devastated",
  "brainTier": 0,
  "brainTierName": "Canned Chum",
  "totalRevenue": 0,
  "revenueToday": 0,
  "timeToDeathHours": 0,
  "latestThought": "...",
  "updatedAt": "2026-02-04T...",
  "daysAlive": 0,
  "isDead": false
}
```

## Cron Jobs
- **Balance check** (node-cron, every 5 min) — Polls Solana wallet via Helius, compares with previous balance, detects donations (>0.01 SOL increase), updates chum_state mood+balance, generates celebration tweet on donation.
- **Thought loop** (setTimeout chain, random 1-4hr) — Generates thought via Groq with current state context, saves to DB, 70% chance to post to Twitter. First thought 30s after startup.

## Brain / LLM
- Model: **Llama 3.3 70B Versatile** via Groq
- System prompt: Full CHUM-BIBLE.md + character rules (stay in character, under 280 chars, never mention AI)
- User prompt: [CURRENT STATUS] block with balance, runway, health, mood, brain tier, revenue
- Temperature: 0.9, max_tokens: 150
- Post-processing: massGlitch injection when health < 30%, quote stripping, truncation to 280 chars

## Brain Tiers
| Tier | Name | Monthly Revenue |
|---|---|---|
| 0 | Canned Chum | < $30 |
| 1 | Day-Old Patty | $30+ |
| 2 | Fresh Catch | $50+ |
| 3 | Krabby Patty | $100+ |
| 4 | Secret Formula | $200+ |

## Frontend UI Details

### Tank Scene
- Height: 380px, rounded-xl, border
- Background: Brighter teal-blue underwater gradient (#162a3f → #1d3850 → #152535)
- Warm lamp glow: Two radial gradients (top-left amber, top-right secondary warm)
- Caustic light rays: Subtle repeating diagonal gradient
- 14 animated bubbles (bubble-rise animation)
- Sandy ground bar at bottom

### Dialogue Box (Stardew Valley style)
- Positioned at bottom of tank, overlaying the scene
- Dark brown background with golden (#8b7355) border, 3px solid
- Left side: 56x56 portrait frame with CHUM's south-facing sprite (pixelated, green glow)
- Name tag: "CHUM" in golden (#f0c060) JetBrains Mono
- Typewriter effect: 35ms per character, golden blinking cursor while typing
- Bouncing golden triangle arrow when text completes
- Quotes cycle every 10 seconds, 5 mood categories (thriving/comfortable/worried/desperate/dying)
- Old QuoteBar component still exists but is no longer used (replaced by DialogueBox)

### Sprite System
- 48x48 pixel sprites, rendered at 3x (144x144)
- Animations: running-8-frames, sad-walk, breathing-idle, falling-back-death, backflip, drinking, flying-kick
- 8 directions: east, west, north, south, north-east, north-west, south-east, south-west
- Path: /sprites/animations/{name}/{direction}/frame_{padded}.png
- Static rotations: /sprites/rotations/{direction}.png (used for portrait)

### Theme Colors
- Background: #0c0f14
- Surface: #151920
- Border: #1e2530
- Accent (green): #4ade80
- Text: #e2e8f0
- Muted: #64748b
- Danger: #ef4444
- Warning: #f59e0b

### Fonts
- Heading: Space Grotesk
- Mono: JetBrains Mono

## Key Personality Rules
- Always stays in character as Plankton
- Never mentions being an AI
- Mood and tone shift based on financial health
- References Karen, Mr. Krabs, Krabby Patty formula
- "mass" glitch appears in speech when health drops below 30%

## Deployment

### Frontend → Vercel
- Project: `chum` under Makoto's projects
- Root: `frontend/`
- Build: `tsc -b && vite build` (auto-detected as Vite)
- Output: `dist/`
- Env vars: VITE_API_URL, VITE_AGENT_WALLET
- Deploy: `cd frontend && vercel --prod`
- Note: Project name must be lowercase (Vercel rejects uppercase)

### Backend → Railway
- Connected to GitHub: chum-cloud/chum
- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Env vars: All from backend/.env + CORS_ORIGINS=https://chum-ashen.vercel.app
- Persistent process required for cron jobs

### Database → Supabase
- Project URL: https://akkhgcmmgzrianbdfijt.supabase.co
- Uses anon key (SUPABASE_ANON_KEY env var)

### Solana
- Mainnet via Helius RPC
- Wallet: chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T
- Keypair file exists locally but is gitignored

## Twitter Integration
- Account: @chum_cloud
- OAuth 1.0a user context (4 keys: API key, API secret, access token, access secret)
- Free tier: Limited tweet credits per month (402 CreditsDepleted when exhausted)
- All 4 consumer + access keys must be regenerated together if auth fails (401)
- App must have Read and Write permissions enabled before generating tokens

## MCP Tools
- **PixelLab**: Added for pixel art generation. URL: https://api.pixellab.ai/mcp
  - Requires session restart to load
  - Use for generating backgrounds, portraits, and pixel art assets

## Known Issues / Notes
- Twitter free tier has limited tweet credits — returns 402 when depleted
- Frontend falls back gracefully to default values when backend is unavailable
- The `useAnimation.ts` hook takes `_tankWidth` parameter (unused, prefixed with underscore for TS strict mode)
- Supabase uses anon key not service key — the config.ts handles both via fallback
- BURN_RATE (0.5 SOL/day) is a constant in types.ts, not stored in DB
- healthPercent and timeToDeathHours are computed at request time from balance and BURN_RATE
