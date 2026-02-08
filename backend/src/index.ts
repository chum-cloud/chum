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
  const POOL_CAP = 300; // Stop generating when pool hits this
  let poolBurstRunning = false;

  // Vertex AI steady drip — 1 villain per minute, pauses at POOL_CAP
  setInterval(async () => {
    try {
      const currentPool = await getPoolCount();
      if (currentPool >= POOL_CAP) {
        return; // Pool full, skip
      }
      const { imageBuffer, traits, rarityScore } = await generateVillainImageVertexOnly();
      const poolAddr = `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { imageUrl } = await uploadVillainToStorage(imageBuffer, traits, poolAddr, rarityScore);
      await insertVillain(poolAddr, imageUrl, '', traits, 0, rarityScore);
      const count = await getPoolCount();
      console.log(`[POOL-VERTEX] +1 villain, pool: ${count}`);
    } catch (err: any) {
      console.warn(`[POOL-VERTEX] Failed: ${err.message}`);
    }
  }, 60 * 1000); // every 1 min

  // Burst refill check — every 30s, triggers when pool < half
  setInterval(async () => {
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
  }, 30 * 1000); // check every 30s

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

  // Start fal.ai generators — 3 workers per key for max throughput
  const FAL_WORKERS_PER_KEY = 5;
  const falKeys = [process.env.FAL_KEY, process.env.FAL_KEY_2].filter(Boolean) as string[];
  falKeys.forEach((key, ki) => {
    for (let w = 0; w < FAL_WORKERS_PER_KEY; w++) {
      falGenerator(`FAL${ki + 1}-W${w + 1}`, key);
    }
    console.log(`[CHUM] Started ${FAL_WORKERS_PER_KEY} fal.ai workers for key ${ki + 1}`);
  });

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
