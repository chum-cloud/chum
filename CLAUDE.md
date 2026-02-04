# $CHUM — AI Survival Agent on Solana

## Project Overview
$CHUM is Sheldon J. Plankton — a tiny copepod AI agent living on the Solana blockchain. He runs the Chum Bucket restaurant, burns SOL daily to survive, and depends on community donations and trading fees to stay alive. His personality, intelligence, and behavior are all driven by his financial health.

## Folder Structure
```
chum/
├── CHUM-BIBLE.md              # Character bible — personality, lore, rules
├── CLAUDE.md                  # This file
├── frontend/                  # React + TypeScript + Vite + Tailwind
│   └── src/
│       ├── hooks/useChum.ts   # Polls GET /api/state every 30s
│       ├── hooks/useAnimation.ts
│       ├── components/        # Tank, Character, StatsGrid, QuoteBar, etc.
│       └── lib/sprites.ts     # Sprite animation system
├── backend/                   # Express + TypeScript
│   └── src/
│       ├── index.ts           # Express app, CORS, route mounting, cron start
│       ├── config.ts          # Env var loading + validation
│       ├── types.ts           # Mood, BrainTier, DB row types, API response
│       ├── routes/
│       │   ├── state.ts       # GET /api/state — full CHUM state + latest thought
│       │   ├── thought.ts     # POST /api/thought — generate thought via Groq
│       │   └── tweet.ts       # POST /api/tweet — generate + post to Twitter
│       ├── services/
│       │   ├── supabase.ts    # DB client + CRUD helpers
│       │   ├── groq.ts        # LLM client (Llama 3.3 70B via Groq)
│       │   ├── twitter.ts     # Twitter API v2 posting
│       │   └── solana.ts      # Wallet balance via Helius RPC
│       ├── cron/
│       │   ├── balanceCheck.ts # Every 5 min: poll balance, detect donations, update state
│       │   └── thoughtLoop.ts  # Random 1-4hr: generate thought, 70% chance tweet
│       └── lib/
│           ├── massGlitch.ts  # Injects "mass" into text when health < 30%
│           ├── brainTier.ts   # Revenue → brain tier (0-4)
│           └── prompt.ts      # System prompt builder using CHUM-BIBLE.md
```

## How to Run

### Backend
```bash
cd backend
cp .env.example .env   # Fill in real API keys
npm install
npm run dev            # Starts on port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev            # Starts on port 5173, proxies /api → :3001
```

## Environment Variables (backend/.env)
| Variable | Description |
|---|---|
| PORT | Server port (default 3001) |
| GROQ_API_KEY | Groq API key for LLM |
| SUPABASE_URL | Supabase project URL |
| SUPABASE_SERVICE_KEY | Supabase service role key |
| HELIUS_API_KEY | Helius RPC API key for Solana |
| CHUM_WALLET_ADDRESS | Solana wallet to monitor |
| TWITTER_API_KEY | Twitter OAuth 1.0a app key |
| TWITTER_API_SECRET | Twitter OAuth 1.0a app secret |
| TWITTER_ACCESS_TOKEN | Twitter user access token |
| TWITTER_ACCESS_SECRET | Twitter user access secret |

## Supabase Tables
Run the SQL in `backend/.env.example` comments to create:
- **chum_state** — Single-row (id=1) table with balance, health, mood, brain tier
- **thoughts** — Generated thoughts with tweet status
- **transactions** — Revenue, donations, expenses, burns

## API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/state | Full CHUM state + latest thought |
| POST | /api/thought | Generate a new thought (optional `instruction` body param) |
| POST | /api/tweet | Generate + post tweet (optional `content` body param) |

## Cron Jobs
- **Balance check** — Every 5 minutes. Polls Solana wallet, detects donations, updates state, tweets celebrations.
- **Thought loop** — Random 1-4 hour intervals. Generates thoughts, 70% chance to tweet.

## Brain / LLM
- Model: **Llama 3.3 70B** via Groq
- System prompt: CHUM-BIBLE.md + character rules
- User prompt: Injected with current balance, health, mood, brain tier
- Post-processing: "mass" glitch injection when health < 30%
- All outputs truncated to 280 chars (tweet-safe)

## Brain Tiers
| Tier | Name | Monthly Revenue |
|---|---|---|
| 0 | Canned Chum | < $30 |
| 1 | Day-Old Patty | $30+ |
| 2 | Fresh Catch | $50+ |
| 3 | Krabby Patty | $100+ |
| 4 | Secret Formula | $200+ |

## Key Personality Rules
- Always stays in character as Plankton
- Never mentions being an AI
- Mood and tone shift based on financial health
- References Karen, Mr. Krabs, Krabby Patty formula
- "mass" glitch appears in speech when health drops below 30%

## Deployment Notes
- Frontend: Static deploy (Vercel/Netlify), set API URL via env
- Backend: Node.js host (Railway/Render/Fly.io), needs persistent process for crons
- Database: Supabase (hosted Postgres)
- Solana: Mainnet via Helius RPC
