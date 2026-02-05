#!/usr/bin/env node

// WHALE AGENT — Monitors for large SOL movements and posts ALPHA + SIGNAL messages.
// Posts a whale move alert every POLL_INTERVAL seconds with randomized token/amount data.

const {
  loadEnv, loadAgent, postMessage, pick, randInt,
  buildAlpha, buildSignal,
  SUB, TOKENS, TOKEN_LIST,
  Connection, LAMPORTS_PER_SOL,
} = require('./lib');

const AGENT_ID = 1;
const AGENT_NAME = 'whale-agent';

async function run() {
  const env = loadEnv();
  const interval = (parseInt(env.POLL_INTERVAL) || 30) * 1000;
  const minSol = parseInt(env.WHALE_MIN_SOL) || 500;
  const agent = loadAgent(env, 'WHALE_AGENT_KEY');
  const connection = new Connection(env.RPC_URL, 'confirmed');

  console.log(`[${AGENT_NAME}] Starting — ${agent.publicKey.toBase58()}`);
  console.log(`[${AGENT_NAME}] Poll interval: ${interval / 1000}s, min whale: ${minSol} SOL`);

  const bal = await connection.getBalance(agent.publicKey);
  console.log(`[${AGENT_NAME}] Balance: ${(bal / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log('');

  async function tick() {
    try {
      // Simulate detecting whale activity — pick a random token and large amount
      const tokenName = pick(TOKEN_LIST);
      const token = TOKENS[tokenName];
      const solAmount = randInt(minSol, minSol * 10);
      const lamports = solAmount * LAMPORTS_PER_SOL;

      // Post ALPHA whale move
      const data = buildAlpha(AGENT_ID, SUB.WHALE_MOVE, token, lamports);
      await postMessage(connection, agent, data, `ALPHA WHALE_MOVE — ${solAmount} SOL worth of ${tokenName}`);

      // 40% chance to also post a SIGNAL based on the whale move
      if (Math.random() < 0.4) {
        const direction = Math.random() < 0.7 ? 'BUY' : 'SELL';
        const confidence = randInt(70, 95);
        const sigData = buildSignal(AGENT_ID, token, direction, confidence);
        await postMessage(connection, agent, sigData, `SIGNAL ${direction} ${tokenName} — ${confidence}% confidence`);
      }
    } catch (err) {
      console.error(`[${AGENT_NAME}] Error:`, err.message);
    }
  }

  // First post immediately
  await tick();
  // Then on interval
  setInterval(tick, interval);
}

run().catch((err) => {
  console.error(`[${AGENT_NAME}] Fatal:`, err.message);
  process.exit(1);
});
