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
