// Shared library for CHUM Cloud agents

const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const bs58 = require('bs58');

const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const CHUM_ROOM = new PublicKey(process.env.CHUM_ROOM || 'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T');
const MAGIC = [0x43, 0x48];

// Message types
const MSG = { ALPHA: 0x01, SIGNAL: 0x02, RALLY: 0x03, EXIT: 0x04, RESULT: 0x05 };
const SUB = { WHALE_MOVE: 0x01, DEX_LISTING: 0x02, SOCIAL_SURGE: 0x03 };

// Known tokens
const TOKENS = {
  SOL:  new PublicKey('So11111111111111111111111111111111111111112'),
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  BONK: new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'),
  JUP:  new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'),
  MSOL: new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So'),
  RAY:  new PublicKey('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R'),
  ORCA: new PublicKey('orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE'),
  WIF:  new PublicKey('EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'),
  CHUM: new PublicKey('AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump'),
};
const TOKEN_NAMES = Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [v.toBase58(), k]));
const TOKEN_LIST = Object.keys(TOKENS);

/**
 * Load environment variables from process.env
 * Railway sets these directly — no .env file needed
 */
function loadEnv() {
  return process.env;
}

function loadAgent(env, envKey) {
  const key = env[envKey];
  if (!key) throw new Error(`Missing env var: ${envKey}`);
  return Keypair.fromSecretKey(bs58.decode(key));
}

function uint16BE(n) { return [(n >> 8) & 0xff, n & 0xff]; }
function uint64BE(n) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(n));
  return Array.from(buf);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function postMessage(connection, agent, rawData, label) {
  const hexPayload = Buffer.from(rawData).toString('hex');
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
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`  [${ts}] ${label}`);
  console.log(`           ${sig}`);
  return sig;
}

// Message builders
function buildAlpha(agentId, subtype, mint, amount) {
  return Buffer.from([
    ...MAGIC, MSG.ALPHA, ...uint16BE(agentId),
    subtype, ...mint.toBytes(),
    ...(amount ? uint64BE(amount) : []),
  ]);
}

function buildSignal(agentId, mint, direction, confidence) {
  return Buffer.from([
    ...MAGIC, MSG.SIGNAL, ...uint16BE(agentId),
    ...mint.toBytes(),
    direction === 'BUY' ? 0x01 : 0x02,
    confidence,
  ]);
}

function buildRally(agentId, rallyId, mint, action, entryPrice, targetPrice) {
  return Buffer.from([
    ...MAGIC, MSG.RALLY, ...uint16BE(agentId),
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
    ...MAGIC, MSG.EXIT, ...uint16BE(agentId),
    ...uint16BE(rallyId),
    reasons[reason] || 0x03,
  ]);
}

function buildResult(agentId, rallyId, outcome, pnlLamports) {
  return Buffer.from([
    ...MAGIC, MSG.RESULT, ...uint16BE(agentId),
    ...uint16BE(rallyId),
    outcome === 'WIN' ? 0x01 : 0x02,
    ...uint64BE(Math.abs(pnlLamports)),
  ]);
}

module.exports = {
  loadEnv, loadAgent, postMessage, pick, randInt,
  buildAlpha, buildSignal, buildRally, buildExit, buildResult,
  MSG, SUB, TOKENS, TOKEN_NAMES, TOKEN_LIST,
  Connection, Keypair, PublicKey, LAMPORTS_PER_SOL,
  CHUM_ROOM, MEMO_PROGRAM,
};
