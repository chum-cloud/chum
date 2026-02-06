-- Add signature columns to thoughts table for verifiable CHUM identity
ALTER TABLE thoughts 
ADD COLUMN IF NOT EXISTS signature TEXT,
ADD COLUMN IF NOT EXISTS signing_key TEXT;

-- Add signature columns to cloud_posts table
ALTER TABLE cloud_posts 
ADD COLUMN IF NOT EXISTS signature TEXT,
ADD COLUMN IF NOT EXISTS signing_key TEXT;

-- Create index for verification lookups
CREATE INDEX IF NOT EXISTS idx_thoughts_signing_key ON thoughts(signing_key);
CREATE INDEX IF NOT EXISTS idx_cloud_posts_signing_key ON cloud_posts(signing_key);

COMMENT ON COLUMN thoughts.signature IS 'Ed25519 signature of the content, base58 encoded';
COMMENT ON COLUMN thoughts.signing_key IS 'Public key used for signing, base58 encoded';
