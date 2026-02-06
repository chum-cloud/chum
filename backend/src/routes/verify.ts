import { Router } from 'express';
import { getSigningPublicKey, verifySignature } from '../services/signing';

const router = Router();

/**
 * GET /verify/public-key
 * Returns CHUM's signing public key for verification
 */
router.get('/public-key', (req, res) => {
  try {
    const publicKey = getSigningPublicKey();
    res.json({
      publicKey,
      algorithm: 'ed25519',
      encoding: 'base58',
      usage: 'Verify CHUM messages with: nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)',
      note: 'All CHUM thoughts and Cloud posts are signed with this key',
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Signing not configured',
      message: 'CHUM signing key is not set up on this instance'
    });
  }
});

/**
 * POST /verify
 * Verify a signed message
 * Body: { message: string, signature: string, publicKey?: string }
 */
router.post('/', (req, res) => {
  const { message, signature, publicKey } = req.body;

  if (!message || !signature) {
    return res.status(400).json({ error: 'message and signature are required' });
  }

  // Use provided public key or default to CHUM's key
  let verifyKey = publicKey;
  if (!verifyKey) {
    try {
      verifyKey = getSigningPublicKey();
    } catch {
      return res.status(400).json({ error: 'publicKey is required when CHUM signing is not configured' });
    }
  }

  const isValid = verifySignature(message, signature, verifyKey);

  res.json({
    valid: isValid,
    message: isValid ? 'Signature is valid' : 'Signature verification failed',
    publicKey: verifyKey,
  });
});

export default router;
