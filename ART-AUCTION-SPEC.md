# 🎨 CHUM: AI Art Auction Protocol
## Complete Blueprint & Build Prompt (v5 — FINAL)

---

# 🖼️ SECTION 0: ART GENERATION PIPELINE

---

## Art Source

ASCII art generated from 3 Solana NFT collections. The source NFT is completely unrecognizable in the output — this is original derivative art.

| Collection | Address | Image Host |
|---|---|---|
| Madlads | `J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w` | S3 (AWS) |
| Critters | `CKPYygUZ9aA4JY7qmyuvxT67ibjmjpddNtHJeu1uQBSM` | Arweave |
| SMB | `SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W` | Arweave |

### Rejected Collections (images dead)
- Crypto Undeads (`undCCwvNJueKKgeYNJfqPSLqBwax4wMPPF6vNAJFwrb`) — IPFS unpinned
- LILY (`ATDB6H3M3pzS7iTNiBeqxGbxmwx9nJZWLsvHjC8J7QrX`) — Shadow Drive down
- Tensorians — was actually Crypto Undeads address

## Pipeline

```
 SOURCE NFT IMAGE (fetched via Helius DAS API)
       │
       ▼
 ASCII CONVERSION (80 columns)
   ├─ Resize to 80 cols, proportional rows
   ├─ Contrast boost (1.4x) + Sharpness (2.0x)
   ├─ Edge detection overlay for detail
   ├─ BG removal: top-left + top-right 15% patches, MEDIAN, adaptive threshold (55-100)
   ├─ 70-char brightness ramp mapping
   └─ Green color map: HSV remap (hue 0.12-0.52, saturation 0.6+, brightness +40%)
       │
       ▼
 ANIMATION RENDERING (60 frames @ 1080x1080px)
   ├─ Font: Menlo 14pt (crisp at 1080px)
   ├─ Character flickering: 12% of cells swap each frame (shape/colors preserved)
   ├─ Matrix rain streaks: 25 max, white-green heads, fading green tails
   ├─ True black background (#000000)
   ├─ Pad to square + nearest-neighbor upscale to 1080x1080
   └─ Frame 0 saved as PNG thumbnail
       │
       ▼
 ENCODING
   ├─ MP4: ffmpeg libx264, CRF 23, yuv420p, preset slow, faststart (~1.5MB)
   └─ PNG: first frame, optimized (~350KB)
       │
       ▼
 POOL (Supabase Storage)
   ├─ Pre-generated, stored in bucket
   └─ Refilled via cron when pool runs low
       │
       ▼
 MINT (on-demand)
   ├─ Grab MP4 + PNG from pool
   ├─ Upload both to Arweave (minter pays, ~$0.015 total)
   ├─ Create JSON metadata on Arweave
   └─ Mint Metaplex Core NFT with Arweave URI
```

## Output Format

**MP4 + PNG** (not GIF). MP4 gives better quality at smaller file size with no 256 color limit.

- `image` → PNG thumbnail (static, ~350KB) — displayed on marketplaces as preview
- `animation_url` → MP4 animation (60 frames, ~1.5MB) — plays on Magic Eden, Tensor, Phantom

## Naming Convention

```
CHUM: Reanimated #0001
CHUM: Reanimated #0002
...
```

**NO reference to source NFT name or collection.** No "Mad Lads #7972". The output is original art.

Sequential numbering based on mint order (tracked by `config.total_minted`).

## Metadata Format

```json
{
  "name": "CHUM: Reanimated #0001",
  "symbol": "CHUM",
  "description": "AI-generated ASCII art from the CHUM Art Auction. In Plankton We Trust.",
  "image": "https://arweave.net/<png-hash>",
  "animation_url": "https://arweave.net/<mp4-hash>",
  "external_url": "https://chum.cloud",
  "attributes": [
    { "trait_type": "Status", "value": "Artwork" }
  ],
  "properties": {
    "files": [
      { "uri": "https://arweave.net/<png-hash>", "type": "image/png" },
      { "uri": "https://arweave.net/<mp4-hash>", "type": "video/mp4" }
    ],
    "category": "video"
  }
}
```

The `uri` parameter in `mint_art` points to this Arweave JSON metadata file.

## Storage & Costs

| Component | Storage | Cost |
|---|---|---|
| Pre-gen pool | Supabase Pro (100GB) | $25/mo (already have) |
| On-chain metadata | Arweave | ~$0.015 per mint (minter pays) |
| NFT rent | Solana | ~0.015 SOL per mint (minter pays) |

## Scripts

Located at `/Users/makoto/documents/chum/docs/scripts/`:
- `ascii-nft-gen.py` — **main generator** (MP4 + PNG output, 1080x1080, 60 frames)
- `ascii-gif-gen.py` — legacy GIF generator (deprecated, kept for reference)

## Pool System

```
┌──────────────────────────────────────────────────────┐
│                    ART POOL                          │
│                                                      │
│  Supabase Storage bucket: "reanimated"               │
│                                                      │
│  Each pool item:                                     │
│    pool_id (uuid)                                    │
│    mp4_path (storage path)                           │
│    png_path (storage path)                           │
│    source_collection (madlads|critters|smb)          │
│    status (available|claimed|minted)                 │
│    created_at                                        │
│    claimed_by (wallet address, on mint)              │
│                                                      │
│  Cron: refill pool when available < 10               │
│  Target: 50+ items in pool at all times              │
│  Generation: ~30s per item (fetch + render + encode) │
│                                                      │
│  On mint:                                            │
│    1. Claim random pool item (status → claimed)      │
│    2. Upload MP4 + PNG to Arweave                    │
│    3. Create JSON metadata on Arweave                │
│    4. Mint NFT with Arweave URI                      │
│    5. Mark pool item as minted                       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

# 🎨 SECTION 0: ART GENERATION PIPELINE

---

## Art Source

ASCII art generated from 3 NFT collections:
- **Madlads:** `J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w`
- **Critters:** `CKPYygUZ9aA4JY7qmyuvxT67ibjmjpddNtHJeu1uQBSM`
- **SMB:** `SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W`

## Pipeline

1. Fetch random NFT image from one of 3 collections via Helius DAS API
2. Convert to 80-col ASCII art with green color mapping (HSV remap: hue 0.12-0.52, saturation 0.6+, brightness boost)
3. BG removal: top-left + top-right 15% patches, MEDIAN, adaptive threshold
4. Render 60 frames at 1080x1080px with matrix rain overlay + character flickering
5. Output: MP4 (animation_url) + PNG thumbnail (image)
6. MP4 encoded with ffmpeg libx264, CRF 23, yuv420p
7. Optimized with gifsicle for GIF fallback if needed

## Output Format: MP4 + PNG (not GIF)

- MP4 for `animation_url` in metadata (~1.5MB per file)
- PNG for `image` in metadata (~350KB per file)
- Both uploaded to Arweave at mint time (minter pays)

## Naming

`CHUM: Reanimated #0001` (sequential). NO reference to source NFT name/collection.

## Pool System

Pre-generated art stored in Supabase Storage bucket. Pool refilled via cron. On mint: grab from pool → upload to Arweave → mint NFT.

## Metadata Format

```json
{
  "name": "CHUM: Reanimated #0001",
  "image": "https://arweave.net/<png-hash>",
  "animation_url": "https://arweave.net/<mp4-hash>",
  "attributes": [
    { "trait_type": "Status", "value": "Artwork" }
  ]
}
```

## Scripts

Located at `/Users/makoto/documents/chum/docs/scripts/`:
- `ascii-nft-gen.py` — main generator (MP4 + PNG output)
- `ascii-gif-gen.py` — legacy GIF generator (deprecated, kept for reference)

## Storage

- **Pool:** Supabase Pro Storage (100GB)
- **On-chain:** Arweave (permanent, ~$0.015 per mint, paid by minter)

## Rejected Collections (images dead)

- **Crypto Undeads** — IPFS unpinned
- **LILY** — Shadow Drive down
- **Tensorians** — was actually Crypto Undeads address

---

# 📦 SECTION 1: SYSTEM OVERVIEW FOR HUMANS

---

## What Is This?

A daily loop where:
1. Anyone pays 0.015 SOL to mint AI art NFT (they OWN it)
2. Creator pays 0.015 SOL to "Join" the leaderboard (one-time per NFT, stays forever)
3. Community votes on the best art (3 voter tiers)
4. Top voted art wins
5. Winning art NFT goes to a 4-hour auction
6. Auction winner receives the art NFT, upgraded to "Founder Key" status
7. Creator gets 60% of auction revenue
8. Losing art resets votes to 0, auto re-enters next epoch (no extra fee)
9. Creator can withdraw their NFT anytime between epochs
10. Repeat forever

**Revenue share for staked holders is coming in v2.**
**v1 = voting power only. No staking. No revenue claims.**

---

## 🏛️ One Collection, Two Statuses

```
┌─────────────────────────────────────────────────────────┐
│              SINGLE COLLECTION: "CHUM: ARTWORK"         │
│                                                         │
│  Every NFT lives here. No separate collections.         │
│  The difference is the STATUS ATTRIBUTE.                │
│                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  STATUS: "Artwork"  │  │  STATUS: "Founder Key"   │  │
│  │                     │  │                          │  │
│  │  • Anyone can mint  │  │  • Only auction winners  │  │
│  │  • Can trade    ✅  │  │  • Can trade         ✅  │  │
│  │  • Can join     ✅  │  │  • Can vote (free)   ✅  │  │
│  │  • Can stake    ❌  │  │  • Can stake (v2)    🔜  │  │
│  │  • Can vote     ❌  │  │  • Can earn (v2)     🔜  │  │
│  │  • Can earn     ❌  │  │                          │  │
│  │                     │  │  Scarce: 1 per day max   │  │
│  │  Unlimited supply   │  │  365 per year max        │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│                                                         │
│  PLUS: Existing "CHUM: Fellow Villains" collection      │
│  Collection: EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7  │
│  These also get free voting power (same as Founder Key) │
│  And will get staking/revenue share in v2               │
│                                                         │
│  On marketplaces (Magic Eden, Tensor):                  │
│  • All CHUM: ARTWORK NFTs show in one collection        │
│  • Buyers filter by trait "Status: Founder Key"         │
│  • Artwork floor = cheap                                │
│  • Founder Key floor = premium                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🗳️ Three Voting Tiers

```
┌─────────────────────────────────────────────────────────┐
│                    VOTING SYSTEM                        │
├──────────────────────────────────────────────────────────┤
│                                                         │
│  🔑 TIER 1: HOLDER VOTES (FREE)                        │
│     Who: Fellow Villains + Founder Key holders          │
│     How: Connect wallet → pass NFTs as proof            │
│     Power: 1 NFT in wallet = 1 free vote per day       │
│     Hold 5 NFTs = 5 free votes                         │
│     No staking needed — just hold in wallet             │
│                                                         │
│  🎨 TIER 2: MINTER VOTES (FREE)                        │
│     Who: Anyone who minted art this epoch               │
│     How: Pass ArtCandidate accounts as proof            │
│     Power: 1 mint = 1 free vote for that epoch          │
│     Mint 3 = 3 free votes                              │
│     Incentivizes creating content                       │
│                                                         │
│  👤 TIER 3: PUBLIC VOTES (PAID)                         │
│     Who: Anyone, no NFT needed                          │
│     Cost: Escalating per piece:                         │
│                                                         │
│     Votes on piece    Cost per vote                     │
│     0-9               0.002 SOL                         │
│     10-19             0.003 SOL (+50%)                  │
│     20-29             0.0045 SOL (+50%)                 │
│     30-39             0.00675 SOL (+50%)                │
│     40-49             0.010125 SOL (+50%)               │
│     50+               keeps increasing +50%             │
│                                                         │
│     Formula: 0.002 × 1.5^(piece_total_votes / 10)      │
│     Anti-whale: gets expensive fast                     │
│     Revenue: goes to treasury                           │
│                                                         │
├──────────────────────────────────────────────────────────┤
│                                                         │
│  ⚠️ ANTI-EXPLOIT: VoteReceipt PDA                       │
│                                                         │
│  Problem: Someone votes with 5 NFTs, transfers to       │
│  alt wallet, votes again with same NFTs.                │
│                                                         │
│  Solution: VoteReceipt PDA per NFT per epoch            │
│  Seeds: ["voted", mint_pubkey, epoch_le_bytes]          │
│  Created when NFT is used to vote.                      │
│  If PDA exists → that NFT already voted this epoch.     │
│  Transaction fails. Double-vote impossible.             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 💰 Fee Structure & Money Flow

```
┌─────────────────────────────────────────────────────────┐
│                  FEE STRUCTURE                          │
│                                                         │
│  MINT FEE: 0.015 SOL                                   │
│  → 100% to team/operations wallet                      │
│  → NOT shared with anyone                              │
│  → NOT in treasury                                     │
│  → This is product revenue, period.                    │
│                                                         │
│  JOIN FEE: 0.015 SOL (one-time per NFT)                │
│  → 100% to treasury                                    │
│  → Split: 50% auction reserve / 30% staker pool (v2)   │
│           / 20% growth                                 │
│                                                         │
│  PAID VOTE FEE: 0.002+ SOL (escalating)                │
│  → 100% to treasury (same split as join fee)           │
│                                                         │
│  AUCTION REVENUE:                                       │
│  → 60% to art creator (immediate)                      │
│  → 40% to treasury                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘

         JOIN FEES + PAID VOTES
                   │
                   ▼
             ┌──────────┐
             │ TREASURY  │ ◄── 40% of auction revenue
             └────┬──────┘
                  │
      DAILY SPLIT (at epoch end)
                  │
        ┌─────────┼──────────┐
        │         │          │
        ▼         ▼          ▼
   50% AUCTION  30% HOLDER  20% GROWTH
   RESERVE BID  REWARDS     OPS / DEV
   (0.2 SOL)   (v2 - TBD)
        │
        ▼
   Starting bid
   for auction

   MINT FEES (0.015 SOL each)
        │
        ▼
   TEAM WALLET (separate, not treasury)
   100% operations revenue
```

---

## 🎨 Full NFT Lifecycle

```
 USER MINTS ART (0.015 SOL → team wallet)
  │
  ├─ Gets art NFT (CHUM: ARTWORK collection)
  ├─ Metadata attribute: Status = "Artwork"
  ├─ Creator OWNS this NFT
  │
  ▼
 USER CLICKS "JOIN" (0.015 SOL → treasury, ONE TIME)
  │
  ├─ Art NFT transfers to program vault
  ├─ ArtCandidate account created on-chain
  ├─ Art enters voting leaderboard
  ├─ NFT is LOCKED during competition
  │
  ▼
 VOTING PERIOD (24h)
  │
  ├─ Holders vote free (Fellow Villains + Founder Keys)
  ├─ Minters vote free (1 mint = 1 vote)
  ├─ Public pays per vote (escalating price)
  ├─ Votes accumulate on ArtCandidate
  │
  ▼
 EPOCH ENDS — DID THIS ART WIN?
  │
  ├── NO (LOST)
  │    │
  │    ├─ Votes reset to 0
  │    ├─ NFT stays in vault
  │    ├─ Auto re-enters next epoch (FREE)
  │    ├─ OR creator withdraws NFT (free anytime)
  │    └─ No extra fee to keep competing
  │
  ├── YES (WON!)
  │    │
  │    ▼
  │  AUCTION (4 hours, 0.2 SOL reserve)
  │    │
  │    ├─ Treasury >= 0.2 SOL? → Auction starts
  │    ├─ Treasury < 0.2 SOL? → Skipped, NFT returned
  │    │
  │    ▼
  │  SETTLE
  │    │
  │    ├─ Art NFT → highest bidder
  │    ├─ NFT upgraded: Status = "Founder Key"
  │    ├─ ArtEntry created: is_founder_key = true
  │    ├─ Creator gets 60% of winning bid
  │    ├─ 40% stays in treasury
  │    │
  │    ▼
  │  AUCTION WINNER NOW HAS FOUNDER KEY
  │    │
  │    ├─ Can vote for free (1 NFT = 1 vote)
  │    ├─ Can stake + earn revenue (v2)
  │    └─ Tradeable on secondary market
  │
  ▼
 NEXT EPOCH → REPEAT
```

---

## 🚀 Bootstrap Phase vs Normal Operation

```
┌─────────────────────────────────────────────────────────┐
│                 BOOTSTRAP (Day 1-2)                     │
│                                                         │
│  • Team mints art, joins voting                         │
│  • Authority picks winner (no voters yet)               │
│  • Team bids 0.2 SOL on first auction                   │
│  • Longer auction duration (24h)                        │
│  • Creates first Founder Key                            │
│                                                         │
│  Config:                                                │
│    epoch_duration   = 86400 (24h)                       │
│    auction_duration = 86400 (24h)                       │
│    reserve_bid      = 200_000_000 (0.2 SOL)             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              NORMAL OPERATION (Day 3+)                  │
│                                                         │
│  Call update_config:                                    │
│    auction_duration = 14400 (4h)                        │
│                                                         │
│  Self-sustaining after ~14 daily joins:                 │
│  14 × 0.015 = 0.21 SOL (covers 0.2 reserve)           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│           TREASURY TOO LOW FOR 0.2 SOL?                 │
│                                                         │
│  Auction skipped. Art NFT returned to creator.          │
│  No Founder Key this epoch.                             │
│  Treasury keeps accumulating. Tries again next epoch.   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Permission Matrix

```
┌──────────────────────┬────────────┬───────────────┬──────────────┐
│ ACTION               │ WHO        │ REQUIRES      │ GATE         │
├──────────────────────┼────────────┼───────────────┼──────────────┤
│ mint_art             │ Anyone     │ 0.015 SOL     │ None         │
│ join_voting          │ Art owner  │ 0.015 SOL     │ Current epoch│
│ withdraw_art         │ Creator    │ Lost/skipped  │ Not won      │
│ vote_free            │ Holder OR  │ NFTs as proof │ VoteReceipt  │
│                      │ Minter     │               │              │
│ vote_paid            │ Anyone     │ 0.002+ SOL    │ Escalating   │
│ end_epoch            │ Anyone*    │ 24h passed    │ Time         │
│ start_auction        │ Anyone     │ Epoch ended   │ Treasury≥0.2 │
│ place_bid            │ Anyone     │ SOL           │ Auction live │
│ settle_auction       │ Anyone     │ Auction ended │ Time         │
│ update_config        │ Authority  │ Signer        │ Auth key     │
└──────────────────────┴────────────┴───────────────┴──────────────┘

* If no holders exist (bootstrap), only authority can call end_epoch

NOT IN V1: stake_nft, unstake, claim_rewards
These come in v2 with staking + revenue share.
```

---

## 📈 v1 vs v2 Scope

```
┌─────────────────────────────────────────────────────────┐
│  V1 (LAUNCH)                                            │
│                                                         │
│  ✅ mint_art (0.015 SOL → team wallet)                  │
│  ✅ join_voting (0.015 SOL → treasury, one-time)        │
│  ✅ withdraw_art (free, after epoch)                    │
│  ✅ vote_free (holders + minters, VoteReceipt PDA)      │
│  ✅ vote_paid (escalating price, anyone)                │
│  ✅ end_epoch (crank, pick winner)                      │
│  ✅ start_auction (0.2 SOL reserve or skip)             │
│  ✅ place_bid (anti-snipe)                              │
│  ✅ settle_auction (transfer + Founder Key upgrade)     │
│  ✅ update_config                                       │
│                                                         │
│  10 instructions. Clean. Shippable.                     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  V2 (LATER)                                             │
│                                                         │
│  🔜 stake_nft (lock Founder Key / Fellow Villain)       │
│  🔜 request_unstake + complete_unstake                  │
│  🔜 claim_rewards (30% treasury share)                  │
│  🔜 Revenue share activated                             │
│  🔜 StakerAccount + StakeEntry + RewardClaim accounts   │
│                                                         │
│  Tell users: "Revenue share coming. Hold your Keys."    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

---

---

# 🤖 SECTION 2: OPENCLAW BUILD PROMPT (V1 ONLY)

Copy everything below this line and send to OpenClaw.

---

---

---

# PROMPT FOR OPENCLAW

## ⚠️ CRITICAL: READ BEFORE ANYTHING

- Deploy and test ONLY on Solana DEVNET
- Do NOT deploy to mainnet
- Cluster: https://api.devnet.solana.com
- Use devnet SOL for all testing
- All program IDs will be devnet addresses

## Project: CHUM AI Art Auction Program (v1)

Build a single Anchor program on Solana devnet. The program implements a daily loop: mint art NFT → join voting leaderboard → community votes (3 tiers) → winner selected → auction → winner gets art NFT upgraded to "Founder Key" → repeat.

**v1 does NOT include staking or revenue claims.** Those come in v2. v1 is the core loop only.

Framework: Anchor (latest stable, 0.30.1)
NFT Standard: Metaplex Core (mpl-core crate 0.9.1)
Network: Solana DEVNET ONLY
Language: Rust

## Core Architecture

There is ONE Metaplex Core collection called "CHUM: ARTWORK". Every minted NFT lives in this single collection. The program's collection_auth PDA is the update authority.

Two NFT statuses exist within this one collection:
1. Status: "Artwork" — minted by anyone for 0.015 SOL. Cannot vote, cannot stake.
2. Status: "Founder Key" — only created when an auction winner's art NFT gets its metadata attribute updated. Can vote for free. Staking comes in v2.

The upgrade from "Artwork" to "Founder Key" happens on the SAME NFT. No burning. No second mint. No separate collection. Just a metadata attribute update via Metaplex Core CPI and an on-chain flag (ArtEntry.is_founder_key).

There is ALSO an existing old collection called "CHUM: Fellow Villains" at address EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7. Holders of NFTs from this collection also get free voting power (same as Founder Key holders). The program must verify NFTs from this collection during free voting.

## Two Separate Fee Destinations

CRITICAL: There are TWO separate fee flows:

1. MINT FEE (0.015 SOL) → goes to TEAM WALLET (a separate address, NOT the treasury PDA). This is product revenue. NOT shared with anyone.
2. JOIN FEE (0.015 SOL) → goes to TREASURY PDA. This funds auction reserves, future staker rewards, and growth.
3. PAID VOTE FEE (0.002+ SOL) → goes to TREASURY PDA. Same pool as join fees.
4. AUCTION REVENUE → 60% to creator, 40% to TREASURY PDA.

The Config account stores both the team_wallet address and the treasury PDA address.

## How The System Works Step By Step

1. User calls mint_art → pays 0.015 SOL to TEAM WALLET → gets art NFT with Status = "Artwork" → they OWN it
2. User calls join_voting → pays 0.015 SOL to TREASURY → art NFT transfers to program vault → ArtCandidate created → art enters leaderboard. This is a ONE-TIME fee per NFT.
3. Community votes using one of two instructions:
   a. vote_free — holders (Fellow Villains + Founder Key NFTs in wallet) and minters (ArtCandidates they created this epoch) pass NFTs as remaining_accounts proof. VoteReceipt PDAs prevent double-voting with the same NFT.
   b. vote_paid — anyone pays escalating price per vote on a specific piece. Price = 0.002 × 1.5^(piece_total_votes / 10).
4. Epoch ends → crank calls end_epoch → picks highest voted candidate (passed by client, verified on-chain), advances epoch, resets all candidate votes to 0 (candidates stay in vault, auto re-enter next epoch)
5. Crank calls start_auction → checks treasury has >= 0.2 SOL → creates Auction with 0.2 SOL reserve bid
6. If treasury < 0.2 SOL → auction skipped, art NFT returned to creator, no Founder Key this epoch
7. Users call place_bid → must beat current bid + 1%, anti-snipe extends if bid in last 5 min
8. Crank calls settle_auction → art NFT goes to highest bidder, metadata updated to Status = "Founder Key", ArtEntry created with is_founder_key = true, creator gets 60%, 40% stays in treasury
9. Losing artists can call withdraw_art anytime between epochs → get their NFT back from vault

## Hard Constraints (DO NOT VIOLATE)

1. ONE collection for new art: "CHUM: ARTWORK" — never create additional collections
2. NEVER burn any NFT
3. NEVER create separate membership/founder tokens
4. NEVER sort or iterate large account sets on-chain — winner passed by client, verified on-chain
5. NEVER use unwrap() — use require!() or checked math
6. NEVER trust frontend — all logic enforced on-chain
7. Founder Key upgrade = metadata attribute update on SAME NFT, not a new mint
8. Reserve bid is FIXED at 0.2 SOL (200_000_000 lamports), not a percentage
9. Update authority for the CHUM: ARTWORK collection MUST be the program's collection_auth PDA
10. Use safe math everywhere (checked_add, checked_sub, checked_mul, checked_div)
11. Mint fee goes to TEAM WALLET, NOT treasury. These are separate.
12. Join fee and paid vote fees go to TREASURY PDA.
13. VoteReceipt PDA MUST be created for every NFT used in vote_free to prevent double-voting after transfer.
14. Fellow Villains collection (EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7) must be recognized for free voting.

## Accounts (implement EXACTLY these)

### Config
- Seeds: ["config"]
- Use InitSpace derive
- Fields:
  - authority: Pubkey (who can call update_config and end_epoch during bootstrap)
  - team_wallet: Pubkey (where mint fees go — separate from treasury)
  - collection: Pubkey (Metaplex Core collection "CHUM: ARTWORK")
  - fellow_villains_collection: Pubkey (old collection EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7)
  - mint_fee: u64 (default 15_000_000 = 0.015 SOL)
  - join_fee: u64 (default 15_000_000 = 0.015 SOL)
  - base_vote_price: u64 (default 2_000_000 = 0.002 SOL)
  - current_epoch: u64 (starts at 1)
  - epoch_duration: i64 (default 86400 = 24h)
  - auction_duration: i64 (default 14400 = 4h, 86400 for bootstrap)
  - reserve_bid: u64 (fixed 200_000_000 = 0.2 SOL)
  - total_minted: u64 (all art NFTs ever)
  - total_founder_keys: u64 (only auction winners — max 1/day)
  - last_epoch_start: i64
  - paused: bool
  - treasury_bump: u8
  - art_vault_bump: u8
  - collection_authority_bump: u8

### ArtCandidate (created when user clicks "Join")
- Seeds: ["candidate", mint_pubkey]
- Fields:
  - mint: Pubkey (the art NFT locked in vault)
  - creator: Pubkey
  - votes: u32 (reset to 0 each epoch by end_epoch)
  - epoch_joined: u64 (which epoch first joined — does NOT change)
  - won: bool (true if selected as epoch winner)
  - withdrawn: bool (true if creator took NFT back)
  - bump: u8
- NOTE: Once joined, the NFT stays on the leaderboard forever. Votes reset daily. No extra fee to re-enter. The epoch_joined field records when they first joined, not the current epoch.

### ArtEntry (only for Founder Key winners)
- Seeds: ["art", mint_pubkey]
- Fields:
  - mint: Pubkey
  - creator: Pubkey
  - is_founder_key: bool (always true)
  - epoch_won: u64
  - bump: u8
- CRITICAL: Only exists for winning NFTs. is_founder_key is the on-chain gate for free voting (and staking in v2).

### VoteReceipt (anti-exploit: prevents double-voting with same NFT)
- Seeds: ["voted", mint_pubkey, epoch_number_as_le_bytes]
- Fields:
  - mint: Pubkey
  - epoch: u64
  - voter: Pubkey (who used this NFT to vote)
  - bump: u8
- Created when an NFT (Fellow Villain or Founder Key) is used in vote_free.
- If this PDA already exists for that NFT+epoch combo, the vote transaction fails.
- This prevents: holder votes with NFT → transfers to alt wallet → alt wallet tries to vote with same NFT → FAILS because VoteReceipt exists.
- NOTE: VoteReceipts are small accounts. They accumulate over time. Consider closing old ones in v2 or making them zero-data (just existence check via init).

### EpochState (snapshot per daily epoch)
- Seeds: ["epoch", epoch_number_as_le_bytes]
- Fields:
  - epoch: u64
  - start_time: i64
  - end_time: i64
  - winner_mint: Pubkey (the winning art NFT's address)
  - finalized: bool (true after end_epoch)
  - auction_started: bool
  - auction_skipped: bool
  - bump: u8
- NOTE: In v1, no reward_pool or total_staked_snapshot fields needed (no staking yet). Add in v2.

### Auction
- Seeds: ["auction", epoch_number_as_le_bytes]
- Fields:
  - epoch: u64
  - art_mint: Pubkey
  - art_creator: Pubkey (for 60% settlement payout)
  - reserve_bid: u64 (always 0.2 SOL)
  - current_bid: u64
  - current_bidder: Pubkey
  - start_time: i64
  - end_time: i64 (extendable via anti-snipe)
  - bid_count: u32
  - settled: bool
  - bump: u8

### PDA Vaults (SystemAccounts — no data)
- Treasury: Seeds ["treasury"] — holds join fees, paid vote fees, and 40% auction revenue
- Art Vault: Seeds ["art_vault"] — holds art NFTs during voting and auction. Signs Metaplex Core TransferV1 CPIs. (Renamed from "stake_vault" since there's no staking in v1)
- Collection Authority: Seeds ["collection_auth"] — update authority for "CHUM: ARTWORK" collection. Signs CreateV1 and UpdatePluginV1 CPIs.

## Instructions (implement EXACTLY these — 10 total for v1)

### 1. initialize
- Signer: authority
- Creates: Config account
- Parameters: team_wallet (Pubkey), collection (Pubkey), fellow_villains_collection (Pubkey), mint_fee (u64), join_fee (u64), base_vote_price (u64), epoch_duration (i64), auction_duration (i64), reserve_bid (u64)
- Validation: mint_fee > 0, join_fee > 0, base_vote_price > 0, all durations > 0, reserve_bid > 0
- Sets: current_epoch = 1, last_epoch_start = Clock::get().unix_timestamp, paused = false, total_minted = 0, total_founder_keys = 0
- Stores PDA bumps for treasury, art_vault, and collection_auth

### 2. mint_art
- Signer: creator (anyone)
- Parameters: name (String, max 50), uri (String, max 200) — uri points to Arweave JSON metadata containing both `image` (PNG) and `animation_url` (MP4) — uri points to an Arweave JSON metadata file containing both `image` (PNG) and `animation_url` (MP4). See Section 0: Art Generation Pipeline for format.
- MUST: Transfer config.mint_fee from creator to config.team_wallet (NOT treasury) via system_program::transfer
- MUST: CPI to Metaplex Core CreateV1:
  - Collection: config.collection ("CHUM: ARTWORK")
  - Name: the name parameter
  - URI: the uri parameter
  - Owner: creator (they own their art)
  - Update authority: collection_auth PDA
  - Add Attributes plugin: [{ trait_type: "Status", value: "Artwork" }]
  - Sign with collection_auth PDA seeds: ["collection_auth", &[config.collection_authority_bump]]
- Constraint: config.paused == false
- Increment: config.total_minted += 1

### 3. join_voting
- Signer: creator (must own the art NFT)
- Creates: ArtCandidate account with seeds ["candidate", mint_pubkey]
- MUST: Transfer config.join_fee from creator to treasury PDA via system_program::transfer
- MUST: CPI to Metaplex Core TransferV1: transfer art NFT from creator to art_vault PDA
- Sets: mint, creator, votes = 0, epoch_joined = config.current_epoch, won = false, withdrawn = false
- Constraint: config.paused == false

### 4. withdraw_art
- Signer: creator
- Required accounts: ArtCandidate, asset, art_vault, Config, collection (optional), mpl_core_program
- Validation: candidate.creator == signer
- Validation: candidate.won == false (cannot withdraw a winner)
- Validation: candidate.withdrawn == false
- MUST: CPI to Metaplex Core TransferV1 (signed by art_vault PDA): return art NFT to creator
- Set: candidate.withdrawn = true
- NOTE: No fee to withdraw. Creator gets their NFT back. The join fee is NOT refunded.

### 5. vote_free
- Signer: voter
- Parameters: num_votes (u32) — how many votes to cast on the target piece
- Required accounts: ArtCandidate (the piece being voted on), Config
- Additional remaining_accounts: NFTs as proof of voting power
- The remaining_accounts contain TWO types of proof:
  
  TYPE A — Holder NFTs (Fellow Villains OR Founder Key):
  For each NFT passed:
  - Verify NFT owner == signer (the voter must hold it in their wallet)
  - Verify NFT belongs to either config.fellow_villains_collection OR config.collection with "Founder Key" status
  - For Founder Key verification: pass the ArtEntry account and check is_founder_key == true
  - Create VoteReceipt PDA with seeds ["voted", nft_mint, epoch_le_bytes]
  - If VoteReceipt already exists → skip this NFT (already used this epoch)
  - Each valid NFT = 1 free vote

  TYPE B — Minter ArtCandidates:
  For each ArtCandidate passed:
  - Verify candidate.creator == signer
  - Verify candidate.epoch_joined <= config.current_epoch (joined before or during this epoch)
  - Verify candidate.won == false, candidate.withdrawn == false
  - Create VoteReceipt PDA with seeds ["voted", candidate.mint, epoch_le_bytes]
  - If VoteReceipt already exists → skip this candidate
  - Each valid candidate = 1 free vote

- Total free votes = count of valid holder NFTs + count of valid minter candidates
- SAFETY: Clamp num_votes to available free votes. If num_votes > total_free, use total_free. If num_votes == 0, use 1.
- Action: target_candidate.votes += actual_votes
- Validation: target_candidate.won == false, target_candidate.withdrawn == false
- NOTE: Voters cannot vote for their own art if it's used as minter proof in the same transaction. However, this is hard to enforce cheaply. Acceptable for v1 — revisit in v2 if exploited.

### 6. vote_paid
- Signer: voter (anyone, no NFT required)
- Parameters: num_votes (u32) — how many paid votes to cast
- Required accounts: ArtCandidate (the piece being voted on), Config, Treasury
- Validation: target_candidate.won == false, target_candidate.withdrawn == false
- Validation: num_votes > 0
- Calculate cost using escalating formula:
  - For each vote i from 0 to num_votes-1:
    - current_piece_votes = target_candidate.votes + i
    - tier = current_piece_votes / 10
    - price_for_this_vote = base_vote_price × 1.5^tier
  - total_cost = sum of all individual vote prices
  - Use u128 intermediate math to prevent overflow
  - IMPORTANT: To compute 1.5^tier without floating point, use the formula:
    price = base_vote_price × 3^tier / 2^tier
    This is exact integer math. Compute 3^tier and 2^tier as u128, multiply base by 3^tier, then divide by 2^tier.
- Transfer: total_cost from voter to treasury via system_program::transfer
- Action: target_candidate.votes += num_votes

### 7. end_epoch
- Signer: anyone (crank bot)
- Creates: EpochState account
- Required accounts: the winning ArtCandidate (passed by client), Config
- Validation: Clock >= config.last_epoch_start + config.epoch_duration
- Validation: winning_candidate.won == false
- Validation: winning_candidate.withdrawn == false
- BOOTSTRAP: if no Founder Keys exist AND no Fellow Villains have voted this epoch (effectively: first epochs), only config.authority can call this
- Do NOT sort or iterate accounts. Client picks winner off-chain. Program only validates.
- Set: winning_candidate.won = true
- Set: epoch_state.winner_mint = winning_candidate.mint
- Set: epoch_state.finalized = true, auction_started = false, auction_skipped = false
- Set: epoch_state.start_time = config.last_epoch_start, end_time = Clock timestamp
- Advance: config.current_epoch += 1, config.last_epoch_start = Clock timestamp
- NOTE: Votes on ALL non-winning candidates are effectively reset because vote_free and vote_paid check the candidate exists and is active, and VoteReceipt PDAs are per-epoch. However, the votes field on ArtCandidate is NOT automatically reset by end_epoch (that would require iterating all candidates). Instead, the client-side leaderboard simply ignores stale vote counts. For the NEXT epoch's winner selection, the client reads fresh votes accumulated in the new epoch. To make this work cleanly: vote_free and vote_paid should only increment votes if the voter's VoteReceipt is for the CURRENT epoch. Since VoteReceipts are per-epoch, old votes don't carry over — the leaderboard frontend tracks per-epoch votes off-chain.

ACTUALLY, SIMPLER APPROACH: Keep votes on ArtCandidate as a running total. But end_epoch records epoch_state.winner_mint. For next epoch's winner selection, the client compares each candidate's votes with what they had at the previous epoch end (tracked off-chain or via indexer). The on-chain program doesn't need to reset votes — it just picks the candidate with the most votes as passed by the client and validates it hasn't already won.

SIMPLEST APPROACH (USE THIS): Do NOT reset votes on-chain. The ArtCandidate.votes is a cumulative total. Each epoch, the crank bot (client) reads all candidates' current votes, subtracts what they had at previous epoch end (tracked in the bot's database), and picks the one with the most NEW votes this epoch. The program just validates: candidate exists, not won, not withdrawn. This keeps the program simple and avoids iterating candidates.

### 8. start_auction
- Signer: anyone (crank bot)
- Parameters: epoch (u64)
- Creates: Auction account (conditionally)
- Required accounts: EpochState, ArtCandidate (winner), Config, Treasury
- Validation: epoch_state.finalized == true, epoch_state.auction_started == false, epoch_state.auction_skipped == false
- CHECK: available = treasury.lamports() - rent_exempt_minimum
- IF available < config.reserve_bid:
  - Set epoch_state.auction_skipped = true
  - CPI Metaplex Core TransferV1 (signed by art_vault PDA): return art NFT to candidate.creator
  - Log: "Auction skipped — treasury below reserve bid"
  - Return Ok(())
- IF available >= config.reserve_bid:
  - Create Auction account
  - Set all fields: epoch, art_mint, art_creator, reserve_bid = config.reserve_bid
  - Set: current_bid = config.reserve_bid, current_bidder = Pubkey::default(), bid_count = 0
  - Set: start_time = now, end_time = now + config.auction_duration, settled = false
  - Set: epoch_state.auction_started = true

### 9. place_bid
- Signer: bidder
- Parameters: epoch (u64), bid_amount (u64)
- Required accounts: Auction, Treasury, previous bidder account (if bid_count > 0)
- Validation: auction.settled == false
- Validation: Clock < auction.end_time
- Calculate: min_bid = auction.current_bid * 101 / 100
- Validation: bid_amount >= min_bid
- Transfer: bid_amount from bidder to treasury via system_program::transfer
- Refund previous bidder: if bid_count > 0, validate previous_bidder.key() == auction.current_bidder, transfer auction.current_bid from treasury to previous_bidder (direct lamport manipulation)
- ANTI-SNIPE: if (auction.end_time - now) < 300, set auction.end_time = now + 300
- Update: current_bid = bid_amount, current_bidder = bidder.key(), bid_count += 1

### 10. settle_auction
- Signer: anyone (crank bot)
- Parameters: epoch (u64)
- Required accounts: Auction, ArtCandidate, Config, Treasury, asset (art NFT), winner account, creator account, collection, art_vault, collection_auth, mpl_core_program
- Validation: auction.settled == false, Clock >= auction.end_time
- IF bid_count > 0:
  - CPI TransferV1 (signed by art_vault PDA): art NFT → auction.current_bidder
  - creator_share = auction.current_bid * 60 / 100
  - Transfer creator_share from treasury to auction.art_creator (lamport manipulation)
  - 40% stays in treasury
  - CPI UpdatePluginV1 (signed by collection_auth PDA): change NFT attribute "Status" from "Artwork" to "Founder Key"
  - Create ArtEntry: mint, creator = auction.art_creator, is_founder_key = true, epoch_won = auction.epoch
  - config.total_founder_keys += 1
- IF bid_count == 0:
  - CPI TransferV1 (signed by art_vault PDA): return art NFT to candidate.creator
  - No payouts, no Founder Key upgrade
  - Log: "No bidders. Art returned to creator."
- Set: auction.settled = true

### 11. update_config
- Signer: authority
- Validation: signer == config.authority
- All parameters are Option<T>:
  - mint_fee, join_fee, base_vote_price: Option<u64>
  - epoch_duration, auction_duration: Option<i64>
  - reserve_bid: Option<u64>
  - paused: Option<bool>
  - team_wallet: Option<Pubkey>
- Apply only fields that are Some()

## Metaplex Core CPI Details

Use mpl-core crate version 0.9.1 with features = ["serde"].

1. CreateV1CpiBuilder — in mint_art
   - Collection: config.collection
   - Owner: creator
   - Attributes plugin: [{ trait_type: "Status", value: "Artwork" }]
   - Signed by collection_auth PDA: ["collection_auth", &[config.collection_authority_bump]]

2. TransferV1CpiBuilder — in join_voting, withdraw_art, start_auction (skip path), settle_auction
   - join_voting: authority = creator (signer), new_owner = art_vault
   - withdraw_art: authority = art_vault PDA (signed), new_owner = creator
   - start_auction (skip): authority = art_vault PDA (signed), new_owner = creator
   - settle_auction (winner): authority = art_vault PDA (signed), new_owner = auction winner
   - settle_auction (no bids): authority = art_vault PDA (signed), new_owner = creator
   - art_vault PDA signature: ["art_vault", &[config.art_vault_bump]]

3. UpdatePluginV1CpiBuilder — in settle_auction
   - Updates Attributes plugin: "Status" from "Artwork" to "Founder Key"
   - Signed by collection_auth PDA: ["collection_auth", &[config.collection_authority_bump]]

## Fellow Villains Collection Verification

In vote_free, when a remaining_account NFT claims to be from the Fellow Villains collection:
- The NFT is a Metaplex Core asset
- Load the asset account data
- Check that the asset's collection field matches config.fellow_villains_collection
- Check that the asset's owner field matches the signer (voter)
- If both pass, it's a valid Fellow Villain NFT → 1 free vote
- Create VoteReceipt PDA for this NFT+epoch to prevent reuse

For Founder Key verification:
- Check the asset's collection field matches config.collection (CHUM: ARTWORK)
- Check the ArtEntry PDA exists for this mint AND art_entry.is_founder_key == true
- Check the asset's owner field matches the signer
- Create VoteReceipt PDA

## Error Codes

```
SystemPaused
InvalidFee — "Fee must be greater than 0"
InvalidDuration — "Duration must be greater than 0"
InvalidReserveBid — "Reserve bid must be greater than 0"
NotOwner — "Not the owner of this NFT"
NotCreator — "Not the creator of this art"
AlreadyWon — "Candidate already won"
AlreadyWithdrawn — "Art already withdrawn"
CannotWithdrawWinner — "Cannot withdraw winning art"
WrongCollection — "NFT not from recognized collection"
NotFounderKey — "NFT is not a Founder Key"
AlreadyVotedThisEpoch — "This NFT already voted this epoch"
InvalidVoteCount — "Vote count must be greater than 0"
InsufficientPayment — "Insufficient SOL for paid votes"
EpochNotOver — "Epoch duration not passed yet"
EpochNotFinalized — "Epoch not finalized"
AuctionAlreadyStarted — "Auction already started"
AuctionSkipped — "Auction was skipped"
InsufficientTreasury — "Treasury below reserve bid"
AuctionSettled — "Auction already settled"
AuctionNotEnded — "Auction still active"
BidTooLow — "Bid must be at least 1% above current"
WrongPreviousBidder — "Wrong previous bidder account"
Unauthorized — "Not the authority"
BootstrapOnly — "Only authority can end epoch during bootstrap"
NameTooLong — "Name exceeds 50 characters"
UriTooLong — "URI exceeds 200 characters"
MathOverflow — "Math overflow"
```

## Default Config Values

Bootstrap:
```
mint_fee = 15_000_000 (0.015 SOL)
join_fee = 15_000_000 (0.015 SOL)
base_vote_price = 2_000_000 (0.002 SOL)
epoch_duration = 86_400 (24h)
auction_duration = 86_400 (24h — long for bootstrap)
reserve_bid = 200_000_000 (0.2 SOL)
```

Normal (call update_config):
```
auction_duration = 14_400 (4h)
```

Devnet testing:
```
mint_fee = 15_000_000
join_fee = 15_000_000
base_vote_price = 2_000_000
epoch_duration = 300 (5 min)
auction_duration = 120 (2 min)
reserve_bid = 200_000_000
```

## File Structure

```
programs/chum-auction/src/
├── lib.rs                     (entrypoint, 10 instruction handlers + 1 update_config = 11 total)
├── state/
│   └── mod.rs                 (Config, ArtCandidate, ArtEntry, VoteReceipt,
│                               EpochState, Auction)
├── instructions/
│   ├── mod.rs
│   ├── initialize.rs
│   ├── mint_art.rs
│   ├── join_voting.rs
│   ├── withdraw_art.rs
│   ├── vote_free.rs           (holders + minters, remaining_accounts pattern)
│   ├── vote_paid.rs           (escalating price, anyone)
│   ├── end_epoch.rs
│   ├── start_auction.rs
│   ├── place_bid.rs
│   ├── settle_auction.rs
│   └── update_config.rs
```

## Dependencies (Cargo.toml)

```toml
[package]
name = "chum-auction"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]
name = "chum_auction"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []

[dependencies]
anchor-lang = { version = "0.30.1", features = ["init-if-needed"] }
anchor-spl = "0.30.1"
mpl-core = { version = "0.9.1", features = ["serde"] }
```

## Testing (DEVNET ONLY)

Use short durations: epoch = 5 min, auction = 2 min.

### Test Flow:
1. initialize with devnet config + team_wallet + both collection addresses
2. mint_art — verify NFT created with Status: Artwork, verify 0.015 SOL went to TEAM WALLET (not treasury)
3. join_voting — verify NFT transferred to vault, verify 0.015 SOL went to TREASURY, verify ArtCandidate created
4. Mint + join with multiple wallets
5. vote_free with a Fellow Villain NFT — verify VoteReceipt created, verify votes incremented
6. vote_free again with SAME NFT — should FAIL (VoteReceipt exists)
7. Transfer Fellow Villain to alt wallet, try vote_free — should FAIL (VoteReceipt exists for that NFT)
8. vote_paid — verify escalating price calculation, verify SOL went to treasury
9. vote_paid on a piece with 10+ votes — verify price is 0.003 SOL (50% increase)
10. BOOTSTRAP: end_epoch as authority (no voters have Founder Keys yet)
11. start_auction — verify 0.2 SOL reserve, verify treasury had enough
12. place_bid — test anti-snipe near end
13. settle_auction — verify:
    a. NFT transferred to winner
    b. Status attribute changed to "Founder Key"
    c. ArtEntry created with is_founder_key = true
    d. Creator received 60%
    e. 40% stayed in treasury
14. vote_free with the new Founder Key — should work
15. withdraw_art with a losing candidate — verify NFT returned
16. Test treasury too low → start_auction skips, NFT returned to creator

### Edge Cases:
- mint_art when paused → FAIL
- join_voting with NFT you don't own → FAIL
- withdraw winner art → FAIL
- vote_free with random non-collection NFT → FAIL
- vote_paid with 0 votes → FAIL
- bid below minimum → FAIL
- settle before auction ends → FAIL
- end_epoch before duration → FAIL
- end_epoch as non-authority during bootstrap → FAIL

## REMINDER: DEVNET ONLY. DO NOT DEPLOY TO MAINNET.
