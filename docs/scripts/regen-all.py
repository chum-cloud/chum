#!/usr/bin/env python3
"""Regenerate Slimes + BOOGLEs + Chimpers at full quality (60 frames, 15fps).
Matches the original Madlads/Critters/SMB batch."""
import os, sys, json, time, urllib.request, tempfile, shutil, re
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location(
    "ascii_nft_gen",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "ascii-nft-gen.py")
)
ascii_gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ascii_gen)

HELIUS_API_KEY = os.environ.get("HELIUS_API_KEY", "06cda3a9-32f3-4ad9-a203-9d7274299837")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET = "art-pool"
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pool-manifest.json")

# Full quality — matches original 1000
NUM_FRAMES = 60
FPS = 15
TARGET_SIZE = 1080
COLS = 80
WORKERS = 4

# Collections to generate
CHIMPERS_CONTRACT = "0x80336Ad7A747236ef41F47ed2C7641828a480BAA"
ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/demo"
SLIMES_COLLECTION = "5pgfT25ygQ7gproWeHqJFC1LSvDR7mB7MvU8mz4kUB1K"
BOOGLE_CREATOR = "J2AQypFpiKeDnp8feiVDptnyjcEsb4noPudcjGmnp6XB"

MAX_CHIMPERS = 290
MAX_SLIMES = 999  # all
MAX_BOOGLES = 999  # all


def load_manifest():
    with open(MANIFEST) as f:
        return json.load(f)


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
        urllib.request.urlopen(req, timeout=60)
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"
    except urllib.error.HTTPError as e:
        if e.code == 400:
            req2 = urllib.request.Request(url, data=data, method="PUT")
            req2.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_KEY}")
            req2.add_header("Content-Type", content_type)
            urllib.request.urlopen(req2, timeout=60)
            return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"
        raise


def download_image(url, dest, timeout=30):
    """Download with IPFS gateway fallback."""
    if url.startswith("ipfs://"):
        cid = url.replace("ipfs://", "")
        url = f"https://cloudflare-ipfs.com/ipfs/{cid}"
    elif 'ipfs.nftstorage.link' in url or 'nftstorage.link' in url:
        m = re.search(r'(bafkrei[a-z0-9]+|bafybei[a-z0-9]+)', url)
        if m:
            url = f"https://cloudflare-ipfs.com/ipfs/{m.group(1)}"
    elif 'ipfs' in url:
        m = re.search(r'(Qm[a-zA-Z0-9]{44,}|bafkrei[a-z0-9]+|bafybei[a-z0-9]+)', url)
        if m:
            url = f"https://cloudflare-ipfs.com/ipfs/{m.group(1)}"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "Mozilla/5.0")
    resp = urllib.request.urlopen(req, timeout=timeout)
    with open(dest, "wb") as f:
        f.write(resp.read())


def helius_request(payload):
    url = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"
    data = json.dumps(payload).encode()
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=60)
            return json.loads(resp.read())
        except Exception as e:
            print(f"  Helius retry {attempt+1}/3: {e}", flush=True)
            time.sleep(2 * (attempt + 1))
    return None


def alchemy_request(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url)
            req.add_header("Accept", "application/json")
            resp = urllib.request.urlopen(req, timeout=60)
            return json.loads(resp.read())
        except Exception as e:
            print(f"  Alchemy retry {attempt+1}/3: {e}", flush=True)
            time.sleep(2 * (attempt + 1))
    return None


# ── Fetchers ──────────────────────────────────────────────

def fetch_slimes():
    print("Fetching Slimes...", flush=True)
    items = []
    page = 1
    while True:
        data = helius_request({
            "jsonrpc": "2.0", "id": "slimes",
            "method": "getAssetsByGroup",
            "params": {"groupKey": "collection", "groupValue": SLIMES_COLLECTION, "page": page, "limit": 1000}
        })
        if not data:
            break
        batch = data.get("result", {}).get("items", [])
        items.extend(batch)
        print(f"  Slimes: {len(items)}", flush=True)
        if len(batch) < 1000:
            break
        page += 1
    result = []
    for item in items:
        img = item.get("content", {}).get("links", {}).get("image", "")
        if img:
            result.append(("slimes", item["id"], img))
    return result[:MAX_SLIMES]


def fetch_boogles():
    print("Fetching BOOGLEs...", flush=True)
    items = []
    page = 1
    while True:
        data = helius_request({
            "jsonrpc": "2.0", "id": "boogles",
            "method": "searchAssets",
            "params": {"creatorAddress": BOOGLE_CREATOR, "page": page, "limit": 1000}
        })
        if not data:
            break
        batch = data.get("result", {}).get("items", [])
        items.extend(batch)
        print(f"  BOOGLEs: {len(items)}", flush=True)
        if len(batch) < 1000:
            break
        page += 1
    result = []
    for item in items:
        img = item.get("content", {}).get("links", {}).get("image", "")
        if img:
            result.append(("boogle", item["id"], img))
    return result[:MAX_BOOGLES]


def fetch_chimpers():
    print("Fetching Chimpers...", flush=True)
    all_nfts = []
    start_token = ""
    while True:
        url = f"{ALCHEMY_BASE}/getNFTsForContract?contractAddress={CHIMPERS_CONTRACT}&withMetadata=true&limit=50"
        if start_token:
            url += f"&startToken={start_token}"
        data = alchemy_request(url)
        if not data:
            break
        nfts = data.get("nfts", [])
        all_nfts.extend(nfts)
        print(f"  Chimpers: {len(all_nfts)}", flush=True)
        start_token = data.get("pageKey", "")
        if not start_token or len(all_nfts) >= MAX_CHIMPERS * 2:
            break
        time.sleep(0.5)
    result = []
    for nft in all_nfts:
        tid = nft.get("tokenId", "")
        img = ""
        raw = nft.get("raw", {}).get("metadata", {})
        if raw.get("image"):
            img = raw["image"]
        elif nft.get("image", {}).get("cachedUrl"):
            img = nft["image"]["cachedUrl"]
        elif nft.get("image", {}).get("originalUrl"):
            img = nft["image"]["originalUrl"]
        if img and tid:
            result.append(("chimpers", f"chimpers-{tid}", img))
    return result[:MAX_CHIMPERS]


# ── Generator ─────────────────────────────────────────────

def generate_one(args):
    collection, source_id, img_url, idx, total = args
    prefix = f"{collection}-{source_id[:8]}-{int(time.time())}"
    if collection == "chimpers":
        tid = source_id.replace("chimpers-", "")
        prefix = f"chimpers-{tid}-{int(time.time())}"
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
        print(f"✓ [{idx+1}/{total}] {prefix} (MP4:{mp4_size//1024}KB, PNG:{png_size//1024}KB)", flush=True)
        return {
            "id": prefix,
            "source_id": source_id,
            "source_collection": collection,
            "mp4": mp4_url or f"{prefix}.mp4",
            "png": png_url or f"{prefix}.png",
            "mp4_size": mp4_size,
            "png_size": png_size,
        }
    except Exception as e:
        print(f"✗ [{idx+1}/{total}] {prefix}: {e}", flush=True)
        return None
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    manifest = load_manifest()
    if "source_ids" not in manifest:
        manifest["source_ids"] = []
    existing_ids = set(manifest["source_ids"])

    # Fetch all sources
    all_sources = []
    all_sources.extend(fetch_slimes())
    all_sources.extend(fetch_boogles())
    all_sources.extend(fetch_chimpers())

    # Filter already generated
    to_generate = []
    for collection, source_id, img_url in all_sources:
        if source_id not in existing_ids:
            to_generate.append((collection, source_id, img_url))

    print(f"\n{'='*60}", flush=True)
    print(f"TOTAL TO GENERATE: {len(to_generate)} pieces @ 60 frames / 15fps", flush=True)
    print(f"Already in pool: {len(manifest['pieces'])}", flush=True)
    print(f"{'='*60}\n", flush=True)

    success = 0
    failed = 0
    args = [(col, sid, url, i, len(to_generate)) for i, (col, sid, url) in enumerate(to_generate)]

    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {}
        for a in args:
            f = executor.submit(generate_one, a)
            futures[f] = a[1]  # source_id

        for future in as_completed(futures):
            result = future.result()
            if result:
                manifest["pieces"].append(result)
                manifest["source_ids"].append(result["source_id"])
                manifest["generated"] = len(manifest["pieces"])
                save_manifest(manifest)
                success += 1
            else:
                failed += 1

    print(f"\n{'='*60}", flush=True)
    print(f"DONE: {success} generated, {failed} failed", flush=True)
    print(f"Total pool: {manifest['generated']}", flush=True)
    print(f"{'='*60}", flush=True)


if __name__ == "__main__":
    main()
