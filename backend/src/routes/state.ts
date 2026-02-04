import { Router } from 'express';
import { getChumState, getLatestThought, getTodayRevenue } from '../services/supabase';
import { BRAIN_TIER_NAMES, BURN_RATE } from '../types';
import type { ChumStateResponse, BrainTier } from '../types';

const router = Router();

router.get('/state', async (_req, res) => {
  try {
    const [state, thought, revenueToday] = await Promise.all([
      getChumState(),
      getLatestThought(),
      getTodayRevenue(),
    ]);

    const balance = Number(state.balance);
    const burnRate = BURN_RATE;
    // Health = how many days of runway / 30-day max, capped at 100
    const healthPercent = Math.min(
      100,
      burnRate > 0 ? (balance / (burnRate * 30)) * 100 : 100
    );
    const timeToDeathHours =
      burnRate > 0 ? (balance / burnRate) * 24 : Infinity;

    const response: ChumStateResponse = {
      balance,
      burnRate,
      healthPercent,
      mood: state.mood,
      brainTier: state.brain_tier,
      brainTierName:
        BRAIN_TIER_NAMES[state.brain_tier as BrainTier] ?? 'Canned Chum',
      totalRevenue: Number(state.total_revenue),
      revenueToday,
      timeToDeathHours,
      latestThought: thought?.content ?? null,
      updatedAt: state.updated_at,
      daysAlive: state.days_alive,
      isDead: state.is_dead,
    };

    res.json(response);
  } catch (err) {
    console.error('[STATE]', err);
    res.status(500).json({ error: 'Failed to fetch state' });
  }
});

export default router;
