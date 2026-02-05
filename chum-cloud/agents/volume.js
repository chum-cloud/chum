#!/usr/bin/env node

// VOLUME AGENT — Tracks volume spikes and posts ALPHA (DEX_LISTING) + SIGNAL messages.
// Also initiates RALLY calls when confidence is high.

const {
  loadEnv, loadAgent, postMessage, pick, randInt,
  buildAlpha, buildSignal, buildRally,
  SUB, TOKENS, TOKEN_LIST,
  Connection, LAMPORTS_PER_SOL,
} = require('./lib');

const AGENT_ID = 2;
const AGENT_NAME = 'volume-agent';
let nextRallyId = 200; // volume agent rally IDs start at 200

async function run() {
  const env = loadEnv();
  const interval = (parseInt(env.POLL_INTERVAL) || 30) * 1000;
  const agent = loadAgent(env, 'VOLUME_AGENT_KEY');
  const connection = new Connection(env.RPC_URL, 'confirmed');

  console.log(`[${AGENT_NAME}] Starting — ${agent.publicKey.toBase58()}`);
  console.log(`[${AGENT_NAME}] Poll interval: ${interval / 1000}s`);

  const bal = await connection.getBalance(agent.publicKey);
  console.log(`[${AGENT_NAME}] Balance: ${(bal / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log('');

  async function tick() {
    try {
      const tokenName = pick(TOKEN_LIST);
      const token = TOKENS[tokenName];

      // Pick between DEX_LISTING and SOCIAL_SURGE alpha
      const subtype = Math.random() < 0.6 ? SUB.DEX_LISTING : SUB.SOCIAL_SURGE;
      const subtypeName = subtype === SUB.DEX_LISTING ? 'DEX_LISTING' : 'SOCIAL_SURGE';
      const data = buildAlpha(AGENT_ID, subtype, token);
      await postMessage(connection, agent, data, `ALPHA ${subtypeName} — ${tokenName}`);

      // 50% chance to post a signal
      if (Math.random() < 0.5) {
        const direction = Math.random() < 0.6 ? 'BUY' : 'SELL';
        const confidence = randInt(60, 90);
        const sigData = buildSignal(AGENT_ID, token, direction, confidence);
        await postMessage(connection, agent, sigData, `SIGNAL ${direction} ${tokenName} — ${confidence}%`);
      }

      // 20% chance to call a rally
      if (Math.random() < 0.2) {
        const action = Math.random() < 0.65 ? 'BUY' : 'SELL';
        const entryPrice = randInt(100_000, 100_000_000);
        const multiplier = action === 'BUY' ? 1.3 + Math.random() * 0.7 : 0.85 + Math.random() * 0.1;
        const targetPrice = Math.floor(entryPrice * multiplier);
        const rallyId = nextRallyId++;
        const rallyData = buildRally(AGENT_ID, rallyId, token, action, entryPrice, targetPrice);
        await postMessage(connection, agent, rallyData, `RALLY #${rallyId} — ${action} ${tokenName}`);
      }
    } catch (err) {
      console.error(`[${AGENT_NAME}] Error:`, err.message);
    }
  }

  await tick();
  setInterval(tick, interval);
}

run().catch((err) => {
  console.error(`[${AGENT_NAME}] Fatal:`, err.message);
  process.exit(1);
});
