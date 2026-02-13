#!/usr/bin/env python3
"""Generate ASCII art for ALL BOOGLE NFTs (by creator J2AQy...).
Uses searchAssets since BOOGLEs have no on-chain collection."""
import os, sys, json, time, urllib.request, tempfile, shutil
from multiprocessing import Pool as MPPool, cpu_count

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location(
    "ascii_nft_gen",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "ascii-nft-gen.py")
)
ascii_gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ascii_gen)

CREATOR = "J2AQypFpiKeDnp8feiVDptnyjcEsb4noPudcjGmnp6XB"
HELIUS_API_KEY = os.environ.get("HELIUS_API_KEY", "06cda3a9-32f3-4ad9-a203-9d7274299837")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET = "art-pool"
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pool-manifest.json")

NUM_FRAMES = 8
FPS = 4
TARGET_SIZE = 1080
COLS = 80


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


def fetch_all_boogles():
    url = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"
    all_items = []
    page = 1
    while True:
        payload = json.dumps({
            "jsonrpc": "2.0", "id": "boogles",
            "method": "searchAssets",
            "params": {"creatorAddress": CREATOR, "page": page, "limit": 1000}
        }).encode()
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read())
        items = data.get("result", {}).get("items", [])
        all_items.extend(items)
        if len(items) < 1000:
            break
        page += 1
    return all_items


def download_image(url, dest, timeout=20):
    """Download with timeout and IPFS gateway fallback."""
    # Rewrite IPFS URLs to faster gateway
    if 'ipfs.nftstorage.link' in url or 'nftstorage.link' in url:
        # Extract CID from subdomain format: https://bafkrei....ipfs.nftstorage.link
        import re
        m = re.search(r'(bafkrei[a-z0-9]+)', url)
        if m:
            url = f"https://cloudflare-ipfs.com/ipfs/{m.group(1)}"
    elif url.startswith('https://bafkrei'):
        import re
        m = re.search(r'(bafkrei[a-z0-9]+)', url)
        if m:
            url = f"https://cloudflare-ipfs.com/ipfs/{m.group(1)}"
    
    req = urllib.request.Request(url)
    req.add_header('User-Agent', 'Mozilla/5.0')
    resp = urllib.request.urlopen(req, timeout=timeout)
    with open(dest, 'wb') as f:
        f.write(resp.read())


def generate_one(args):
    asset_id, img_url, idx, total = args
    prefix = f"boogle-{asset_id[:8]}-{int(time.time())}"
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
            "source_id": asset_id,
            "mp4": mp4_url or f"{prefix}.mp4",
            "png": png_url or f"{prefix}.png",
            "mp4_size": mp4_size,
            "png_size": png_size,
        }
    except Exception as e:
        print(f"✗ [{idx+1}/{total}] {asset_id[:8]}: {e}")
        return None
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    manifest = load_manifest()
    if "source_ids" not in manifest:
        manifest["source_ids"] = []
    existing_ids = set(manifest["source_ids"])

    print("Fetching all BOOGLE NFTs...")
    items = fetch_all_boogles()
    print(f"Found {len(items)} BOOGLEs")

    to_generate = []
    for item in items:
        asset_id = item["id"]
        img_url = item.get("content", {}).get("links", {}).get("image", "")
        if not img_url:
            continue
        if asset_id in existing_ids:
            print(f"  Skip {asset_id[:8]}: already generated")
            continue
        to_generate.append((asset_id, img_url))

    print(f"\nGenerating {len(to_generate)} new pieces (skipped {len(items) - len(to_generate)})")

    args = [(aid, url, i, len(to_generate)) for i, (aid, url) in enumerate(to_generate)]
    workers = min(4, cpu_count())
    success = 0

    with MPPool(workers) as pool:
        for result in pool.imap_unordered(generate_one, args):
            if result:
                manifest["pieces"].append(result)
                manifest["source_ids"].append(result["source_id"])
                manifest["generated"] = len(manifest["pieces"])
                save_manifest(manifest)
                success += 1

    print(f"\n═══ DONE: {success}/{len(to_generate)} generated, total pool: {manifest['generated']} ═══")


if __name__ == "__main__":
    main()
