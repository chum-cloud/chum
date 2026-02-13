#!/usr/bin/env python3
"""Fast concurrent rename using ThreadPoolExecutor."""
import json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET = "art-pool"
START_PIECE = int(sys.argv[1]) if len(sys.argv) > 1 else 561  # resume point
WORKERS = 20

def supabase_move(old_path, new_path):
    url = f"{SUPABASE_URL}/storage/v1/object/move"
    body = json.dumps({"bucketId": BUCKET, "sourceKey": old_path, "destinationKey": new_path}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    for attempt in range(3):
        try:
            urllib.request.urlopen(req, timeout=30)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 404: return True
            if attempt == 2: return False
            time.sleep(1)
        except Exception:
            if attempt == 2: return False
            time.sleep(1)
    return False

m = json.load(open("pool-manifest.json"))
pieces = m["pieces"]

renames = []
for i, piece in enumerate(pieces):
    if i + 1 < START_PIECE:
        continue
    num = i + 1
    new_id = f"CHUM-{num:04d}"
    mp4_url = piece.get("mp4_url") or piece.get("mp4", "")
    png_url = piece.get("png_url") or piece.get("png", "")
    old_mp4 = mp4_url.split("/art-pool/")[-1] if "/art-pool/" in mp4_url else None
    old_png = png_url.split("/art-pool/")[-1] if "/art-pool/" in png_url else None
    if old_mp4 and old_mp4 != f"{new_id}.mp4":
        renames.append((old_mp4, f"{new_id}.mp4"))
    if old_png and old_png != f"{new_id}.png":
        renames.append((old_png, f"{new_id}.png"))

print(f"Resuming from piece {START_PIECE}: {len(renames)} files to rename, {WORKERS} workers")

success = fail = 0
with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    futures = {pool.submit(supabase_move, old, new): (old, new) for old, new in renames}
    for i, future in enumerate(as_completed(futures)):
        if future.result():
            success += 1
        else:
            fail += 1
            old, new = futures[future]
            print(f"  FAIL: {old} -> {new}")
        if (i + 1) % 200 == 0:
            print(f"  [{i+1}/{len(renames)}] success={success} fail={fail}")

print(f"\nDone: {success} success, {fail} fail")

# Now update manifest
base_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"
new_pieces = []
for i, piece in enumerate(pieces):
    num = i + 1
    new_id = f"CHUM-{num:04d}"
    new_pieces.append({
        "id": new_id,
        "name": f"CHUM #{num:04d}",
        "mp4": f"{base_url}/{new_id}.mp4",
        "png": f"{base_url}/{new_id}.png",
        "mp4_size": piece.get("mp4_size") or (piece.get("mp4_size_kb", 0) * 1024),
        "png_size": piece.get("png_size") or (piece.get("png_size_kb", 0) * 1024),
    })

new_manifest = {"total": len(new_pieces), "pieces": new_pieces}
with open("pool-manifest.json", "w") as f:
    json.dump(new_manifest, f, indent=2)

# Upload
data = json.dumps(new_manifest).encode()
url = f"{SUPABASE_URL}/storage/v1/object/art-pool/pool-manifest.json"
req = urllib.request.Request(url, data=data, method="PUT")
req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
req.add_header("Content-Type", "application/json")
urllib.request.urlopen(req, timeout=30)
print("Manifest updated + uploaded ✓")
