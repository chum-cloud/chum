#!/usr/bin/env python3
"""
Rename all art pool files on Supabase to neutral CHUM-NNNN format.
Removes all source collection references from filenames, manifest IDs, and metadata.
"""
import json, os, sys, time, urllib.request, urllib.error

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET = "art-pool"
MANIFEST = "pool-manifest.json"

def supabase_move(old_path, new_path):
    """Move/rename a file in Supabase Storage via the move endpoint."""
    url = f"{SUPABASE_URL}/storage/v1/object/move"
    body = json.dumps({"bucketId": BUCKET, "sourceKey": old_path, "destinationKey": new_path}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=30)
        return True
    except urllib.error.HTTPError as e:
        # 404 = already moved or doesn't exist
        if e.code == 404:
            return True
        print(f"  ERROR {e.code}: {old_path} -> {new_path}: {e.read().decode()[:200]}")
        return False

def extract_filename(url):
    """Get just the filename from a Supabase URL."""
    return url.split("/art-pool/")[-1] if "/art-pool/" in url else None

def main():
    with open(MANIFEST) as f:
        manifest = json.load(f)

    pieces = manifest["pieces"]
    print(f"Total pieces: {len(pieces)}")

    # Build new manifest with sequential CHUM-NNNN IDs
    # Shuffle order doesn't matter, just renumber sequentially
    renames = []  # (old_mp4, new_mp4, old_png, new_png)
    new_pieces = []

    for i, piece in enumerate(pieces):
        num = i + 1
        new_id = f"CHUM-{num:04d}"
        new_name = f"CHUM #{num:04d}"

        # Get current URLs
        mp4_url = piece.get("mp4_url") or piece.get("mp4", "")
        png_url = piece.get("png_url") or piece.get("png", "")

        old_mp4 = extract_filename(mp4_url)
        old_png = extract_filename(png_url)

        new_mp4_file = f"{new_id}.mp4"
        new_png_file = f"{new_id}.png"

        base_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"

        new_piece = {
            "id": new_id,
            "name": new_name,
            "mp4": f"{base_url}/{new_mp4_file}",
            "png": f"{base_url}/{new_png_file}",
            "mp4_size": piece.get("mp4_size") or (piece.get("mp4_size_kb", 0) * 1024),
            "png_size": piece.get("png_size") or (piece.get("png_size_kb", 0) * 1024),
        }
        new_pieces.append(new_piece)

        if old_mp4 and old_mp4 != new_mp4_file:
            renames.append((old_mp4, new_mp4_file))
        if old_png and old_png != new_png_file:
            renames.append((old_png, new_png_file))

    print(f"Files to rename: {len(renames)}")
    print(f"Sample renames:")
    for old, new in renames[:6]:
        print(f"  {old} -> {new}")

    # Confirm
    if "--dry-run" in sys.argv:
        print("\nDRY RUN — no changes made")
        return

    # Execute renames
    success = 0
    fail = 0
    for i, (old_path, new_path) in enumerate(renames):
        if supabase_move(old_path, new_path):
            success += 1
        else:
            fail += 1
        if (i + 1) % 100 == 0:
            print(f"  [{i+1}/{len(renames)}] success={success} fail={fail}")
            time.sleep(0.5)  # Don't hammer the API

    print(f"\nRenames done: {success} success, {fail} fail")

    # Save new manifest
    new_manifest = {
        "generated_at": manifest.get("generated_at", ""),
        "total": len(new_pieces),
        "pieces": new_pieces
    }

    with open(MANIFEST, "w") as f:
        json.dump(new_manifest, f, indent=2)
    print(f"Manifest updated: {len(new_pieces)} pieces, all neutral IDs")

    # Upload manifest to Supabase
    data = json.dumps(new_manifest).encode()
    url = f"{SUPABASE_URL}/storage/v1/object/art-pool/pool-manifest.json"
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=30)
        print("Manifest uploaded to Supabase ✓")
    except Exception as e:
        print(f"Manifest upload failed: {e}")

if __name__ == "__main__":
    main()
