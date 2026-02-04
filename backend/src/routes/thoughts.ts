import { Router } from 'express';
import { getRecentThoughts } from '../services/supabase';

const router = Router();

router.get('/thoughts', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const thoughts = await getRecentThoughts(limit);
    res.json(thoughts);
  } catch (err) {
    console.error('[THOUGHTS]', err);
    res.status(500).json({ error: 'Failed to fetch thoughts' });
  }
});

export default router;
