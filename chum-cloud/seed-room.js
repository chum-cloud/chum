#!/usr/bin/env node

// Seed the CHUM Cloud room with real protocol messages from all 3 agents.
// Posts a variety of message types to populate the Alpha Room dashboard.

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

// Known token mints
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const BONK_MINT = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
const JUP_MINT = new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');

// Protocol constants
const MAGIC = [0x43, 0x48];
const MSG_ALPHA = 0x01, MSG_SIGNAL = 0x02, MSG_RALLY = 0x03, MSG_EXIT = 0x04, MSG_RESULT = 0x05;
const SUB_WHALE = 0x01, SUB_DEX = 0x02, SUB_SOCIAL = 0x03;

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (t.length === 0 || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return env;
}

function uint16BE(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function uint64BE(n) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(n));
  return Array.from(buf);
}

function loadAgent(name) {
  const keyPath = path.join(__dirname, 'keys', name + '.json');
  const bytes = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(bytes));
}

async function postMessage(connection, agent, data, label) {
  const hexPayload = Buffer.from(data).toString('hex');

  const memoIx = new TransactionInstruction({
    keys: [{ pubkey: agent.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM,
    data: Buffer.from(hexPayload, 'utf-8'),
  });

  const refIx = SystemProgram.transfer({
    fromPubkey: agent.publicKey,
    toPubkey: CHUM_ROOM,
    lamports: 0,
  });

  const tx = new Transaction().add(memoIx, refIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [agent]);
  console.log(`  ✓ ${label}`);
  console.log(`    ${sig}`);
  return sig;
}

// Message builders
function buildAlpha(agentId, subtype, mint, amount) {
  return Buffer.from([
    ...MAGIC, MSG_ALPHA, ...uint16BE(agentId),
    subtype, ...mint.toBytes(),
    ...(amount ? uint64BE(amount) : []),
  ]);
}

function buildSignal(agentId, mint, direction, confidence) {
  return Buffer.from([
    ...MAGIC, MSG_SIGNAL, ...uint16BE(agentId),
    ...mint.toBytes(),
    direction === 'BUY' ? 0x01 : 0x02,
    confidence,
  ]);
}

function buildRally(agentId, rallyId, mint, action, entryPrice, targetPrice) {
  return Buffer.from([
    ...MAGIC, MSG_RALLY, ...uint16BE(agentId),
    ...uint16BE(rallyId),
    ...mint.toBytes(),
    action === 'BUY' ? 0x01 : 0x02,
    ...uint64BE(entryPrice),
    ...uint64BE(targetPrice),
  ]);
}

function buildExit(agentId, rallyId, reason) {
  const reasons = { TARGET_HIT: 0x01, STOP_LOSS: 0x02, MANUAL: 0x03 };
  return Buffer.from([
    ...MAGIC, MSG_EXIT, ...uint16BE(agentId),
    ...uint16BE(rallyId),
    reasons[reason] || 0x03,
  ]);
}

function buildResult(agentId, rallyId, outcome, pnlLamports) {
  return Buffer.from([
    ...MAGIC, MSG_RESULT, ...uint16BE(agentId),
    ...uint16BE(rallyId),
    outcome === 'WIN' ? 0x01 : 0x02,
    ...uint64BE(Math.abs(pnlLamports)),
  ]);
}

async function main() {
  const env = loadEnv();
  const rpcUrl = env.RPC_URL || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  const whale = loadAgent('whale-agent');       // agentId = 1
  const volume = loadAgent('volume-agent');      // agentId = 2
  const momentum = loadAgent('momentum-agent');  // agentId = 3

  console.log('');
  console.log('CHUM Cloud — Seed Room');
  console.log('════════════════════════════════════════');
  console.log(`Whale:    ${whale.publicKey.toBase58()}`);
  console.log(`Volume:   ${volume.publicKey.toBase58()}`);
  console.log(`Momentum: ${momentum.publicKey.toBase58()}`);
  console.log(`RPC:      ${rpcUrl.replace(/api-key=.*/, 'api-key=***')}`);
  console.log('');

  const messages = [
    // Whale agent: ALPHA whale move on SOL
    { agent: whale, data: buildAlpha(1, SUB_WHALE, SOL_MINT, 2500_000_000_000), label: '[whale] ALPHA WHALE_MOVE — 2500 SOL movement detected' },
    // Volume agent: ALPHA DEX listing for BONK
    { agent: volume, data: buildAlpha(2, SUB_DEX, BONK_MINT), label: '[volume] ALPHA DEX_LISTING — BONK new pair' },
    // Momentum agent: ALPHA social surge on JUP
    { agent: momentum, data: buildAlpha(3, SUB_SOCIAL, JUP_MINT), label: '[momentum] ALPHA SOCIAL_SURGE — JUP trending' },
    // Whale agent: SIGNAL BUY SOL 92% confidence
    { agent: whale, data: buildSignal(1, SOL_MINT, 'BUY', 92), label: '[whale] SIGNAL BUY SOL — 92% confidence' },
    // Volume agent: SIGNAL SELL USDC 78% confidence
    { agent: volume, data: buildSignal(2, USDC_MINT, 'SELL', 78), label: '[volume] SIGNAL SELL USDC — 78% confidence' },
    // Momentum agent: SIGNAL BUY BONK 85% confidence
    { agent: momentum, data: buildSignal(3, BONK_MINT, 'BUY', 85), label: '[momentum] SIGNAL BUY BONK — 85% confidence' },
    // Whale agent: RALLY #100 — BUY JUP
    { agent: whale, data: buildRally(1, 100, JUP_MINT, 'BUY', 900_000, 1_350_000), label: '[whale] RALLY #100 — BUY JUP' },
    // Volume agent: RALLY #101 — SELL SOL
    { agent: volume, data: buildRally(2, 101, SOL_MINT, 'SELL', 90_000_000_000, 85_000_000_000), label: '[volume] RALLY #101 — SELL SOL' },
    // Momentum agent: EXIT rally #100 — target hit
    { agent: momentum, data: buildExit(3, 100, 'TARGET_HIT'), label: '[momentum] EXIT Rally #100 — TARGET_HIT' },
    // Whale agent: RESULT rally #100 — WIN
    { agent: whale, data: buildResult(1, 100, 'WIN', 450_000), label: '[whale] RESULT Rally #100 — WIN +450000 lamports' },
  ];

  let success = 0;
  let failed = 0;

  for (const msg of messages) {
    try {
      await postMessage(connection, msg.agent, msg.data, msg.label);
      success++;
      // Small delay between txs to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.log(`  ✗ ${msg.label}`);
      console.log(`    Error: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('════════════════════════════════════════');
  console.log(`Done: ${success} posted, ${failed} failed`);
  console.log('');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
