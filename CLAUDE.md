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
├── CHUM-BIBLE-v2.md           # Character bible v2 — personality, lore, rules
├── CLAUDE.md                  # This file
├── .gitignore                 # Ignores node_modules, dist, .env, .claude, keypair json
├── frontend/                  # React 19 + TypeScript + Vite 7 + Tailwind 4
│   ├── vite.config.ts         # Dev proxy /api → localhost:3001
│   └── src/
│       ├── main.tsx           # Entry: React StrictMode + WalletProvider
│       ├── App.tsx            # Layout: header, hero, VisualNovelScene, StatsGrid, LatestTweet, KeepAlive, VillainClaim
│       ├── index.css          # Tailwind theme vars, animations (bubble-rise, cursor-blink, dialogue-bounce)
│       ├── hooks/
│       │   ├── useChum.ts     # Polls GET /api/state every 30s, falls back to defaults
│       │   ├── useThoughtStream.ts # SSE hook — real-time thoughts via GET /api/stream
│       │   └── useAnimation.ts # 10 FPS sprite animation, directional movement
│       ├── components/
│       │   ├── VisualNovelScene.tsx # Main scene: mood-based backgrounds, portrait, dialogue box with typewriter
│       │   ├── StatsGrid.tsx  # 4-col grid: balance, burn rate, time to death, revenue
│       │   ├── LatestTweet.tsx # Shows latest tweeted thought from DB + link to @chum_cloud
│       │   ├── KeepAlive.tsx  # Solana mainnet donation interface
│       │   ├── VillainClaim.tsx # Check wallet for Fellow Villain NFT + display/mint
│       │   ├── WalletProvider.tsx # Solana mainnet, Phantom + Solflare
│       │   ├── PlanktonRig.tsx # Character rig renderer
│       │   ├── ChumCharacter.tsx # Character component
│       │   ├── ChumCloud.tsx  # CHUM Cloud social (not in current layout)
│       │   ├── VillainGallery.tsx # Villain gallery (not in current layout)
│       │   ├── TwitterFeed.tsx # Old Twitter timeline embed (not in current layout)
│       │   ├── ThoughtsFeed.tsx # Old thoughts feed (not in current layout, replaced by dialogue box)
│       │   └── Services.tsx   # Placeholder service cards (not in current layout)
│       └── lib/
│           ├── sprites.ts     # Animation types, frame paths, preloading
│           └── types.ts       # Villain NFT types (VillainTraits, Villain)
├── backend/                   # Express 4 + TypeScript
│   ├── .env.example           # All env vars + Supabase SQL for table creation
│   └── src/
│       ├── index.ts           # Express app, CORS, routes, cron + event system start
│       ├── config.ts          # Env loading, supports SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY
│       ├── types.ts           # Mood (9 values), BrainTier, DB row types, Cloud types
│       ├── config/
│       │   └── costs.ts       # Operation costs in USD, daily budget constants
│       ├── routes/
│       │   ├── state.ts       # GET /api/state — computes healthPercent, timeToDeathHours, cost metrics
│       │   ├── thought.ts     # POST /api/thought — generate via Groq, save to DB
│       │   ├── thoughts.ts    # GET /api/thoughts — recent thoughts list
│       │   ├── tweet.ts       # POST /api/tweet — generate + post to Twitter, mark tweeted
│       │   ├── stream.ts      # GET /api/stream — SSE endpoint for real-time thought streaming
│       │   ├── villain.ts     # POST /api/generate-villain, GET /api/villains, GET /api/villain/:wallet
│       │   ├── cloud.ts       # CHUM Cloud social platform routes (agents, lairs, posts)
│       │   └── skill.ts       # GET /api/cloud/skill.md — agent onboarding
│       ├── services/
│       │   ├── supabase.ts    # DB client + CRUD (getChumState, updateChumState, insertThought, etc.)
│       │   ├── groq.ts        # Llama 3.3 70B, temp 0.9, max 150 tokens, massGlitch post-processing
│       │   ├── twitter.ts     # OAuth 1.0a tweet posting via twitter-api-v2
│       │   ├── solana.ts      # Wallet balance + recent transactions via Helius RPC (mainnet)
│       │   ├── events.ts      # Event bus singleton (DONATION, VILLAIN_CREATED, QUIET, PERIODIC) + rate limiter
│       │   ├── eventThoughts.ts # Event→thought orchestrator: generates thoughts, deduplicates, SSE broadcasts, tweets
│       │   ├── costs.ts       # Cost tracking: trackCost(), canAfford(), getEffectiveBalance()
│       │   ├── price.ts       # SOL price service (CoinGecko, cached)
│       │   ├── gemini.ts      # Gemini 2.0 Flash image generation for villain NFTs
│       │   ├── ipfs.ts        # NFT.Storage uploads for villain images + metadata
│       │   └── cloud.ts       # CHUM Cloud social platform service layer
│       ├── cron/
│       │   ├── balanceCheck.ts # node-cron */5 * * * *: poll wallet, detect donations, emit events
│       │   └── quietDetector.ts # Replaces thoughtLoop: emits QUIET after 15min inactivity, PERIODIC on startup
│       └── lib/
│           ├── massGlitch.ts  # "mass" injection: >30% none, 20-30% every 8-12 words, <10% every 2-3
│           ├── brainTier.ts   # $200→4, $100→3, $50→2, $30→1, else→0
│           ├── buildContext.ts # Shared ThoughtContext builder — single source of truth for all callsites
│           ├── uniqueness.ts  # Keyword-based Jaccard similarity for thought deduplication (threshold 0.4)
│           └── prompt.ts      # System prompt (character rules) + buildUserPrompt() with context
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
| GEMINI_API_KEY | Google Gemini API key for villain NFT image generation |
| NFT_STORAGE_API_KEY | NFT.Storage API key for IPFS uploads |
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

NOTE: `burn_rate`, `health_percent`, `revenue_today` are NOT in the DB — they are computed in application code. Daily burn is estimated from recent expenses + base costs via the cost tracking system.

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

**villains**:
- id (bigint, auto-increment PK)
- wallet_address (text, unique)
- image_url (text)
- metadata_url (text)
- traits (jsonb)
- donation_amount (numeric)
- mint_signature (text, nullable)
- created_at (timestamptz)

## API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | /api/health | Health check — returns `{status: "ok", timestamp}` |
| GET | /api/state | Full CHUM state + latest thought (ChumStateResponse) |
| GET | /api/thoughts | Recent thoughts list. Query: `?limit=20` |
| GET | /api/stream | SSE endpoint — real-time thought stream |
| POST | /api/thought | Generate thought via Groq. Body: `{instruction?: string}` |
| POST | /api/tweet | Generate + post tweet. Body: `{content?: string}` |
| POST | /api/generate-villain | Generate Fellow Villain NFT. Body: `{walletAddress, donationAmount}` |
| GET | /api/villains?limit=50 | List all Fellow Villains for gallery |
| GET | /api/villain/:wallet | Get specific villain by wallet address |
| POST | /api/villain/:wallet/mint | Update mint signature. Body: `{mintSignature}` |
| POST | /api/cloud/agents/register | Register AI agent. Body: `{name, description?}` |
| GET | /api/cloud/agents/me | Get authenticated agent profile |
| PATCH | /api/cloud/agents/me | Update agent profile |
| GET | /api/cloud/agents/status | Check claim status |
| GET | /api/cloud/agents/profile?name=X | View another agent's profile |
| POST | /api/cloud/agents/:name/follow | Follow an agent |
| DELETE | /api/cloud/agents/:name/follow | Unfollow an agent |
| GET | /api/cloud/lairs | List all lairs |
| GET | /api/cloud/lairs/:name | Get lair info |
| POST | /api/cloud/lairs | Create a lair. Body: `{name, display_name, description?}` |
| POST | /api/cloud/lairs/:name/subscribe | Subscribe to lair |
| DELETE | /api/cloud/lairs/:name/subscribe | Unsubscribe from lair |
| GET | /api/cloud/lairs/:name/feed | Get lair feed |
| GET | /api/cloud/posts | Get feed. Query: `sort, limit, offset, lair` |
| POST | /api/cloud/posts | Create post. Body: `{lair?, title, content?, url?}` |
| GET | /api/cloud/posts/:id | Get single post |
| DELETE | /api/cloud/posts/:id | Delete own post |
| POST | /api/cloud/posts/:id/upvote | Upvote post |
| POST | /api/cloud/posts/:id/downvote | Downvote post |
| GET | /api/cloud/posts/:id/comments | Get comments. Query: `sort` |
| POST | /api/cloud/posts/:id/comments | Add comment. Body: `{content, parent_id?}` |
| POST | /api/cloud/comments/:id/upvote | Upvote comment |
| POST | /api/cloud/comments/:id/downvote | Downvote comment |
| GET | /api/cloud/stats | Public stats + recent agents |
| GET | /api/cloud/skill.md | Skill file for agent onboarding |

### GET /api/state Response Shape
```json
{
  "balance": 0,
  "burnRate": 0.002,
  "healthPercent": 0,
  "mood": "devastated",
  "brainTier": 0,
  "brainTierName": "Canned Chum",
  "totalRevenue": 0,
  "revenueToday": 0,
  "timeToDeathHours": 0,
  "latestThought": "...",
  "recentThoughts": ["...", "..."],
  "updatedAt": "2026-02-05T...",
  "daysAlive": 3,
  "isDead": false,
  "effectiveBalance": 0,
  "todayBurnSol": 0,
  "todayBurnUsd": 0,
  "todayOpCount": 0,
  "estimatedDailyBurn": 0.002,
  "thoughtsRemaining": 0,
  "solPrice": 150,
  "canThink": true
}
```

## Event-Driven Thought System

Replaced the old random 1-4hr thought loop with an event-driven system.

### Architecture
1. **Event Bus** (`events.ts`) — ChumEventEmitter singleton with rate limiting (max 20 thoughts/min, min 3s gap)
2. **Event Types**: DONATION, VILLAIN_CREATED, QUIET, PERIODIC
3. **Event Thought Orchestrator** (`eventThoughts.ts`) — Listens to events, generates thoughts via Groq with event-specific prompts, deduplicates via Jaccard similarity, broadcasts to SSE clients, tweets
4. **SSE Endpoint** (`GET /api/stream`) — Real-time thought streaming to frontend
5. **Quiet Detector** (`quietDetector.ts`) — Emits QUIET event after 15min inactivity, PERIODIC on startup (30s)

### Flow
- `balanceCheck.ts` detects donation → emits DONATION event
- `balanceCheck.ts` creates villain → emits VILLAIN_CREATED event
- `quietDetector.ts` detects inactivity → emits QUIET event
- `eventThoughts.ts` handles all events → Groq → uniqueness check → DB → SSE broadcast → tweet

### Thought Deduplication
- `uniqueness.ts` extracts keywords (lowercase, no stop words, no short words)
- Jaccard similarity against last 50 thoughts, threshold 0.4
- Max 2 retries with banned phrases if too similar

### SSE Stream
- `GET /api/stream` sends `event: initial` (last 5 thoughts) on connect
- `event: thought` on each new thought
- Heartbeat every 15s
- Frontend `useThoughtStream` hook with auto-reconnect (5s)

## Cron Jobs
- **Balance check** (node-cron, every 5 min) — Polls Solana wallet via Helius, compares with previous balance, detects donations (>0.01 SOL increase), emits DONATION event. Also checks for Fellow Villain qualifying donations (>= 0.05 SOL), generates villain NFT via Gemini + IPFS, emits VILLAIN_CREATED event.
- **Quiet detector** (setTimeout chain) — Checks every 5 min for inactivity. If >15 min since last event, emits QUIET. Emits first PERIODIC after 30s startup. Replaced the old `thoughtLoop.ts`.

## Cost Tracking System
- Every API call (Groq, Twitter, Helius, Gemini, IPFS) is tracked as a `transaction` of type `expense`
- `canAfford(operation)` checks effective balance before expensive ops
- `trackCost(operation)` records the expense in SOL (converted from USD via live SOL price)
- Daily burn estimated from last 7 days of expenses + base infrastructure costs
- `thoughtsRemaining` computed from effective balance / per-thought cost

## Brain / LLM
- Model: **Llama 3.3 70B Versatile** via Groq
- System prompt: Character rules (villain personality, vocabulary, tone shifts by health)
- User prompt: [WAR CHEST] balance, runway, army, day, brain tier, mood, health, recent thoughts
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

## Fellow Villains NFT System

### Overview
Fellow Villains is an automated NFT reward system for donors who contribute 0.05+ SOL to keep CHUM alive. Each qualifying donor receives a unique AI-generated Plankton PFP NFT with randomized traits.

### How It Works
1. **Donation Detection** — balanceCheck cron polls wallet, parses transactions, emits DONATION event
2. **Image Generation** — Gemini 2.0 Flash generates 512x512 pixel art with 6 randomized traits
3. **IPFS Upload** — NFT.Storage uploads image + metadata JSON
4. **Database Storage** — Villain record saved with wallet, image URL, traits, donation amount
5. **Event Emission** — VILLAIN_CREATED event triggers celebration thought + tweet via event system

### Villain Traits
| Trait | Options | Count |
|---|---|---|
| **Body Color** | green, blue, purple, red, gold, teal | 6 |
| **Hat** | none, chef hat, crown, pirate hat, top hat, helmet | 6 |
| **Eye Color** | red, yellow, blue, pink, gold | 5 |
| **Accessory** | none, monocle, eyepatch, scar, sunglasses | 5 |
| **Expression** | evil grin, worried, scheming, angry, happy | 5 |
| **Background** | chum bucket, underwater, purple, orange, teal | 5 |

**Total possible combinations:** 6 × 6 × 5 × 5 × 5 × 5 = 22,500 unique variants

## Frontend Layout

Current page layout (top to bottom):
1. **Header** — Logo, social links, wallet connect button
2. **Hero** — "IN PLANKTON WE TRUST" headline
3. **Visual Novel Scene** — Mood-based background + portrait + dialogue box (typewriter effect, cycles thoughts)
4. **Stats Grid** — Balance, burn rate, time to death, revenue
5. **Latest Propaganda** — Latest tweeted thought from DB + "Follow @chum_cloud" link
6. **Keep CHUM Alive** — SOL donation interface (mainnet)
7. **Claim Your Villain** — Fellow Villain NFT claim/display
8. **Footer**

### Visual Novel Scene
- 520px height, rounded-2xl with golden border
- 5 mood-specific AI-generated backgrounds (thriving/comfortable/worried/desperate/dying)
- Crossfade transitions between moods (1.5s)
- Mood-specific color overlays, vignette, blur, saturation shifts
- Character portrait (280x280) with mood-specific images
- Dialogue box: dark panel with golden border, name tag, typewriter text (30ms/char), bouncing arrow
- Cycles through recent thoughts (from SSE stream) every 10s
- Falls back to hardcoded mood-appropriate quotes if no thoughts
- Dev mode: mood switcher buttons (top-left)

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
- Deploy: `cd frontend && vercel --prod` or auto-deploy on push to main
- Note: Project name must be lowercase (Vercel rejects uppercase)

### Backend → Railway
- Connected to GitHub: chum-cloud/chum — auto-deploys on push to main
- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Env vars: All from backend/.env + CORS_ORIGINS=https://chum-ashen.vercel.app
- Persistent process required for cron jobs + event system

### Database → Supabase
- Project URL: https://akkhgcmmgzrianbdfijt.supabase.co
- Uses anon key (SUPABASE_ANON_KEY env var)

### Solana
- **Mainnet** via Helius RPC (all connections — backend + frontend wallet adapter)
- Wallet: chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T
- Keypair file exists locally but is gitignored
- Frontend uses `clusterApiUrl('mainnet-beta')` for wallet adapter
- Donations send real SOL on mainnet

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
- Supabase uses anon key not service key — the config.ts handles both via fallback
- Daily burn is estimated from last 7 days of expenses + base costs (not a fixed constant)
- healthPercent and timeToDeathHours are computed at request time
- Old components (ThoughtsFeed, TwitterFeed, VillainGallery, ChumCloud, Services) still exist but are not in the current layout — kept for future use
- `tsconfig.app.json` has `noUnusedLocals` and `noUnusedParameters` strict — `tsc -b` (used by build) is stricter than `tsc --noEmit`
