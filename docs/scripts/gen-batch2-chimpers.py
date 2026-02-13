#!/usr/bin/env python3
"""Generate 300 Chimpers at full quality (60 frames/15fps). Neutral CHUM-NNNN naming."""
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
TARGET = 300

CHIMPERS_CONTRACT = "0x80336Ad7A747236ef41F47ed2C7641828a480BAA"
ALCHEMY_BASE = "https://eth-mainnet.g.alchemy.com/nft/v3/demo"


def fetch_chimpers():
    """Fetch Chimpers metadata from Alchemy in batches of 50."""
    items = []
    start_token = ""
    while len(items) < TARGET * 2:
        url = f"{ALCHEMY_BASE}/getNFTsForContract?contractAddress={CHIMPERS_CONTRACT}&limit=50&withMetadata=true"
        if start_token:
            url += f"&startToken={start_token}"
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                resp = urllib.request.urlopen(req, timeout=30)
                data = json.loads(resp.read())
                break
            except Exception as e:
                print(f"  Alchemy retry {attempt+1}: {e}", flush=True)
                time.sleep(3 * (attempt + 1))
        else:
            print("  Alchemy fetch failed after 3 retries, stopping", flush=True)
            break

        nfts = data.get("nfts", [])
        if not nfts:
            break
        for nft in nfts:
            img = ""
            raw_img = nft.get("image", {})
            if isinstance(raw_img, dict):
                img = raw_img.get("pngUrl") or raw_img.get("cachedUrl") or raw_img.get("originalUrl") or ""
            if not img:
                meta = nft.get("raw", {}).get("metadata", {})
                img = meta.get("image", "")
            if img:
                if img.startswith("ipfs://"):
                    img = "https://ipfs.io/ipfs/" + img[7:]
                items.append({"id": nft.get("tokenId", ""), "image": img})
        start_token = data.get("pageKey", "")
        if not start_token:
            break
        time.sleep(0.3)
        if len(items) % 100 < 50:
            print(f"  Fetched {len(items)} so far...", flush=True)
    return items


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
    idx, chum_id, image_url, tmpdir = work_item
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
    start_num = manifest["total"] + 1
    print(f"Starting from CHUM-{start_num:04d}", flush=True)

    print(f"\n=== CHIMPERS (target: {TARGET}) ===", flush=True)
    chimpers = fetch_chimpers()
    print(f"  Total fetched: {len(chimpers)}", flush=True)
    random.shuffle(chimpers)

    tmpdir = tempfile.mkdtemp(prefix="chum_chimpers_")
    base_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"
    work_items = []
    current_num = start_num

    for nft in chimpers[:TARGET]:
        chum_id = f"CHUM-{current_num:04d}"
        work_items.append((current_num, chum_id, nft["image"], tmpdir))
        current_num += 1

    print(f"  Queued {len(work_items)}", flush=True)
    print(f"\nProcessing with {WORKERS} workers, 60 frames/15fps\n", flush=True)

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
                    "name": f"CHUM #{int(chum_id.split('-')[1]):04d}",
                    "mp4": f"{base_url}/{chum_id}.mp4",
                    "png": f"{base_url}/{chum_id}.png",
                    "mp4_size": mp4_sz,
                    "png_size": png_sz,
                })
                print(f"✓ [{success}/{TARGET}] {chum_id} (MP4:{mp4_sz//1024}KB, PNG:{png_sz//1024}KB)", flush=True)
            else:
                fail += 1
                print(f"✗ {chum_id}: {result[2]}", flush=True)

    new_pieces.sort(key=lambda p: p["id"])
    manifest["pieces"].extend(new_pieces)
    manifest["total"] = len(manifest["pieces"])
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=2)

    data = json.dumps(manifest).encode()
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/pool-manifest.json"
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    urllib.request.urlopen(req, timeout=30)

    print(f"\n{'='*60}", flush=True)
    print(f"DONE: {success} generated, {fail} failed", flush=True)
    print(f"Total pool: {manifest['total']}", flush=True)
    print(f"{'='*60}", flush=True)
    shutil.rmtree(tmpdir, ignore_errors=True)

if __name__ == "__main__":
    main()
