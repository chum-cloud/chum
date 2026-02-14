/**
 * Test mainnet mint via skill.md agent flow.
 * Uses chumAA7... wallet.
 */
import { Keypair, VersionedTransaction, Connection } from '@solana/web3.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API = 'https://chum-production.up.railway.app/api/auction';
const WALLET_PATH = path.resolve(__dirname, '../../chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T.json');
const RPC = process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=06cda3a9-32f3-4ad9-a203-9d7274299837';

async function api(method: string, endpoint: string, body?: any) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${endpoint}: ${JSON.stringify(data)}`);
  return data;
}

async function mint(keypair: Keypair, connection: Connection, mintNum: number) {
  const wallet = keypair.publicKey.toBase58();
  console.log(`\n=== MINT #${mintNum} ===`);
  console.log('Wallet:', wallet);

  // 1. Challenge
  console.log('1. Getting challenge...');
  const challenge = await api('POST', '/challenge', { walletAddress: wallet });
  console.log('   Challenge ID:', challenge.challengeId);
  console.log('   Question:', challenge.question);

  // 2. Solve challenge (simple math)
  const answer = eval(challenge.question); // e.g. "3 + 5" → 8
  console.log('2. Answer:', answer);

  // 3. Mint
  console.log('3. Requesting mint tx...');
  const mintRes = await api('POST', '/mint', {
    creatorWallet: wallet,
    challengeId: challenge.challengeId,
    answer,
  });
  console.log('   Asset:', mintRes.assetAddress);
  console.log('   Mint #:', mintRes.mintNumber);

  // 4. Sign and send tx
  console.log('4. Signing and sending tx...');
  const txBuf = Buffer.from(mintRes.transaction, 'base64');
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([keypair]);
  
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  console.log('   Tx sig:', sig);

  // 5. Wait for confirmation
  console.log('5. Confirming...');
  const conf = await connection.confirmTransaction(sig, 'confirmed');
  if (conf.value.err) throw new Error(`Tx failed: ${JSON.stringify(conf.value.err)}`);
  console.log('   Confirmed!');

  // 6. Confirm mint
  console.log('6. Confirming mint with backend...');
  const confirmRes = await api('POST', '/mint/confirm', {
    creatorWallet: wallet,
    signature: sig,
    mintAddress: mintRes.assetAddress,
  });
  console.log('   Result:', confirmRes);
  console.log(`\n✅ MINT #${mintNum} COMPLETE — ${mintRes.assetAddress}`);
  return mintRes.assetAddress;
}

async function main() {
  const keyData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keyData));
  const connection = new Connection(RPC, 'confirmed');
  
  const balance = await connection.getBalance(keypair.publicKey);
  console.log('Wallet balance:', balance / 1e9, 'SOL');
  
  if (balance < 40_000_000) {
    throw new Error('Need at least 0.04 SOL for two mints');
  }

  const mint1 = await mint(keypair, connection, 1);
  console.log('\nWaiting 3s before second mint...');
  await new Promise(r => setTimeout(r, 3000));
  const mint2 = await mint(keypair, connection, 2);

  console.log('\n=============================');
  console.log('BOTH MINTS COMPLETE!');
  console.log('Mint 1:', mint1);
  console.log('Mint 2:', mint2);
  console.log('=============================');
}

main().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
