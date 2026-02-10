import express from 'express';

const router = express.Router();

// Agent system endpoints removed — multi-agent engine not deployed

router.get('/status', (_req, res) => {
  res.json({ message: 'Agent system not active', timestamp: new Date().toISOString() });
});

export default router;
