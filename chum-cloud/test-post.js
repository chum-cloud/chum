#!/usr/bin/env node

// Post a single test ALPHA (WHALE_MOVE) message to the CHUM Cloud room.
// Uses the whale-agent wallet.
//
// Usage:  node test-post.js

const path = require('path');
const fs = require('fs');
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} = require(path.resolve(__dirname, '../backend/node_modules/@solana/web3.js'));

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const CHUM_ROOM = new PublicKey('chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T');

// CHUM protocol constants
const MAGIC = [0x43, 0x48]; // "CH"
const MSG_ALPHA = 0x01;
const SUB_WHALE_MOVE = 0x01;

// SOL token mint (native wrapped SOL)
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Load .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

// Encode a uint16 as 2 big-endian bytes
function uint16BE(n) {
  return [(n >> 8) & 0xff, n & 0xff];
}

// Encode a uint64 as 8 big-endian bytes
function uint64BE(n) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(n));
  return Array.from(buf);
}

async function main() {
  const env = loadEnv();
  const rpcUrl = env.RPC_URL || 'https://api.mainnet-beta.solana.com';

  // Load whale agent keypair
  const keyPath = path.join(__dirname, 'keys', 'whale-agent.json');
  if (!fs.existsSync(keyPath)) {
    console.error('Error: whale-agent.json not found. Run setup-agents.sh first.');
    process.exit(1);
  }

  const agentBytes = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  const agent = Keypair.fromSecretKey(new Uint8Array(agentBytes));
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('');
  console.log('CHUM Cloud — Test Post');
  console.log('════════════════════════════════════');
  console.log(`Agent:   whale-agent (${agent.publicKey.toBase58()})`);
  console.log(`Room:    ${CHUM_ROOM.toBase58()}`);
  console.log(`RPC:     ${rpcUrl.replace(/api-key=.*/, 'api-key=***')}`);
  console.log('');

  // Check balance
  const balance = await connection.getBalance(agent.publicKey);
  if (balance < 10000) {
    console.error(`Error: Insufficient balance (${balance} lamports). Fund with 0.01 SOL first.`);
    process.exit(1);
  }
  console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL`);
  console.log('');

  // Build ALPHA WHALE_MOVE message
  // Header: [CH] [0x01=ALPHA] [agent_id=0x0001]
  // Payload: [0x01=WHALE_MOVE] [32-byte SOL mint] [8-byte amount = 500 SOL in lamports]
  const agentId = 1;
  const testAmount = 500_000_000_000; // 500 SOL in lamports

  const data = Buffer.from([
    ...MAGIC,
    MSG_ALPHA,
    ...uint16BE(agentId),
    SUB_WHALE_MOVE,
    ...SOL_MINT.toBytes(),
    ...uint64BE(testAmount),
  ]);

  const hexPayload = data.toString('hex');

  console.log(`Message: ${hexPayload}`);
  console.log(`  Type:    ALPHA / WHALE_MOVE`);
  console.log(`  Agent:   #${agentId}`);
  console.log(`  Token:   SOL (${SOL_MINT.toBase58()})`);
  console.log(`  Amount:  ${testAmount / 1e9} SOL`);
  console.log('');

  // Build transaction:
  // 1. Memo instruction — data is hex-encoded (valid UTF-8) since SPL Memo rejects raw binary
  // 2. 0-lamport transfer to CHUM_ROOM so it appears in getSignaturesForAddress
  const memoIx = new TransactionInstruction({
    keys: [
      { pubkey: agent.publicKey, isSigner: true, isWritable: true },
    ],
    programId: MEMO_PROGRAM,
    data: Buffer.from(hexPayload, 'utf-8'),
  });

  const refIx = SystemProgram.transfer({
    fromPubkey: agent.publicKey,
    toPubkey: CHUM_ROOM,
    lamports: 0,
  });

  const tx = new Transaction().add(memoIx, refIx);

  console.log('→ Sending transaction...');
  const signature = await sendAndConfirmTransaction(connection, tx, [agent]);

  console.log('');
  console.log('  ✓ Transaction confirmed!');
  console.log(`  Signature: ${signature}`);
  console.log(`  Solscan:   https://solscan.io/tx/${signature}`);
  console.log('');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
