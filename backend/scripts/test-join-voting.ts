/**
 * Test join-voting after PermanentTransferDelegate fix.
 * Run: cd backend && npx tsx scripts/test-join-voting.ts
 */
import 'dotenv/config';
import { Keypair, Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import * as fs from 'fs';

const API = 'https://chum-production.up.railway.app';
// Use local API if Railway hasn't deployed yet
const LOCAL = 'http://localhost:3001';
const USE_LOCAL = false;
const BASE = USE_LOCAL ? LOCAL : API;

const connection = new Connection(process.env.HELIUS_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

function loadKeypair(path: string): Keypair {
  const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(data));
}

function getAuthority(): Keypair {
  const key = process.env.CHUM_SIGNING_KEY!;
  let bytes: number[];
  if (key.includes(',')) bytes = key.split(',').map(Number);
  else if (key.startsWith('[')) bytes = JSON.parse(key);
  else {
    const bs58 = require('bs58');
    bytes = Array.from((bs58.default?.decode || bs58.decode)(key));
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

async function post(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${data.error || res.status}`);
  return data;
}

async function main() {
  const authority = getAuthority();
  const wallet = authority.publicKey.toBase58();
  console.log('Testing with wallet:', wallet);

  // Step 1: Mint
  console.log('\n--- MINT ---');
  // Need a URI for the NFT metadata - use a pool piece
  const poolUri = 'https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-D6R2bm5P-1770950009.png';
  const mintRes = await post('/api/auction/mint', { creatorWallet: wallet, name: 'CHUM: Test #9999', uri: poolUri });
  console.log('Mint tx received, asset:', mintRes.assetAddress);
  
  // Deserialize, sign, send
  const mintTxBytes = Buffer.from(mintRes.transaction, 'base64');
  const mintTx = VersionedTransaction.deserialize(mintTxBytes);
  mintTx.sign([authority]);
  const mintSig = await connection.sendRawTransaction(mintTx.serialize(), { skipPreflight: true });
  console.log('Mint sig:', mintSig);
  console.log('Waiting 15s for confirmation...');
  await new Promise(r => setTimeout(r, 15000));

  // Confirm mint
  const confirmRes = await post('/api/auction/mint/confirm', { assetAddress: mintRes.assetAddress, signature: mintSig });
  console.log('Confirm mint:', confirmRes);

  const mintAddress = mintRes.assetAddress;

  // Step 2: Join voting
  console.log('\n--- JOIN VOTING ---');
  try {
    const joinRes = await post('/api/auction/join', { creatorWallet: wallet, mintAddress });
    console.log('Join tx received');
    
    const joinTxBytes = Buffer.from(joinRes.transaction, 'base64');
    const joinTx = VersionedTransaction.deserialize(joinTxBytes);
    joinTx.sign([authority]); // user signs as owner
    const joinSig = await connection.sendRawTransaction(joinTx.serialize(), { skipPreflight: true });
    console.log('Join sig:', joinSig);
    await new Promise(r => setTimeout(r, 5000));

    const confirmJoinRes = await post('/api/auction/join/confirm', { creatorWallet: wallet, signature: joinSig, mintAddress });
    console.log('Confirm join:', confirmJoinRes);
    console.log('\n✅ JOIN VOTING: PASS');
  } catch (err: any) {
    console.error('\n❌ JOIN VOTING: FAIL —', err.message);
  }
}

main().catch(console.error);
