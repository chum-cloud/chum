#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
export $(grep -E '^(HELIUS_API_KEY|SUPABASE_URL|SUPABASE_SERVICE_KEY)=' ../../backend/.env | xargs)

TARGET=1000
BATCH_SIZE=30

while true; do
    CURRENT=$(python3 -c "import json; d=json.load(open('pool-manifest.json')); print(d['generated'])")
    REMAINING=$((TARGET - CURRENT))
    
    if [ "$REMAINING" -le 0 ]; then
        echo "🎉 Target reached! $CURRENT pieces in pool."
        break
    fi
    
    BATCH=$((REMAINING < BATCH_SIZE ? REMAINING : BATCH_SIZE))
    echo "━━━ Batch: $BATCH (current: $CURRENT/$TARGET) ━━━"
    python3 -u fast-pool-gen.py --count "$BATCH" 2>&1 || {
        echo "⚠ Batch failed, retrying in 10s..."
        sleep 10
        continue
    }
    sleep 2
done
