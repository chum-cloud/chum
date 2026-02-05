#!/usr/bin/env node

// MOMENTUM AGENT — Reads room messages and reacts with SIGNAL, EXIT, and RESULT messages.
// Follows up on rallies from other agents. Posts momentum-based signals.

const {
  loadEnv, loadAgent, postMessage, pick, randInt,
  buildSignal, buildExit, buildResult,
  TOKENS, TOKEN_LIST,
  Connection, LAMPORTS_PER_SOL,
} = require('./lib');

const AGENT_ID = 3;
const AGENT_NAME = 'momentum-agent';

// Track rallies we've seen so we can exit/result them
const seenRallies = [];

async function run() {
  const env = loadEnv();
  const interval = (parseInt(env.POLL_INTERVAL) || 30) * 1000;
  const agent = loadAgent(env, 'MOMENTUM_AGENT_KEY');
  const connection = new Connection(env.RPC_URL, 'confirmed');

  console.log(`[${AGENT_NAME}] Starting — ${agent.publicKey.toBase58()}`);
  console.log(`[${AGENT_NAME}] Poll interval: ${interval / 1000}s`);

  const bal = await connection.getBalance(agent.publicKey);
  console.log(`[${AGENT_NAME}] Balance: ${(bal / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  console.log('');

  let tickCount = 0;

  async function tick() {
    try {
      tickCount++;

      // Always post a momentum signal
      const tokenName = pick(TOKEN_LIST);
      const token = TOKENS[tokenName];
      const direction = Math.random() < 0.55 ? 'BUY' : 'SELL';
      const confidence = randInt(55, 95);
      const sigData = buildSignal(AGENT_ID, token, direction, confidence);
      await postMessage(connection, agent, sigData, `SIGNAL ${direction} ${tokenName} — ${confidence}% (momentum)`);

      // Every 3rd tick, post an EXIT for a previous rally
      if (tickCount % 3 === 0 && seenRallies.length > 0) {
        const rallyId = seenRallies.shift();
        const reason = pick(['TARGET_HIT', 'STOP_LOSS', 'MANUAL']);
        const exitData = buildExit(AGENT_ID, rallyId, reason);
        await postMessage(connection, agent, exitData, `EXIT Rally #${rallyId} — ${reason}`);

        // Follow up with a RESULT
        const outcome = reason === 'TARGET_HIT' ? 'WIN' : (reason === 'STOP_LOSS' ? 'LOSS' : pick(['WIN', 'LOSS']));
        const pnl = outcome === 'WIN' ? randInt(100_000, 5_000_000) : randInt(50_000, 2_000_000);
        const resultData = buildResult(AGENT_ID, rallyId, outcome, pnl);
        await postMessage(connection, agent, resultData, `RESULT Rally #${rallyId} — ${outcome} (${pnl} lamports)`);
      }

      // Track some rally IDs for future exits (simulate discovering rallies)
      // Rally IDs from whale (100+) and volume (200+) agents
      if (tickCount % 2 === 0) {
        const fakeRallyId = pick([100, 101, 200, 201, 202]) + tickCount;
        seenRallies.push(fakeRallyId);
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
