#!/usr/bin/env python3
"""Batch ASCII Art Pool Generator
Fetches random NFTs from 3 collections via Helius DAS,
runs them through the ASCII pipeline, uploads MP4 + PNG to Supabase Storage.

Usage: python3 batch-pool-gen.py --count 30
Env: HELIUS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
import os, sys, json, random, tempfile, shutil, subprocess, argparse, time
import urllib.request, urllib.error

# Add parent dir so we can import ascii-nft-gen
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the ASCII pipeline
import importlib.util
spec = importlib.util.spec_from_file_location(
    "ascii_nft_gen",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "ascii-nft-gen.py")
)
ascii_gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ascii_gen)

# ─── Config ───
COLLECTIONS = [
    {"name": "madlads", "address": "J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w"},
    {"name": "critters", "address": "CKPYygUZ9aA4JY7qmyuvxT67ibjmjpddNtHJeu1uQBSM"},
    {"name": "smb", "address": "SMBtHCCC6RYRutFEPb4gZqeBLUZbMNhRKaMKZZLHi7W"},
]

HELIUS_API_KEY = os.environ.get("HELIUS_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET = "art-pool"


def helius_rpc(method, params):
    """Call Helius DAS RPC."""
    url = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": "pool-gen",
        "method": method,
        "params": params,
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def fetch_random_nfts(collection_address, count=10):
    """Fetch random NFTs from a collection via Helius DAS."""
    # Get a random page of assets
    page = random.randint(1, 50)  # Collections have many pages
    result = helius_rpc("getAssetsByGroup", {
        "groupKey": "collection",
        "groupValue": collection_address,
        "page": page,
        "limit": count * 2,  # Fetch extra in case some have dead images
    })
    items = result.get("result", {}).get("items", [])
    random.shuffle(items)
    return items[:count]


def download_image(url, dest):
    """Download an image to a local path."""
    req = urllib.request.Request(url, headers={
        "User-Agent": "CHUM-ArtPool/1.0",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        with open(dest, "wb") as f:
            f.write(resp.read())
    return os.path.getsize(dest) > 0


def upload_to_supabase(local_path, remote_path, content_type):
    """Upload a file to Supabase Storage via REST API."""
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{remote_path}"
    result = subprocess.run([
        "curl", "-s", "-X", "POST", url,
        "-H", f"Authorization: Bearer {SUPABASE_SERVICE_KEY}",
        "-H", f"Content-Type: {content_type}",
        "-H", "x-upsert: true",
        "--data-binary", f"@{local_path}",
    ], capture_output=True, text=True, timeout=60)
    resp = result.stdout
    try:
        data = json.loads(resp)
        if "error" in data or "statusCode" in data:
            print(f"  ⚠ Upload error: {resp}")
            return None
    except json.JSONDecodeError:
        pass
    # Return public URL
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{remote_path}"


def get_nft_image_url(item):
    """Extract the image URL from a Helius DAS asset."""
    content = item.get("content", {})
    
    # Try json_uri metadata first
    links = content.get("links", {})
    if links.get("image"):
        return links["image"]
    
    # Try files
    files = content.get("files", [])
    for f in files:
        if f.get("mime", "").startswith("image/"):
            return f.get("uri")
    
    # Try metadata image
    metadata = content.get("metadata", {})
    if metadata.get("image"):
        return metadata["image"]
    
    # Fallback to json_uri and fetch metadata
    json_uri = content.get("json_uri", "")
    if json_uri:
        try:
            req = urllib.request.Request(json_uri, headers={"User-Agent": "CHUM-ArtPool/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                meta = json.loads(resp.read())
                return meta.get("image", "")
        except:
            pass
    
    return None


def create_bucket_if_needed():
    """Create the Supabase Storage bucket if it doesn't exist."""
    # Check if bucket exists
    result = subprocess.run([
        "curl", "-s",
        f"{SUPABASE_URL}/storage/v1/bucket/{BUCKET}",
        "-H", f"Authorization: Bearer {SUPABASE_SERVICE_KEY}",
    ], capture_output=True, text=True, timeout=10)
    
    try:
        data = json.loads(result.stdout)
        if data.get("name") == BUCKET:
            print(f"✓ Bucket '{BUCKET}' exists")
            return True
    except:
        pass
    
    # Create bucket
    result = subprocess.run([
        "curl", "-s", "-X", "POST",
        f"{SUPABASE_URL}/storage/v1/bucket",
        "-H", f"Authorization: Bearer {SUPABASE_SERVICE_KEY}",
        "-H", "Content-Type: application/json",
        "-d", json.dumps({
            "id": BUCKET,
            "name": BUCKET,
            "public": True,
        }),
    ], capture_output=True, text=True, timeout=10)
    print(f"Created bucket '{BUCKET}': {result.stdout}")
    return True


def generate_pool(count=30):
    """Main: generate ASCII art pool."""
    if not HELIUS_API_KEY or not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: Set HELIUS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY env vars")
        sys.exit(1)

    print(f"═══ CHUM Art Pool Generator ═══")
    print(f"Target: {count} pieces across {len(COLLECTIONS)} collections\n")

    create_bucket_if_needed()

    # Distribute evenly across collections
    per_collection = count // len(COLLECTIONS)
    remainder = count % len(COLLECTIONS)
    
    generated = 0
    failed = 0
    results = []
    tmpdir = tempfile.mkdtemp(prefix="chum_pool_")
    
    try:
        for i, col in enumerate(COLLECTIONS):
            n = per_collection + (1 if i < remainder else 0)
            print(f"\n── {col['name'].upper()} ({n} pieces) ──")
            
            nfts = fetch_random_nfts(col["address"], n * 2)  # Fetch extra
            print(f"  Fetched {len(nfts)} candidate NFTs")
            
            col_generated = 0
            for nft in nfts:
                if col_generated >= n:
                    break
                
                nft_id = nft.get("id", "unknown")[:8]
                image_url = get_nft_image_url(nft)
                if not image_url:
                    print(f"  ✗ {nft_id} — no image URL")
                    continue
                
                # Download image
                img_path = os.path.join(tmpdir, f"{col['name']}_{nft_id}.png")
                try:
                    print(f"  ↓ Downloading {nft_id}...")
                    download_image(image_url, img_path)
                except Exception as e:
                    print(f"  ✗ {nft_id} — download failed: {e}")
                    failed += 1
                    continue
                
                # Generate ASCII art
                piece_id = f"{col['name']}-{nft_id}-{int(time.time())}"
                output_base = os.path.join(tmpdir, piece_id)
                try:
                    print(f"  🎨 Generating ASCII art for {nft_id}...")
                    mp4_path, png_path = ascii_gen.generate(
                        img_path, output_base,
                        cols=80, num_frames=60, fps=15, target_size=1080
                    )
                except Exception as e:
                    print(f"  ✗ {nft_id} — generation failed: {e}")
                    failed += 1
                    continue
                
                mp4_size = os.path.getsize(mp4_path) / 1024
                png_size = os.path.getsize(png_path) / 1024
                print(f"  📦 MP4: {mp4_size:.0f}KB, PNG: {png_size:.0f}KB")
                
                # Upload to Supabase Storage
                print(f"  ↑ Uploading to Supabase...")
                mp4_url = upload_to_supabase(mp4_path, f"{piece_id}.mp4", "video/mp4")
                png_url = upload_to_supabase(png_path, f"{piece_id}.png", "image/png")
                
                if not mp4_url or not png_url:
                    print(f"  ✗ {nft_id} — upload failed")
                    failed += 1
                    continue
                
                results.append({
                    "piece_id": piece_id,
                    "collection": col["name"],
                    "source_nft": nft_id,
                    "mp4_url": mp4_url,
                    "png_url": png_url,
                    "mp4_size_kb": round(mp4_size),
                    "png_size_kb": round(png_size),
                })
                
                generated += 1
                col_generated += 1
                print(f"  ✓ {piece_id} ({generated}/{count})")
                
                # Rate limit: don't hammer Helius/Supabase
                time.sleep(0.5)
        
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
    
    # Save manifest
    manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pool-manifest.json")
    with open(manifest_path, "w") as f:
        json.dump({"generated": generated, "failed": failed, "pieces": results}, f, indent=2)
    
    print(f"\n═══ DONE ═══")
    print(f"Generated: {generated}/{count}")
    print(f"Failed: {failed}")
    print(f"Manifest: {manifest_path}")
    
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch ASCII Art Pool Generator")
    parser.add_argument("--count", type=int, default=30, help="Number of pieces to generate (default 30)")
    args = parser.parse_args()
    generate_pool(args.count)
