#!/usr/bin/env python3
"""Generate 300 CyberKongz pieces at full quality (60 frames/15fps).
Fetches from Alchemy API, deduplicates against existing pool manifest."""
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

# CyberKongz contract
CONTRACT = "0x57a204AA1042f6E66DD7730813f4024114d74f37"
ALCHEMY_KEY = "demo"
ALCHEMY_BASE = f"https://eth-mainnet.g.alchemy.com/nft/v3/{ALCHEMY_KEY}"

def load_manifest():
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            return json.load(f)
    # Download from Supabase
    url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/pool-manifest.json"
    resp = urllib.request.urlopen(url)
    data = json.loads(resp.read())
    with open(MANIFEST, 'w') as f:
        json.dump(data, f)
    return data

def get_next_id(manifest):
    ids = [int(p['id'].replace('CHUM-', '')) for p in manifest['pieces']]
    return max(ids) + 1 if ids else 1

def upload_to_supabase(local_path, remote_name, content_type):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{remote_name}"
    with open(local_path, 'rb') as f:
        data = f.read()
    req = urllib.request.Request(url, data=data, method='POST')
    req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
    req.add_header('Content-Type', content_type)
    req.add_header('x-upsert', 'true')
    try:
        urllib.request.urlopen(req)
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{remote_name}"
    except urllib.error.HTTPError as e:
        print(f"  Upload error {e.code}: {e.read().decode()[:200]}")
        return None

def fetch_nft_images(start_token=""):
    """Fetch CyberKongz NFT image URLs from Alchemy."""
    url = f"{ALCHEMY_BASE}/getNFTsForContract?contractAddress={CONTRACT}&withMetadata=true&limit=100"
    if start_token:
        url += f"&startToken={start_token}"
    try:
        req = urllib.request.Request(url)
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read())
        images = []
        for nft in data.get('nfts', []):
            token_id = nft.get('tokenId', '')
            img = None
            if nft.get('image', {}).get('cachedUrl'):
                img = nft['image']['cachedUrl']
            elif nft.get('image', {}).get('originalUrl'):
                img = nft['image']['originalUrl']
            elif nft.get('raw', {}).get('metadata', {}).get('image'):
                img = nft['raw']['metadata']['image']
            if img and token_id:
                # Fix IPFS URLs
                if img.startswith('ipfs://'):
                    img = img.replace('ipfs://', 'https://nft-cdn.alchemy.com/eth-mainnet/')
                images.append((token_id, img))
        next_token = data.get('pageKey', '')
        return images, next_token
    except Exception as e:
        print(f"  Alchemy error: {e}")
        return [], ""

def generate_piece(token_id, img_url, chum_id, tmpdir):
    """Download image, convert to ASCII art, upload to Supabase."""
    chum_name = f"CHUM-{chum_id:04d}"
    try:
        # Download image
        img_path = os.path.join(tmpdir, f"{chum_name}_src.png")
        req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as resp:
            with open(img_path, 'wb') as f:
                f.write(resp.read())

        # Generate ASCII art
        mp4_path = os.path.join(tmpdir, f"{chum_name}.mp4")
        png_path = os.path.join(tmpdir, f"{chum_name}.png")
        
        output_base = os.path.join(tmpdir, chum_name)
        ascii_gen.generate(
            img_path, output_base,
            cols=COLS, num_frames=NUM_FRAMES,
            fps=FPS, target_size=TARGET_SIZE
        )

        if not os.path.exists(mp4_path) or os.path.getsize(mp4_path) < 10000:
            return None

        # Upload
        mp4_url = upload_to_supabase(mp4_path, f"{chum_name}.mp4", "video/mp4")
        png_url = upload_to_supabase(png_path, f"{chum_name}.png", "image/png")
        
        if mp4_url and png_url:
            return {
                "id": chum_name,
                "mp4": f"{chum_name}.mp4",
                "png": f"{chum_name}.png",
            }
    except Exception as e:
        print(f"  {chum_name} failed: {e}")
    return None

def save_manifest(manifest):
    with open(MANIFEST, 'w') as f:
        json.dump(manifest, f, indent=2)
    # Also upload to Supabase
    upload_to_supabase(MANIFEST, "pool-manifest.json", "application/json")

def main():
    manifest = load_manifest()
    next_id = get_next_id(manifest)
    print(f"Pool: {len(manifest['pieces'])} pieces, next ID: CHUM-{next_id:04d}")

    # Collect all existing source tracking (if any)
    existing_sources = set()
    for p in manifest['pieces']:
        if 'source_id' in p:
            existing_sources.add(p['source_id'])

    # Fetch CyberKongz images
    print("Fetching CyberKongz NFTs from Alchemy...")
    all_images = []
    next_token = ""
    while len(all_images) < TARGET + 100:  # fetch extra for dedup
        images, next_token = fetch_nft_images(next_token)
        all_images.extend(images)
        print(f"  Fetched {len(all_images)} so far...")
        if not next_token:
            break
        time.sleep(0.3)

    # Shuffle and deduplicate
    random.shuffle(all_images)
    candidates = []
    for token_id, img_url in all_images:
        source_key = f"cyberkongz-{token_id}"
        if source_key not in existing_sources:
            candidates.append((token_id, img_url))
            existing_sources.add(source_key)
        if len(candidates) >= TARGET:
            break

    print(f"Candidates after dedup: {len(candidates)}")

    # Generate
    done = 0
    failed = 0
    tmpdir = tempfile.mkdtemp()
    
    try:
        for i, (token_id, img_url) in enumerate(candidates):
            chum_id = next_id + done
            print(f"[{done+1}/{TARGET}] CHUM-{chum_id:04d} (kongz #{token_id})")
            
            result = generate_piece(token_id, img_url, chum_id, tmpdir)
            if result:
                manifest['pieces'].append(result)
                done += 1
                if done % 10 == 0:
                    save_manifest(manifest)
                    print(f"  Saved manifest ({len(manifest['pieces'])} total)")
            else:
                failed += 1
            
            # Cleanup temp files
            for f in os.listdir(tmpdir):
                os.remove(os.path.join(tmpdir, f))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
        save_manifest(manifest)

    print(f"\nDone! Generated: {done}, Failed: {failed}")
    print(f"Pool total: {len(manifest['pieces'])}")

if __name__ == "__main__":
    main()
