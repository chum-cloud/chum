#!/usr/bin/env python3
"""Batch runner: generates art pool pieces in batches, appending to manifest.
Runs batch-pool-gen.py repeatedly, merging results into pool-manifest.json.
"""
import json, os, subprocess, sys, time

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(SCRIPT_DIR, "pool-manifest.json")
TARGET = 1000
BATCH_SIZE = 50

def load_manifest():
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            return json.load(f)
    return {"generated": 0, "failed": 0, "pieces": []}

def save_manifest(data):
    with open(MANIFEST, "w") as f:
        json.dump(data, f, indent=2)

def run_batch(count):
    """Run batch-pool-gen.py and capture its manifest output."""
    # We'll use a temp manifest approach: rename current, run, merge
    env = os.environ.copy()
    env["HELIUS_API_KEY"] = "6571100b-ec3a-4cb0-b0e9-c10f73ca07ba"
    env["SUPABASE_URL"] = "https://akkhgcmmgzrianbdfijt.supabase.co"
    env["SUPABASE_SERVICE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2hnY21tZ3pyaWFuYmRmaWp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE5NDY1NCwiZXhwIjoyMDg1NzcwNjU0fQ.KCMxOG9hGlIFrJ6rCYXmvb4l82cyGlDsMAb-mfZ7v2Y"
    
    result = subprocess.run(
        [sys.executable, os.path.join(SCRIPT_DIR, "batch-pool-gen.py"), "--count", str(count)],
        env=env, cwd=SCRIPT_DIR, timeout=3600
    )
    return result.returncode == 0

def main():
    manifest = load_manifest()
    existing_ids = {p["piece_id"] for p in manifest["pieces"]}
    current = len(manifest["pieces"])
    print(f"Starting with {current} pieces, target {TARGET}")
    
    while current < TARGET:
        remaining = TARGET - current
        batch = min(BATCH_SIZE, remaining)
        print(f"\n{'='*50}")
        print(f"Batch: generating {batch} pieces ({current}/{TARGET})")
        print(f"{'='*50}")
        
        # Save current manifest backup
        backup = manifest.copy()
        
        # Run the batch gen (it overwrites manifest)
        success = run_batch(batch)
        
        # Read the new manifest (batch-pool-gen overwrites it)
        new_manifest = load_manifest()
        new_pieces = new_manifest.get("pieces", [])
        
        # Merge: keep old pieces, add new ones
        added = 0
        for p in new_pieces:
            if p["piece_id"] not in existing_ids:
                backup["pieces"].append(p)
                existing_ids.add(p["piece_id"])
                added += 1
        
        backup["generated"] = len(backup["pieces"])
        backup["failed"] = backup.get("failed", 0) + new_manifest.get("failed", 0)
        manifest = backup
        current = len(manifest["pieces"])
        
        # Save merged manifest
        save_manifest(manifest)
        print(f"Added {added} new pieces. Total: {current}/{TARGET}")
        
        if added == 0 and not success:
            print("WARNING: Batch produced 0 new pieces and failed. Retrying after delay...")
            time.sleep(5)
        
        time.sleep(1)  # Brief pause between batches
    
    print(f"\n{'='*50}")
    print(f"COMPLETE: {current} pieces in pool")
    collections = {}
    for p in manifest["pieces"]:
        c = p["collection"]
        collections[c] = collections.get(c, 0) + 1
    for c, n in sorted(collections.items()):
        print(f"  {c}: {n}")

if __name__ == "__main__":
    main()
