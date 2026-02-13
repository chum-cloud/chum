#!/bin/bash
# Run batch-pool-gen.py in batches of 50 until we have 1000 pieces
cd /Users/makoto/documents/chum/docs/scripts

export HELIUS_API_KEY=6571100b-ec3a-4cb0-b0e9-c10f73ca07ba
export SUPABASE_URL=https://akkhgcmmgzrianbdfijt.supabase.co
export SUPABASE_SERVICE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2hnY21tZ3pyaWFuYmRmaWp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE5NDY1NCwiZXhwIjoyMDg1NzcwNjU0fQ.KCMxOG9hGlIFrJ6rCYXmvb4l82cyGlDsMAb-mfZ7v2Y'
export PYTHONUNBUFFERED=1

BATCH=50
TARGET=1000

while true; do
    COUNT=$(python3 -c "import json; print(len(json.load(open('pool-manifest.json'))['pieces']))")
    echo "$(date): Current count: $COUNT / $TARGET"
    
    if [ "$COUNT" -ge "$TARGET" ]; then
        echo "TARGET REACHED: $COUNT pieces!"
        # Print distribution
        python3 -c "
import json
m = json.load(open('pool-manifest.json'))
from collections import Counter
c = Counter(p['collection'] for p in m['pieces'])
print('Distribution:', dict(c))
print('Total:', len(m['pieces']))
"
        break
    fi
    
    REMAINING=$((TARGET - COUNT))
    BATCH_SIZE=$((REMAINING < BATCH ? REMAINING : BATCH))
    
    echo "$(date): Running batch of $BATCH_SIZE..."
    python3 -u batch-pool-gen.py --count $BATCH_SIZE 2>&1
    
    echo "$(date): Batch complete. Sleeping 2s..."
    sleep 2
done
