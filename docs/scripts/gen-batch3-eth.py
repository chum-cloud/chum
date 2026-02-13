#!/usr/bin/env python3
"""Generate 300 pieces from each of 6 ETH collections at full quality (60 frames/15fps).
Neutral CHUM-NNNN naming, no source collection references in output."""
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
PER_COLLECTION = 300

ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/demo"

# 6 ETH collections — contract addresses
COLLECTIONS = [
    ("GENUINE-UNDEAD",    "0x209e639a0EC166Ac7a1A4bA41968fa967dB30221"),
    ("BEANZOFFICIAL",     "0x306b1ea3ecdf94aB739F1910bbda052Ed4A9f949"),
    ("AZUKIELEMENTALS",   "0xB6a37b5d14D502c3Ab17A01544F5E04e0F3FCA5b"),
    ("CLONEX",            "0x49cF6f5d44E70224e2E23fDcdd2C053F30aDA28B"),
    ("PUDGYPENGUINS",     "0xBd3531dA5CF5857e7CfAA92426877b022e612cf8"),
    ("MOONBIRDS",         "0x23581767a106ae21c074b2276D25e5C3e136a68b"),
]


def fetch_eth_nfts(contract, count):
    """Fetch NFT metadata from Alchemy in batches of 100."""
    items = []
    start_token = ""
    while len(items) < count * 2:
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
            print("  Fetch failed after retries, stopping", flush=True)
            break
        nfts = data.get("nfts", [])
        if not nfts:
            break
        for nft in nfts:
            img = extract_image(nft)
            if img:
                items.append(img)
        start_token = data.get("pageKey", "")
        if not start_token:
            break
        time.sleep(0.3)
    return items


def extract_image(nft):
    """Extract usable image URL from Alchemy NFT response."""
    img = ""
    raw_img = nft.get("image", {})
    if isinstance(raw_img, dict):
        img = raw_img.get("pngUrl") or raw_img.get("cachedUrl") or raw_img.get("originalUrl") or ""
    if not img:
        meta = nft.get("raw", {}).get("metadata", {})
        img = meta.get("image", "")
    if not img:
        return None
    if img.startswith("ipfs://"):
        img = "https://ipfs.io/ipfs/" + img[7:]
    # Skip SVG
    if img.lower().endswith(".svg"):
        return None
    return img


def download_image(url, dest):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            resp = urllib.request.urlopen(req, timeout=30)
            with open(dest, "wb") as f:
                shutil.copyfileobj(resp, f)
            return True
        except:
            if attempt == 2: return False
            time.sleep(1)
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
    chum_id, image_url, tmpdir = work_item
    try:
        src = os.path.join(tmpdir, f"{chum_id}_src.png")
        if not download_image(image_url, src):
            return (chum_id, False, "download failed")
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


def main():
    manifest = json.load(open(MANIFEST))
    current_num = manifest["total"] + 1
    base_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"

    total_success = 0
    total_fail = 0

    for coll_name, contract in COLLECTIONS:
        print(f"\n{'='*60}", flush=True)
        print(f"=== {coll_name} (target: {PER_COLLECTION}) ===", flush=True)
        print(f"{'='*60}", flush=True)

        images = fetch_eth_nfts(contract, PER_COLLECTION)
        print(f"  Fetched {len(images)} images", flush=True)

        if len(images) == 0:
            print(f"  SKIP - no images found", flush=True)
            continue

        random.shuffle(images)
        batch = images[:PER_COLLECTION]
        print(f"  Queued {len(batch)}, {WORKERS} workers, {NUM_FRAMES} frames/{FPS}fps\n", flush=True)

        tmpdir = tempfile.mkdtemp(prefix=f"chum_{coll_name.lower()}_")
        work_items = []
        for img_url in batch:
            chum_id = f"CHUM-{current_num:04d}"
            work_items.append((chum_id, img_url, tmpdir))
            current_num += 1

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

        # Sort and append to manifest after each collection
        new_pieces.sort(key=lambda p: p["id"])
        manifest["pieces"].extend(new_pieces)
        manifest["total"] = len(manifest["pieces"])
        with open(MANIFEST, "w") as f:
            json.dump(manifest, f, indent=2)

        total_success += success
        total_fail += fail
        print(f"\n  {coll_name}: {success}/{len(batch)} generated, {fail} failed", flush=True)
        print(f"  Pool total: {manifest['total']}", flush=True)

        shutil.rmtree(tmpdir, ignore_errors=True)

    # Upload final manifest
    data = json.dumps(manifest).encode()
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/pool-manifest.json"
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    urllib.request.urlopen(req, timeout=30)

    print(f"\n{'='*60}", flush=True)
    print(f"ALL DONE: {total_success} generated, {total_fail} failed", flush=True)
    print(f"Total pool: {manifest['total']}", flush=True)
    print(f"{'='*60}", flush=True)


if __name__ == "__main__":
    main()
