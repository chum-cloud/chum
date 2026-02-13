#!/usr/bin/env python3
"""Generate ASCII art from Chimpers NFTs (Ethereum).
Fetches via Alchemy NFT API, converts to ASCII art MP4+PNG, uploads to Supabase."""
import os, sys, json, time, urllib.request, tempfile, shutil
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location(
    "ascii_nft_gen",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "ascii-nft-gen.py")
)
ascii_gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ascii_gen)

CONTRACT = "0x80336Ad7A747236ef41F47ed2C7641828a480BAA"
ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/demo"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET = "art-pool"
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pool-manifest.json")

NUM_FRAMES = 8
FPS = 4
TARGET_SIZE = 1080
COLS = 80
MAX_GENERATE = 290


def load_manifest():
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            return json.load(f)
    return {"generated": 0, "pieces": [], "source_ids": []}


def save_manifest(m):
    with open(MANIFEST, "w") as f:
        json.dump(m, f, indent=2)


def upload_to_supabase(filepath, filename):
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None
    content_type = "video/mp4" if filename.endswith(".mp4") else "image/png"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{filename}"
    with open(filepath, "rb") as f:
        data = f.read()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_KEY}")
    req.add_header("Content-Type", content_type)
    try:
        urllib.request.urlopen(req, timeout=30)
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"
    except urllib.error.HTTPError as e:
        if e.code == 400:
            req2 = urllib.request.Request(url, data=data, method="PUT")
            req2.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_KEY}")
            req2.add_header("Content-Type", content_type)
            urllib.request.urlopen(req2, timeout=30)
            return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"
        raise


def fetch_chimpers():
    """Fetch Chimpers NFTs via Alchemy getNFTsForCollection with retry."""
    all_nfts = []
    start_token = ""
    while True:
        url = f"{ALCHEMY_BASE}/getNFTsForContract?contractAddress={CONTRACT}&withMetadata=true&limit=50"
        if start_token:
            url += f"&startToken={start_token}"
        data = None
        for attempt in range(3):
            try:
                req = urllib.request.Request(url)
                req.add_header("Accept", "application/json")
                resp = urllib.request.urlopen(req, timeout=60)
                data = json.loads(resp.read())
                break
            except Exception as e:
                print(f"  Retry {attempt+1}/3: {e}")
                time.sleep(2 * (attempt + 1))
        if not data:
            print("  Failed to fetch page, stopping")
            break
        nfts = data.get("nfts", [])
        all_nfts.extend(nfts)
        print(f"  Fetched {len(all_nfts)} so far...")
        start_token = data.get("pageKey", "")
        if not start_token or len(all_nfts) >= MAX_GENERATE * 2:
            break
        time.sleep(0.5)
    return all_nfts


def download_image(url, dest, timeout=20):
    """Download image with IPFS fallback."""
    if url.startswith("ipfs://"):
        cid = url.replace("ipfs://", "")
        url = f"https://cloudflare-ipfs.com/ipfs/{cid}"
    elif "ipfs" in url:
        import re
        m = re.search(r'(Qm[a-zA-Z0-9]{44,}|bafkrei[a-z0-9]+|bafybei[a-z0-9]+)', url)
        if m:
            url = f"https://cloudflare-ipfs.com/ipfs/{m.group(1)}"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "Mozilla/5.0")
    resp = urllib.request.urlopen(req, timeout=timeout)
    with open(dest, "wb") as f:
        f.write(resp.read())


def generate_one(token_id, img_url, idx, total):
    source_id = f"chimpers-{token_id}"
    prefix = f"chimpers-{token_id}-{int(time.time())}"
    tmpdir = tempfile.mkdtemp()
    try:
        img_path = os.path.join(tmpdir, "source.png")
        download_image(img_url, img_path)
        out_base = os.path.join(tmpdir, prefix)
        ascii_gen.generate(img_path, out_base, cols=COLS, num_frames=NUM_FRAMES, fps=FPS, target_size=TARGET_SIZE)
        mp4_path = out_base + ".mp4"
        png_path = out_base + ".png"
        mp4_size = os.path.getsize(mp4_path) if os.path.exists(mp4_path) else 0
        png_size = os.path.getsize(png_path) if os.path.exists(png_path) else 0
        mp4_url = upload_to_supabase(mp4_path, f"{prefix}.mp4") if os.path.exists(mp4_path) else None
        png_url = upload_to_supabase(png_path, f"{prefix}.png") if os.path.exists(png_path) else None
        print(f"✓ [{idx+1}/{total}] {prefix} (MP4:{mp4_size//1024}KB, PNG:{png_size//1024}KB)")
        return {
            "id": prefix,
            "source_id": source_id,
            "mp4": mp4_url or f"{prefix}.mp4",
            "png": png_url or f"{prefix}.png",
            "mp4_size": mp4_size,
            "png_size": png_size,
        }
    except Exception as e:
        print(f"✗ [{idx+1}/{total}] chimpers-{token_id}: {e}")
        return None
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    manifest = load_manifest()
    if "source_ids" not in manifest:
        manifest["source_ids"] = []
    existing_ids = set(manifest["source_ids"])

    print("Fetching Chimpers NFTs from Alchemy...")
    nfts = fetch_chimpers()
    print(f"Found {len(nfts)} Chimpers")

    to_generate = []
    for nft in nfts:
        token_id = nft.get("tokenId", "")
        source_id = f"chimpers-{token_id}"
        # Get image URL
        img_url = ""
        raw = nft.get("raw", {})
        metadata = raw.get("metadata", {})
        if metadata.get("image"):
            img_url = metadata["image"]
        elif nft.get("image", {}).get("cachedUrl"):
            img_url = nft["image"]["cachedUrl"]
        elif nft.get("image", {}).get("originalUrl"):
            img_url = nft["image"]["originalUrl"]
        if not img_url or not token_id:
            continue
        if source_id in existing_ids:
            continue
        to_generate.append((token_id, img_url))
        if len(to_generate) >= MAX_GENERATE:
            break

    print(f"\nGenerating {len(to_generate)} new Chimpers (skipped {len(nfts) - len(to_generate)} existing/no-image)")

    success = 0
    # Use ThreadPoolExecutor to avoid multiprocessing pickling issues
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {}
        for i, (tid, url) in enumerate(to_generate):
            f = executor.submit(generate_one, tid, url, i, len(to_generate))
            futures[f] = tid

        for future in as_completed(futures):
            result = future.result()
            if result:
                manifest["pieces"].append(result)
                manifest["source_ids"].append(result["source_id"])
                manifest["generated"] = len(manifest["pieces"])
                save_manifest(manifest)
                success += 1

    print(f"\n═══ DONE: {success}/{len(to_generate)} generated, total pool: {manifest['generated']} ═══")


if __name__ == "__main__":
    main()
