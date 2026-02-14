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

async function main() {
  const keyData = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keyData));
  const connection = new Connection(RPC, 'confirmed');
  const wallet = keypair.publicKey.toBase58();
  
  console.log('Wallet:', wallet);
  console.log('Balance:', (await connection.getBalance(keypair.publicKey)) / 1e9, 'SOL');

  // Challenge
  const ch = await api('POST', '/challenge', { walletAddress: wallet });
  console.log('Challenge:', ch.question, '=', eval(ch.question));

  // Mint (returns piece data with Arweave URIs)
  const mintRes = await api('POST', '/mint', {
    creatorWallet: wallet,
    challengeId: ch.challengeId,
    answer: eval(ch.question),
  });
  console.log('Asset:', mintRes.assetAddress);
  console.log('Piece:', mintRes.piece);
  console.log('Fee:', mintRes.fee / 1e9, 'SOL');

  // Sign & send
  const tx = VersionedTransaction.deserialize(Buffer.from(mintRes.transaction, 'base64'));
  tx.sign([keypair]);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  console.log('Tx:', sig);
  
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('Confirmed on-chain!');

  // Wait for DAS indexer
  console.log('Waiting 8s for DAS indexer...');
  await new Promise(r => setTimeout(r, 8000));

  // Confirm with backend — pass piece data for recent_mints feed
  const result = await api('POST', '/mint/confirm', {
    assetAddress: mintRes.assetAddress,
    signature: sig,
    creatorWallet: wallet,
    isAgent: true,
    piece: mintRes.piece,
  });
  console.log('✅', result);
}

main().catch(e => console.error('FAILED:', e.message));
