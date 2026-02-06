import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { config } from '../config';

let signingKeypair: Keypair | null = null;

/**
 * Get or create the CHUM signing keypair.
 * The keypair is used to cryptographically sign all CHUM messages,
 * allowing anyone to verify authenticity.
 */
export function getSigningKeypair(): Keypair {
  if (signingKeypair) return signingKeypair;

  const secretKeyBase58 = config.chumSigningKey;
  if (!secretKeyBase58) {
    throw new Error('CHUM_SIGNING_KEY not configured. Run: node -e "console.log(require(\'@solana/web3.js\').Keypair.generate().secretKey.toString())"');
  }

  // Parse the secret key (stored as comma-separated bytes or base58)
  let secretKey: Uint8Array;
  if (secretKeyBase58.includes(',')) {
    // Comma-separated bytes format
    secretKey = new Uint8Array(secretKeyBase58.split(',').map(Number));
  } else {
    // Base58 format
    secretKey = bs58.decode(secretKeyBase58);
  }

  signingKeypair = Keypair.fromSecretKey(secretKey);
  console.log(`[SIGNING] Loaded signing keypair. Public key: ${signingKeypair.publicKey.toBase58()}`);
  return signingKeypair;
}

/**
 * Sign a message with the CHUM signing key.
 * Returns a base58-encoded signature.
 */
export function signMessage(message: string): string {
  const keypair = getSigningKeypair();
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  return bs58.encode(signature);
}

/**
 * Verify a signed message.
 * Anyone can verify using the public key.
 */
export function verifySignature(message: string, signatureBase58: string, publicKeyBase58: string): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signature = bs58.decode(signatureBase58);
    const publicKey = bs58.decode(publicKeyBase58);
    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Get the public key for verification.
 */
export function getSigningPublicKey(): string {
  const keypair = getSigningKeypair();
  return keypair.publicKey.toBase58();
}

/**
 * Create a signed message object with all verification data.
 */
export interface SignedMessage {
  content: string;
  signature: string;
  publicKey: string;
  timestamp: number;
}

export function createSignedMessage(content: string): SignedMessage {
  const timestamp = Date.now();
  const messageToSign = `${content}|${timestamp}`;
  return {
    content,
    signature: signMessage(messageToSign),
    publicKey: getSigningPublicKey(),
    timestamp,
  };
}
