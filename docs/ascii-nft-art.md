# ASCII NFT Art Generator

## Overview
Converts Solana NFT PFPs into animated Matrix Rain ASCII art as self-contained HTML files.

## Project Root
`/Users/makoto/documents/chum/docs/` — all docs live here.

## Working Collections (3)

| Collection | Address | Image Host |
|---|---|---|
| Madlads | `J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w` | S3 (AWS) |
| Critters | `CKPYygUZ9aA4JY7qmyuvxT67ibjmjpddNtHJeu1uQBSM` | ? |
| SMB (Solana Monkey Business) | `SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W` | ? |

### Rejected Collections
- **Crypto Undeads** (`undCCwvNJueKKgeYNJfqPSLqBwax4wMPPF6vNAJFwrb`) — IPFS unpinned, images dead
- **LILY** (`ATDB6H3M3pzS7iTNiBeqxGbxmwx9nJZWLsvHjC8J7QrX`) — Shadow Drive down (524 errors)
- **Tensorians** (`AswzrwAprpTVEcKZ71wzVNrLWgtBYD7Kkw6dRqdqCiXf`) — was old address, replaced by Crypto Undeads which is dead

## Generated HTML Files
Location: `/Users/makoto/.openclaw/workspace/ascii-animations/`
- `madlads.html` — Mad Lads #3101
- `critters.html`
- `smb.html`
- (tensorians.html — to be removed/replaced)

## Pipeline
1. Fetch random NFT from collection via **Helius DAS API** (`getAssetsByGroup`)
2. Download image
3. Resize to 80 cols, convert to ASCII using brightness ramp
4. Apply green color map (HSV remap: hue 0.12-0.52, saturation 0.6+, brightness +35%)
5. BG removal: sample top-left + top-right 15% patches, MEDIAN, adaptive threshold
6. Generate self-contained HTML with canvas animation:
   - Characters flicker (every 3 frames, 15% of cells change)
   - Matrix rain streaks (white-green heads, spawn 0.08 rate, max 30)

## Scripts
- `/tmp/ascii-color-v3.py` — static color ASCII PNG
- `/tmp/ascii-anim.py` — animated GIF version
- `/tmp/gen-ascii-html.py` — HTML canvas animation generator

## API Keys
- **Helius:** `06cda3a9-32f3-4ad9-a203-9d7274299837`
