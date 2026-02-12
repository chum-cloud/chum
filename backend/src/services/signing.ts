// Minimal signing stub — original service was removed during cleanup
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

let keypair: Keypair | null = null;

function loadKeypair(): Keypair {
  if (keypair) return keypair;
  const secret = process.env.CHUM_WALLET_SECRET;
  if (!secret) throw new Error('CHUM_WALLET_SECRET not set');
  keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
  return keypair;
}

export function signMessage(message: Buffer): Buffer {
  const kp = loadKeypair();
  const { sign } = require('tweetnacl');
  return Buffer.from(sign.detached(message, kp.secretKey));
}

export function getSigningPublicKey(): string {
  try {
    return loadKeypair().publicKey.toBase58();
  } catch {
    return '';
  }
}
