#!/bin/bash
# Wait for batch3-eth to finish, then run the fix
echo "Waiting for batch3-eth (pid 45725) to finish..."
while kill -0 45725 2>/dev/null; do sleep 10; done
echo "batch3-eth done. Starting fix..."
export $(grep -E '^(SUPABASE_URL|SUPABASE_SERVICE_KEY)=' /Users/makoto/documents/chum/backend/.env | xargs)
python3 gen-batch3-fix.py
