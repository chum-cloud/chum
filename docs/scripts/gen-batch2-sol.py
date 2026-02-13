#!/usr/bin/env python3
"""Generate 300 Critters + 300 SMB at full quality (60 frames/15fps).
Neutral CHUM-NNNN naming. Run Chimpers separately."""
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
PER_SOURCE = 300

CRITTERS = "CKPYygUZ9aA4JY7qmyuvxT67ibjmjpddNtHJeu1uQBSM"
SMB = "SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W"


def helius_rpc(method, params):
    url = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=30)
    return json.loads(resp.read())["result"]


def fetch_solana_nfts(collection, count):
    items = []
    page = 1
    while len(items) < count * 2:
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
    return items


def get_nft_image(item):
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

    tmpdir = tempfile.mkdtemp(prefix="chum_batch2_")
    base_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"
    work_items = []
    current_num = start_num

    # Critters
    print(f"\n=== CRITTERS (target: {PER_SOURCE}) ===", flush=True)
    critter_nfts = fetch_solana_nfts(CRITTERS, PER_SOURCE)
    random.shuffle(critter_nfts)
    added = 0
    for item in critter_nfts:
        if added >= PER_SOURCE: break
        img = get_nft_image(item)
        if not img: continue
        chum_id = f"CHUM-{current_num:04d}"
        work_items.append((current_num, chum_id, img, tmpdir))
        current_num += 1
        added += 1
    print(f"  Queued {added}", flush=True)

    # SMB
    print(f"\n=== SMB (target: {PER_SOURCE}) ===", flush=True)
    smb_nfts = fetch_solana_nfts(SMB, PER_SOURCE)
    random.shuffle(smb_nfts)
    added = 0
    for item in smb_nfts:
        if added >= PER_SOURCE: break
        img = get_nft_image(item)
        if not img: continue
        chum_id = f"CHUM-{current_num:04d}"
        work_items.append((current_num, chum_id, img, tmpdir))
        current_num += 1
        added += 1
    print(f"  Queued {added}", flush=True)

    print(f"\nTotal: {len(work_items)} items, {WORKERS} workers, 60 frames/15fps\n", flush=True)

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
                print(f"✓ [{success}/{PER_SOURCE*2}] {chum_id} (MP4:{mp4_sz//1024}KB, PNG:{png_sz//1024}KB)", flush=True)
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
