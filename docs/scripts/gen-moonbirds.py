#!/usr/bin/env python3
"""Generate ASCII art from Moonbirds (ETH) using direct image URLs.
Moonbirds images available at: https://collection-assets.proof.xyz/moonbirds/images/{tokenId}.png
Total supply: 10,000 (token IDs 0-9999)
"""

import os, sys, json, random, time, tempfile, requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
# Load env from backend/.env manually
def load_env(path):
    env = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

_env = load_env(Path(__file__).resolve().parent.parent.parent / "backend" / ".env")
SUPABASE_URL = _env["SUPABASE_URL"]
SUPABASE_KEY = _env["SUPABASE_SERVICE_KEY"]

SCRIPTS_DIR = Path(__file__).resolve().parent
import importlib.util
spec = importlib.util.spec_from_file_location(
    "ascii_nft_gen",
    os.path.join(str(SCRIPTS_DIR), "ascii-nft-gen.py")
)
ascii_gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ascii_gen)

MANIFEST_PATH = SCRIPTS_DIR / "pool-manifest.json"
IMAGE_BASE = "https://collection-assets.proof.xyz/moonbirds/images/{}.png"
TARGET = 300
COLS = 80
NUM_FRAMES = 60
FPS = 15
TARGET_SIZE = 1080

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

def load_manifest():
    with open(MANIFEST_PATH) as f:
        return json.load(f)

def save_manifest(manifest):
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)

def upload_to_supabase(local_path, remote_name):
    ext = Path(local_path).suffix.lstrip(".")
    ct = "video/mp4" if ext == "mp4" else "image/png"
    url = f"{SUPABASE_URL}/storage/v1/object/art-pool/{remote_name}"
    with open(local_path, "rb") as f:
        r = requests.post(url, headers={**SUPABASE_HEADERS, "Content-Type": ct}, data=f)
    if r.status_code not in (200, 201):
        # Try upsert
        with open(local_path, "rb") as f:
            r = requests.put(url, headers={**SUPABASE_HEADERS, "Content-Type": ct}, data=f)
    return r.status_code in (200, 201)

def generate_one(token_id, chum_id):
    chum_name = f"CHUM-{chum_id:05d}"
    img_url = IMAGE_BASE.format(token_id)
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # Download image
        img_path = os.path.join(tmpdir, f"{token_id}.png")
        r = requests.get(img_url, timeout=30)
        if r.status_code != 200:
            return chum_name, False, f"Download failed: {r.status_code}"
        with open(img_path, "wb") as f:
            f.write(r.content)
        
        # Generate ASCII art
        out_base = os.path.join(tmpdir, chum_name)
        try:
            ascii_gen.generate(img_path, out_base, cols=COLS, num_frames=NUM_FRAMES, fps=FPS, target_size=TARGET_SIZE)
        except Exception as e:
            return chum_name, False, f"Gen failed: {e}"
        
        mp4_path = f"{out_base}.mp4"
        png_path = f"{out_base}.png"
        
        if not os.path.exists(mp4_path) or not os.path.exists(png_path):
            return chum_name, False, "Missing output files"
        
        mp4_size = os.path.getsize(mp4_path)
        png_size = os.path.getsize(png_path)
        
        # Upload
        if not upload_to_supabase(mp4_path, f"{chum_name}.mp4"):
            return chum_name, False, "MP4 upload failed"
        if not upload_to_supabase(png_path, f"{chum_name}.png"):
            return chum_name, False, "PNG upload failed"
        
        return chum_name, True, {"mp4_size": mp4_size, "png_size": png_size}

def main():
    manifest = load_manifest()
    pieces = manifest["pieces"]
    next_id = max(int(p["id"].replace("CHUM-", "")) for p in pieces) + 1
    
    # Random sample of token IDs 0-9999
    all_ids = list(range(0, 10000))
    random.shuffle(all_ids)
    token_ids = all_ids[:TARGET]
    
    success = 0
    failed = 0
    
    print(f"Generating {TARGET} Moonbirds, starting at CHUM-{next_id:05d}")
    
    for i, token_id in enumerate(token_ids):
        chum_id = next_id + i
        chum_name = f"CHUM-{chum_id:05d}"
        print(f"[{i+1}/{TARGET}] {chum_name} (Moonbird #{token_id})...", end=" ", flush=True)
        
        name, ok, info = generate_one(token_id, chum_id)
        if ok:
            success += 1
            mp4_url = f"{SUPABASE_URL}/storage/v1/object/public/art-pool/{chum_name}.mp4"
            png_url = f"{SUPABASE_URL}/storage/v1/object/public/art-pool/{chum_name}.png"
            pieces.append({
                "id": chum_name,
                "name": chum_name,
                "mp4": mp4_url,
                "png": png_url,
                "mp4_size": info["mp4_size"],
                "png_size": info["png_size"],
            })
            manifest["total"] = len(pieces)
            # Save manifest every 10
            if success % 10 == 0:
                save_manifest(manifest)
            print(f"OK ({info['mp4_size']//1024}KB)")
        else:
            failed += 1
            print(f"FAIL: {info}")
    
    # Final save
    save_manifest(manifest)
    print(f"\nDone! Success: {success}, Failed: {failed}")
    print(f"Pool total: {manifest['total']}")

if __name__ == "__main__":
    main()
