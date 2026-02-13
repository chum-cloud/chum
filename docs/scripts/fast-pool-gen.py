#!/usr/bin/env python3
"""Fast Batch ASCII Art Pool Generator — parallelized, fewer frames.
Usage: python3 fast-pool-gen.py --count 30 --workers 4
"""
import os, sys, json, random, tempfile, shutil, subprocess, argparse, time
import urllib.request, urllib.error
from multiprocessing import Pool as MPPool, cpu_count

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location(
    "ascii_nft_gen",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "ascii-nft-gen.py")
)
ascii_gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ascii_gen)

SOURCE_COLLECTIONS = [
    {"address": "J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w"},
    {"address": "CKPYygUZ9aA4JY7qmyuvxT67ibjmjpddNtHJeu1uQBSM"},
    {"address": "SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W"},
]

HELIUS_API_KEY = os.environ.get("HELIUS_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET = "art-pool"

NUM_FRAMES = 8
FPS = 4
TARGET_SIZE = 1080
COLS = 80


def helius_rpc(method, params):
    url = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"
    payload = json.dumps({"jsonrpc":"2.0","id":"pool","method":method,"params":params}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def fetch_random_nfts(collection_address, count=10):
    page = random.randint(1, 50)
    result = helius_rpc("getAssetsByGroup", {
        "groupKey":"collection","groupValue":collection_address,
        "page":page,"limit":count*2,
    })
    items = result.get("result",{}).get("items",[])
    random.shuffle(items)
    return items[:count]


def get_nft_image_url(item):
    content = item.get("content",{})
    links = content.get("links",{})
    if links.get("image"): return links["image"]
    files = content.get("files",[])
    for f in files:
        if f.get("mime","").startswith("image/"): return f.get("uri")
    metadata = content.get("metadata",{})
    if metadata.get("image"): return metadata["image"]
    json_uri = content.get("json_uri","")
    if json_uri:
        try:
            req = urllib.request.Request(json_uri, headers={"User-Agent":"CHUM/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                meta = json.loads(resp.read())
                return meta.get("image","")
        except: pass
    return None


def download_image(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent":"CHUM/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        with open(dest,"wb") as f: f.write(resp.read())
    return os.path.getsize(dest) > 0


def upload_to_supabase(local_path, remote_path, content_type):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{remote_path}"
    result = subprocess.run([
        "curl","-s","-X","POST",url,
        "-H",f"Authorization: Bearer {SUPABASE_SERVICE_KEY}",
        "-H",f"Content-Type: {content_type}",
        "-H","x-upsert: true",
        "--data-binary",f"@{local_path}",
    ], capture_output=True, text=True, timeout=60)
    try:
        data = json.loads(result.stdout)
        if "error" in data or "statusCode" in data: return None
    except: pass
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{remote_path}"


def process_single_nft(args):
    """Worker function: download, generate, upload one NFT."""
    nft, tmpdir, seq_num = args
    nft_id = nft.get("id","unknown")[:8]
    image_url = get_nft_image_url(nft)
    if not image_url:
        return None

    img_path = os.path.join(tmpdir, f"src_{nft_id}_{os.getpid()}.png")
    try:
        download_image(image_url, img_path)
    except:
        return None

    piece_id = f"CHUM-{nft_id}-{int(time.time())}-{os.getpid()}"
    output_base = os.path.join(tmpdir, piece_id)
    try:
        mp4_path, png_path = ascii_gen.generate(
            img_path, output_base,
            cols=COLS, num_frames=NUM_FRAMES, fps=FPS, target_size=TARGET_SIZE
        )
    except Exception as e:
        print(f"  ✗ {nft_id} gen failed: {e}", flush=True)
        return None

    mp4_size = os.path.getsize(mp4_path) / 1024
    png_size = os.path.getsize(png_path) / 1024

    mp4_url = upload_to_supabase(mp4_path, f"{piece_id}.mp4", "video/mp4")
    png_url = upload_to_supabase(png_path, f"{piece_id}.png", "image/png")

    if not mp4_url or not png_url:
        return None

    # Clean up local files
    for p in [img_path, mp4_path, png_path]:
        try: os.remove(p)
        except: pass
    # Clean frame dir
    frame_dir = os.path.join(tmpdir, f"ascii_frames_*")
    
    print(f"  ✓ {piece_id} (MP4:{mp4_size:.0f}KB, PNG:{png_size:.0f}KB)", flush=True)
    return {
        "piece_id": piece_id, "mp4_url": mp4_url, "png_url": png_url,
        "mp4_size_kb": round(mp4_size), "png_size_kb": round(png_size),
    }


def generate_pool(count=30, workers=4):
    if not HELIUS_API_KEY or not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: Set env vars"); sys.exit(1)

    print(f"═══ Fast Art Pool Generator ═══", flush=True)
    print(f"Target: {count} | Frames: {NUM_FRAMES} | Workers: {workers}\n", flush=True)

    per_collection = count // len(SOURCE_COLLECTIONS)
    remainder = count % len(SOURCE_COLLECTIONS)
    
    # Gather all NFT work items
    work_items = []
    tmpdir = tempfile.mkdtemp(prefix="chum_fast_pool_")
    seq_num = 0

    for i, col in enumerate(SOURCE_COLLECTIONS):
        n = per_collection + (1 if i < remainder else 0)
        print(f"── Source {i+1} ({n} pieces) ──", flush=True)
        nfts = fetch_random_nfts(col["address"], n * 2)
        print(f"  Fetched {len(nfts)} candidates", flush=True)
        for nft in nfts[:n]:
            seq_num += 1
            work_items.append((nft, tmpdir, seq_num))

    # Process in parallel
    print(f"\n🚀 Processing {len(work_items)} items with {workers} workers...", flush=True)
    results = []
    
    # Use sequential for now since ascii_gen may not be fork-safe
    for i, item in enumerate(work_items):
        result = process_single_nft(item)
        if result:
            results.append(result)
        print(f"  Progress: {i+1}/{len(work_items)} ({len(results)} success)", flush=True)

    shutil.rmtree(tmpdir, ignore_errors=True)

    # Update manifest
    manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pool-manifest.json")
    existing = {"generated":0,"failed":0,"pieces":[]}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path) as f: existing = json.load(f)
        except: pass
    existing_ids = {p["piece_id"] for p in existing["pieces"]}
    for r in results:
        if r["piece_id"] not in existing_ids:
            existing["pieces"].append(r)
    existing["generated"] = len(existing["pieces"])
    with open(manifest_path,"w") as f:
        json.dump(existing, f, indent=2)

    print(f"\n═══ DONE: {len(results)}/{count} generated, total: {existing['generated']} ═══", flush=True)
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=30)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()
    generate_pool(args.count, args.workers)
