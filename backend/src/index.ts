import express from 'express';
import cors from 'cors';
import { config } from './config';
import stateRouter from './routes/state';
import thoughtRouter from './routes/thought';
import tweetRouter from './routes/tweet';
import thoughtsRouter from './routes/thoughts';
import villainRouter from './routes/villain';
import cloudRouter from './routes/cloud';
import skillRouter from './routes/skill';
import webhookRouter from './routes/webhook';
import agentsRouter from './routes/agents';
import { startBalanceCheck } from './cron/balanceCheck';
import { startBrainAgent } from './cron/brainAgent';
import { startPriceMonitor } from './cron/priceMonitor';
import streamRouter from './routes/stream';
import roomRouter from './routes/room';
import verifyRouter from './routes/verify';
import tradingRouter from './routes/trading';
import chatRouter from './routes/chat';
import tasksRouter from './routes/tasks';
import { startEventThoughtListener } from './services/eventThoughts';
import { Heartbeat } from './engine/heartbeat';
import { seedAgentSystem, checkSeedingNeeded } from './engine/seed';
import { generateVillainImageVertexOnly, generateVillainImageGeminiFal, generateRandomTraits, buildPrompt, calculateRarityScore } from './services/gemini';
import { uploadVillainToStorage } from './services/storage';
import { insertVillain, getPoolCount } from './services/supabase';
import { fal } from '@fal-ai/client';

const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', stateRouter);
app.use('/api', thoughtRouter);
app.use('/api', tweetRouter);
app.use('/api', thoughtsRouter);
app.use('/api', villainRouter);
app.use('/api', cloudRouter);
app.use('/api', skillRouter);
app.use('/api/webhook', webhookRouter);
app.use('/api', streamRouter);
app.use('/api', roomRouter);
app.use('/api/verify', verifyRouter);
app.use('/api/trading', tradingRouter);
app.use('/api', chatRouter);
app.use('/api/agents', agentsRouter);
app.use('/api', tasksRouter);

app.listen(config.port, async () => {
  console.log(`[CHUM] Server running on port ${config.port}`);
  
  // Start existing cron jobs
  startBalanceCheck();
  startEventThoughtListener();
  startBrainAgent();
  startPriceMonitor();

  // Sync on-chain mints every 2 minutes
  setInterval(async () => {
    try {
      const resp = await fetch(`http://localhost:${config.port}/api/villains/sync`, { method: 'POST' });
      const data = await resp.json() as { synced: number; total: number };
      if (data.synced > 0) console.log(`[SYNC] Auto-synced ${data.synced} mints, total: ${data.total}`);
    } catch (e) {
      // Ignore sync errors
    }
  }, 2 * 60 * 1000); // every 2 min
  
  // Pool manager: Vertex drip (1/min) + burst refill when pool < 30
  const POOL_TARGET = 60;
  const POOL_HALF = POOL_TARGET / 2;
  const POOL_CAP = 668; // Stop generating when pool hits this
  let poolBurstRunning = false;

  // Vertex AI steady drip — 2 per minute (every 30s)
  setInterval(async () => {
    try {
      const current = await getPoolCount();
      if (current >= POOL_CAP) { return; }
      const { imageBuffer, traits, rarityScore } = await generateVillainImageVertexOnly();
      const poolAddr = `pool-vertex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { imageUrl } = await uploadVillainToStorage(imageBuffer, traits, poolAddr, rarityScore);
      await insertVillain(poolAddr, imageUrl, '', traits, 0, rarityScore);
      console.log(`[POOL-VERTEX] Drip OK, pool now ~${current + 1}, image: ${imageUrl.slice(-40)}`);
    } catch (err: any) {
      console.warn(`[POOL-VERTEX] Drip failed: ${err.message?.slice(0, 150)}`);
    }
  }, 30 * 1000);

  // Burst refill DISABLED — pool has 2500+ villains ready
  /* setInterval(async () => {
    if (poolBurstRunning) return;
    try {
      const current = await getPoolCount();
      if (current >= POOL_HALF) return;

      poolBurstRunning = true;
      console.log(`[POOL-BURST] Pool at ${current}/${POOL_TARGET}, starting burst refill...`);
      const needed = POOL_TARGET - current;
      let generated = 0;

      for (let i = 0; i < needed; i++) {
        try {
          const { imageBuffer, traits, rarityScore } = await generateVillainImageGeminiFal();
          const poolAddr = `pool-burst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const { imageUrl } = await uploadVillainToStorage(imageBuffer, traits, poolAddr, rarityScore);
          await insertVillain(poolAddr, imageUrl, '', traits, 0, rarityScore);
          generated++;
        } catch (err: any) {
          console.warn(`[POOL-BURST] Failed at ${generated}/${needed}: ${err.message}`);
          break; // Rate limited, stop burst
        }
      }
      console.log(`[POOL-BURST] Refilled ${generated} villains`);
    } catch (err: any) {
      console.warn(`[POOL-BURST] Check failed: ${err.message}`);
    } finally {
      poolBurstRunning = false;
    }
  }, 30 * 1000); */ // check every 30s

  // fal.ai parallel generators — run continuously when pool < POOL_CAP
  async function falGenerator(label: string, apiKey: string) {
    while (true) {
      try {
        const current = await getPoolCount();
        if (current >= POOL_CAP) {
          await new Promise(r => setTimeout(r, 30000)); // Wait 30s, check again
          continue;
        }
        const traits = generateRandomTraits();
        const prompt = buildPrompt(traits);
        const rarityScore = calculateRarityScore(traits);

        fal.config({ credentials: apiKey });
        const result = await fal.subscribe('fal-ai/imagen4/preview', {
          input: { prompt, num_images: 1, aspect_ratio: '1:1', output_format: 'png' },
        }) as any;
        const imageUrl = result.data?.images?.[0]?.url;
        if (!imageUrl) throw new Error('No fal.ai image URL');
        const imgResp = await fetch(imageUrl);
        if (!imgResp.ok) throw new Error(`fal download failed: ${imgResp.status}`);
        const imageBuffer = Buffer.from(await imgResp.arrayBuffer());

        const poolAddr = `pool-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { imageUrl: storedUrl } = await uploadVillainToStorage(imageBuffer, traits, poolAddr, rarityScore);
        await insertVillain(poolAddr, storedUrl, '', traits, 0, rarityScore);
        console.log(`[POOL-${label}] +1 villain, pool: ${current + 1}`);
      } catch (err: any) {
        console.warn(`[POOL-${label}] Failed: ${err.message}`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  // fal.ai generators DISABLED — pool has 2500+ villains, enough for remaining 1193 mints
  const FAL_TOTAL_WORKERS = 0; // was 3
  const falKeys = [process.env.FAL_KEY_2, process.env.FAL_KEY].filter(Boolean) as string[];
  setTimeout(() => {
    let workerCount = 0;
    for (let w = 0; w < FAL_TOTAL_WORKERS && falKeys.length > 0; w++) {
      const key = falKeys[w % falKeys.length];
      const ki = falKeys.indexOf(key);
      falGenerator(`FAL${ki + 1}-W${w + 1}`, key);
      workerCount++;
    }
    console.log(`[CHUM] Started ${workerCount} fal.ai workers across ${falKeys.length} keys (delayed 60s)`);
  }, 60000);

  // Initialize agent system
  try {
    console.log('[CHUM] Initializing agent system...');
    
    // Check if seeding is needed and seed if necessary
    if (await checkSeedingNeeded()) {
      console.log('[CHUM] Seeding agent system...');
      await seedAgentSystem();
    } else {
      console.log('[CHUM] Agent system already seeded');
    }
    
    // Start the heartbeat orchestrator
    console.log('[CHUM] Starting agent heartbeat...');
    Heartbeat.startHeartbeat();
    
    console.log('[CHUM] ✅ Agent system initialized successfully');
    
  } catch (error) {
    console.error('[CHUM] ❌ Failed to initialize agent system:', error);
  }
});
