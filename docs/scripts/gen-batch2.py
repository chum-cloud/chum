#!/usr/bin/env python3
"""Generate 300 Critters + 300 SMB + 300 Chimpers at full quality (60 frames/15fps).
Neutral CHUM-NNNN naming, no source collection references in output."""
import os, sys, json, time, urllib.request, urllib.error, tempfile, shutil
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
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET = "art-pool"
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pool-manifest.json")

NUM_FRAMES = 60
FPS = 15
TARGET_SIZE = 1080
COLS = 80
WORKERS = 4

# Solana collections
CRITTERS = "CKPYygUZ9aA4JY7qmyuvxT67ibjmjpddNtHJeu1uQBSM"
SMB = "SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W"

# Chimpers (Ethereum)
CHIMPERS_CONTRACT = "0x80336Ad7A747236ef41F47ed2C7641828a480BAA"
ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/demo"

PER_SOURCE = 300


def helius_rpc(method, params):
    url = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=30)
    return json.loads(resp.read())["result"]


def fetch_solana_nfts(collection, count):
    """Fetch NFTs from a Solana collection via Helius DAS."""
    items = []
    page = 1
    while len(items) < count * 2:  # fetch extra for failures
        result = helius_rpc("searchAssets", {
            "grouping": ["collection", collection],
            "page": page, "limit": 1000
        })
        batch = result.get("items", [])
        if not batch:
            break
        items.extend(batch)
        page += 1
        if result.get("total", 0) <= len(items):
            break
    print(f"  Fetched {len(items)} NFTs from collection", flush=True)
    return items


def get_nft_image(item):
    """Extract image URL from DAS item."""
    content = item.get("content", {})
    links = content.get("links", {})
    if links.get("image"):
        return links["image"]
    files = content.get("files", [])
    for f in files:
        uri = f.get("uri", "")
        if any(uri.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp"]):
            return uri
    meta = content.get("metadata", {})
    if meta.get("image"):
        return meta["image"]
    json_uri = content.get("json_uri", "")
    if json_uri:
        try:
            resp = urllib.request.urlopen(json_uri, timeout=15)
            data = json.loads(resp.read())
            return data.get("image", "")
        except:
            pass
    return ""


def fetch_chimpers_nfts(count):
    """Fetch Chimpers from Ethereum via Alchemy."""
    items = []
    start_token = ""
    while len(items) < count * 2:
        url = f"{ALCHEMY_BASE}/getNFTsForContract?contractAddress={CHIMPERS_CONTRACT}&limit=50&withMetadata=true"
        if start_token:
            url += f"&startToken={start_token}"
        try:
            req = urllib.request.Request(url)
            resp = urllib.request.urlopen(req, timeout=30)
            data = json.loads(resp.read())
        except Exception as e:
            print(f"  Alchemy fetch error: {e}", flush=True)
            time.sleep(2)
            continue
        nfts = data.get("nfts", [])
        if not nfts:
            break
        for nft in nfts:
            img = ""
            raw = nft.get("image", {}) or nft.get("raw", {}).get("metadata", {})
            if isinstance(raw, dict):
                img = raw.get("pngUrl") or raw.get("cachedUrl") or raw.get("originalUrl") or raw.get("image", "")
            if not img:
                meta = nft.get("raw", {}).get("metadata", {})
                img = meta.get("image", "")
            if img:
                items.append({"id": nft.get("tokenId", ""), "image": img})
        start_token = data.get("pageKey", "")
        if not start_token:
            break
        time.sleep(0.5)
    print(f"  Fetched {len(items)} Chimpers", flush=True)
    return items


def download_image(url, dest):
    """Download image to local file."""
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urllib.request.urlopen(req, timeout=30)
            with open(dest, "wb") as f:
                shutil.copyfileobj(resp, f)
            return True
        except Exception as e:
            if attempt == 2:
                return False
            time.sleep(1)
    return False


def upload_to_supabase(filepath, filename):
    """Upload file to Supabase Storage."""
    with open(filepath, "rb") as f:
        data = f.read()
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{filename}"
    # Try update first, then create
    for method in ["PUT", "POST"]:
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        ct = "video/mp4" if filename.endswith(".mp4") else "image/png"
        req.add_header("Content-Type", ct)
        try:
            urllib.request.urlopen(req, timeout=60)
            return True
        except urllib.error.HTTPError as e:
            if method == "PUT" and e.code == 404:
                continue
            if method == "POST" and e.code == 409:
                return True  # already exists
            if method == "POST":
                return False
    return False


def process_one(work_item):
    """Generate one piece: download → ASCII → MP4+PNG → upload."""
    idx, chum_id, image_url, tmpdir = work_item
    try:
        src_path = os.path.join(tmpdir, f"{chum_id}_src.png")
        if not download_image(image_url, src_path):
            return (chum_id, False, "download failed")

        mp4_path = os.path.join(tmpdir, f"{chum_id}.mp4")
        png_path = os.path.join(tmpdir, f"{chum_id}.png")

        ascii_gen.generate_animation(
            src_path, mp4_path, png_path,
            cols=COLS, num_frames=NUM_FRAMES, fps=FPS, target_size=TARGET_SIZE
        )

        if not os.path.exists(mp4_path):
            return (chum_id, False, "generation failed")

        mp4_size = os.path.getsize(mp4_path)
        png_size = os.path.getsize(png_path)

        if not upload_to_supabase(mp4_path, f"{chum_id}.mp4"):
            return (chum_id, False, "mp4 upload failed")
        if not upload_to_supabase(png_path, f"{chum_id}.png"):
            return (chum_id, False, "png upload failed")

        # Cleanup source
        for f in [src_path, mp4_path, png_path]:
            try: os.remove(f)
            except: pass

        return (chum_id, True, mp4_size, png_size)
    except Exception as e:
        return (chum_id, False, str(e))


def main():
    # Load manifest for current count
    manifest = json.load(open(MANIFEST))
    start_num = manifest["total"] + 1
    print(f"Starting from CHUM-{start_num:04d}", flush=True)

    # Collect all existing source IDs to avoid regenerating
    # (We stripped them from manifest but they're in the old gen scripts' output)
    # For safety, just fetch new random ones

    tmpdir = tempfile.mkdtemp(prefix="chum_batch2_")
    base_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"
    work_items = []
    current_num = start_num

    # --- Critters ---
    print(f"\n=== CRITTERS (target: {PER_SOURCE}) ===", flush=True)
    critter_nfts = fetch_solana_nfts(CRITTERS, PER_SOURCE)
    import random
    random.shuffle(critter_nfts)
    for item in critter_nfts[:PER_SOURCE * 2]:  # extra for failures
        img = get_nft_image(item)
        if not img:
            continue
        chum_id = f"CHUM-{current_num:04d}"
        work_items.append((current_num, chum_id, img, tmpdir))
        current_num += 1
        if len([w for w in work_items if w[0] >= start_num]) >= PER_SOURCE * 3 + PER_SOURCE:
            break
    critter_end = len(work_items)
    print(f"  Queued {critter_end} Critters candidates", flush=True)

    # --- SMB ---
    print(f"\n=== SMB (target: {PER_SOURCE}) ===", flush=True)
    smb_nfts = fetch_solana_nfts(SMB, PER_SOURCE)
    random.shuffle(smb_nfts)
    for item in smb_nfts[:PER_SOURCE * 2]:
        img = get_nft_image(item)
        if not img:
            continue
        chum_id = f"CHUM-{current_num:04d}"
        work_items.append((current_num, chum_id, img, tmpdir))
        current_num += 1
    smb_end = len(work_items)
    print(f"  Queued {smb_end - critter_end} SMB candidates", flush=True)

    # --- Chimpers ---
    print(f"\n=== CHIMPERS (target: {PER_SOURCE}) ===", flush=True)
    chimper_nfts = fetch_chimpers_nfts(PER_SOURCE)
    random.shuffle(chimper_nfts)
    for nft in chimper_nfts[:PER_SOURCE * 2]:
        img = nft["image"]
        if img.startswith("ipfs://"):
            img = "https://ipfs.io/ipfs/" + img[7:]
        chum_id = f"CHUM-{current_num:04d}"
        work_items.append((current_num, chum_id, img, tmpdir))
        current_num += 1
    print(f"  Queued {len(work_items) - smb_end} Chimpers candidates", flush=True)

    print(f"\nTotal queued: {len(work_items)} candidates for {PER_SOURCE * 3} target", flush=True)
    print(f"Processing with {WORKERS} workers, 60 frames/15fps...\n", flush=True)

    # Process with thread pool, stop each source at PER_SOURCE successes
    success_count = 0
    fail_count = 0
    new_pieces = []

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(process_one, item): item for item in work_items}
        for future in as_completed(futures):
            result = future.result()
            chum_id = result[0]
            if result[1]:  # success
                _, _, mp4_size, png_size = result
                success_count += 1
                new_pieces.append({
                    "id": chum_id,
                    "name": f"CHUM #{int(chum_id.split('-')[1]):04d}",
                    "mp4": f"{base_url}/{chum_id}.mp4",
                    "png": f"{base_url}/{chum_id}.png",
                    "mp4_size": mp4_size,
                    "png_size": png_size,
                })
                mp4_kb = mp4_size // 1024
                png_kb = png_size // 1024
                print(f"✓ [{success_count}/{PER_SOURCE*3}] {chum_id} (MP4:{mp4_kb}KB, PNG:{png_kb}KB)", flush=True)
            else:
                fail_count += 1
                print(f"✗ {chum_id}: {result[2]}", flush=True)

            if (success_count + fail_count) % 50 == 0:
                print(f"  Progress: {success_count} done, {fail_count} failed", flush=True)

    # Sort new pieces by ID
    new_pieces.sort(key=lambda p: p["id"])

    # Update manifest
    manifest["pieces"].extend(new_pieces)
    manifest["total"] = len(manifest["pieces"])
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2)

    # Upload manifest
    data = json.dumps(manifest).encode()
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/pool-manifest.json"
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    urllib.request.urlopen(req, timeout=30)

    print(f"\n{'='*60}", flush=True)
    print(f"DONE: {success_count} generated, {fail_count} failed", flush=True)
    print(f"Total pool: {manifest['total']}", flush=True)
    print(f"{'='*60}", flush=True)

    # Cleanup
    shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == "__main__":
    main()
