#!/usr/bin/env python3
"""Fix batch3: 94 more Beanz (retry with better gateways) + 300 Azuki Elementals (correct contract)."""
import os, sys, json, time, urllib.request, urllib.error, tempfile, shutil, random
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location(
    "ascii_nft_gen",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "ascii-nft-gen.py")
)
ascii_gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ascii_gen)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET = "art-pool"
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pool-manifest.json")

NUM_FRAMES = 60
FPS = 15
TARGET_SIZE = 1080
COLS = 80
WORKERS = 4

ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/demo"

# Correct contracts
BEANZ_CONTRACT = "0x306b1ea3ecdf94aB739F1910bbda052Ed4A9f949"
AZUKI_ELEMENTALS_CONTRACT = "0xB6a37b5d14D502c3Ab0Ae6f3a0E058BC9517786e"

IPFS_GATEWAYS = [
    "https://nft-cdn.alchemy.com/eth-mainnet/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://ipfs.io/ipfs/",
    "https://dweb.link/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
]


def fetch_eth_nfts(contract, count):
    """Fetch NFT metadata from Alchemy, preferring cached URLs."""
    items = []
    start_token = ""
    while len(items) < count * 3:  # fetch extra for failures
        url = f"{ALCHEMY_BASE}/getNFTsForContract?contractAddress={contract}&limit=100&withMetadata=true"
        if start_token:
            url += f"&startToken={start_token}"
        data = None
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                resp = urllib.request.urlopen(req, timeout=60)
                data = json.loads(resp.read())
                break
            except Exception as e:
                print(f"  retry {attempt+1}: {e}", flush=True)
                time.sleep(3 * (attempt + 1))
        if not data:
            break
        nfts = data.get("nfts", [])
        if not nfts:
            break
        for nft in nfts:
            urls = extract_all_image_urls(nft)
            if urls:
                items.append(urls)
        start_token = data.get("pageKey", "")
        if not start_token:
            break
        time.sleep(0.3)
    return items


def extract_all_image_urls(nft):
    """Extract ALL possible image URLs from Alchemy response (for fallback)."""
    urls = []
    raw_img = nft.get("image", {})
    if isinstance(raw_img, dict):
        for key in ["pngUrl", "cachedUrl", "originalUrl", "thumbnailUrl"]:
            u = raw_img.get(key, "")
            if u and not u.lower().endswith(".svg"):
                urls.append(u)
    meta = nft.get("raw", {}).get("metadata", {})
    if meta.get("image"):
        u = meta["image"]
        if not u.lower().endswith(".svg"):
            urls.append(u)
    # Dedupe while preserving order
    seen = set()
    result = []
    for u in urls:
        if u.startswith("ipfs://"):
            u = "https://ipfs.io/ipfs/" + u[7:]
        if u not in seen:
            seen.add(u)
            result.append(u)
    return result if result else None


def download_image(urls, dest):
    """Try multiple URLs/gateways to download image."""
    all_urls = []
    for url in urls:
        all_urls.append(url)
        # For IPFS URLs, add gateway alternatives
        import re
        m = re.search(r'(Qm[a-zA-Z0-9]{44,}|bafkrei[a-z0-9]+|bafybei[a-z0-9]+)', url)
        if m:
            cid = m.group(1)
            for gw in IPFS_GATEWAYS:
                alt = f"{gw}{cid}"
                if alt not in all_urls:
                    all_urls.append(alt)

    for url in all_urls[:8]:  # try up to 8 URLs
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urllib.request.urlopen(req, timeout=20)
            data = resp.read()
            if len(data) < 100:  # too small, probably error page
                continue
            with open(dest, "wb") as f:
                f.write(data)
            return True
        except:
            continue
    return False


def upload_to_supabase(filepath, filename):
    with open(filepath, "rb") as f:
        data = f.read()
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{filename}"
    for method in ["PUT", "POST"]:
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
        req.add_header("Content-Type", "video/mp4" if filename.endswith(".mp4") else "image/png")
        try:
            urllib.request.urlopen(req, timeout=60)
            return True
        except urllib.error.HTTPError as e:
            if method == "PUT" and e.code == 404: continue
            if method == "POST" and e.code == 409: return True
            if method == "POST": return False
    return False


def process_one(work_item):
    chum_id, image_urls, tmpdir = work_item
    try:
        src = os.path.join(tmpdir, f"{chum_id}_src.png")
        if not download_image(image_urls, src):
            return (chum_id, False, "download failed (all gateways)")
        out_base = os.path.join(tmpdir, chum_id)
        mp4 = out_base + ".mp4"
        png = out_base + ".png"
        ascii_gen.generate(src, out_base, cols=COLS, num_frames=NUM_FRAMES, fps=FPS, target_size=TARGET_SIZE)
        if not os.path.exists(mp4):
            return (chum_id, False, "generation failed")
        mp4_sz = os.path.getsize(mp4)
        png_sz = os.path.getsize(png)
        if not upload_to_supabase(mp4, f"{chum_id}.mp4"):
            return (chum_id, False, "mp4 upload failed")
        if not upload_to_supabase(png, f"{chum_id}.png"):
            return (chum_id, False, "png upload failed")
        for f in [src, mp4, png]:
            try: os.remove(f)
            except: pass
        return (chum_id, True, mp4_sz, png_sz)
    except Exception as e:
        return (chum_id, False, str(e))


def run_collection(name, contract, target, manifest):
    """Generate `target` pieces from an ETH collection."""
    current_num = manifest["total"] + 1
    base_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"

    print(f"\n{'='*60}", flush=True)
    print(f"=== {name} (target: {target}) ===", flush=True)
    print(f"{'='*60}", flush=True)

    images = fetch_eth_nfts(contract, target)
    print(f"  Fetched {len(images)} images", flush=True)

    if not images:
        print("  SKIP - no images found", flush=True)
        return 0, 0

    random.shuffle(images)
    batch = images[:target]

    tmpdir = tempfile.mkdtemp(prefix=f"chum_{name.lower()}_")
    work_items = []
    for img_urls in batch:
        chum_id = f"CHUM-{current_num:04d}"
        work_items.append((chum_id, img_urls, tmpdir))
        current_num += 1

    print(f"  Queued {len(work_items)}, {WORKERS} workers, {NUM_FRAMES} frames/{FPS}fps\n", flush=True)

    success = fail = 0
    new_pieces = []

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(process_one, item): item for item in work_items}
        for future in as_completed(futures):
            result = future.result()
            chum_id = result[0]
            if result[1]:
                _, _, mp4_sz, png_sz = result
                success += 1
                new_pieces.append({
                    "id": chum_id,
                    "name": f"CHUM #{int(chum_id.split('-')[1])}",
                    "mp4": f"{base_url}/{chum_id}.mp4",
                    "png": f"{base_url}/{chum_id}.png",
                    "mp4_size": mp4_sz,
                    "png_size": png_sz,
                })
                print(f"  ✓ {chum_id} (MP4:{mp4_sz//1024}KB, PNG:{png_sz//1024}KB)", flush=True)
            else:
                fail += 1
                print(f"  ✗ {chum_id}: {result[2]}", flush=True)

    new_pieces.sort(key=lambda p: p["id"])
    manifest["pieces"].extend(new_pieces)
    manifest["total"] = len(manifest["pieces"])
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n  {name}: {success}/{len(batch)}, {fail} failed", flush=True)
    print(f"  Pool total: {manifest['total']}", flush=True)

    shutil.rmtree(tmpdir, ignore_errors=True)
    return success, fail


def main():
    manifest = json.load(open(MANIFEST))
    print(f"Starting pool: {manifest['total']}", flush=True)

    total_s = total_f = 0

    # 1) Beanz fix — 94 more to make up for failures
    s, f = run_collection("BEANZ-FIX", BEANZ_CONTRACT, 94, manifest)
    total_s += s; total_f += f

    # 2) Azuki Elementals — 300 with correct contract
    s, f = run_collection("AZUKI-ELEMENTALS", AZUKI_ELEMENTALS_CONTRACT, 300, manifest)
    total_s += s; total_f += f

    # Upload final manifest
    data = json.dumps(manifest).encode()
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/pool-manifest.json"
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    urllib.request.urlopen(req, timeout=30)

    print(f"\n{'='*60}", flush=True)
    print(f"ALL DONE: {total_s} generated, {total_f} failed", flush=True)
    print(f"Total pool: {manifest['total']}", flush=True)
    print(f"{'='*60}", flush=True)


if __name__ == "__main__":
    main()
