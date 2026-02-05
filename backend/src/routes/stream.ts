import { Router } from 'express';
import { getRecentThoughts } from '../services/supabase';
import { registerSSEClient, unregisterSSEClient } from '../services/eventThoughts';
import type { ThoughtRow } from '../types';

const router = Router();

router.get('/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial thoughts
  try {
    const recent = await getRecentThoughts(5);
    res.write(`event: initial\ndata: ${JSON.stringify(recent)}\n\n`);
  } catch (err) {
    console.error('[STREAM] Failed to send initial thoughts:', err);
    res.write(`event: initial\ndata: []\n\n`);
  }

  // Register for new thoughts
  const onThought = (thought: ThoughtRow) => {
    res.write(`event: thought\ndata: ${JSON.stringify(thought)}\n\n`);
  };
  registerSSEClient(onThought);

  // Heartbeat every 15s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15_000);

  // Cleanup on disconnect
  req.on('close', () => {
    unregisterSSEClient(onThought);
    clearInterval(heartbeat);
  });
});

export default router;
