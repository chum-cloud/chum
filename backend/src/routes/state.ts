import { Router } from 'express';
import { getChumState, getLatestThought, getRecentThoughts, getTodayRevenue, getRecentExpenses } from '../services/supabase';
import { BRAIN_TIER_NAMES } from '../types';
import type { ChumStateResponse, BrainTier } from '../types';
import { getSolPrice, usdToSol } from '../services/price';
import { getEffectiveBalance, getTodayBurn, getTodayOpCount } from '../services/costs';
import { canAfford } from '../services/costs';
import { OPERATION_COSTS, BASE_DAILY_COST_USD, DEFAULT_DAILY_OPS_USD } from '../config/costs';

const router = Router();

router.get('/state', async (_req, res) => {
  try {
    const [state, thought, recentThoughtRows, revenueToday, solPrice, effectiveBalance, todayBurnSol, todayOpCount, last7dExpenses] = await Promise.all([
      getChumState(),
      getLatestThought(),
      getRecentThoughts(10),
      getTodayRevenue(),
      getSolPrice(),
      getEffectiveBalance(),
      getTodayBurn(),
      getTodayOpCount(),
      getRecentExpenses(7),
    ]);

    const balance = Number(state.balance);
    const todayBurnUsd = todayBurnSol * solPrice;

    // Base hosting cost (always present) + tracked operation costs
    const baseDailySol = usdToSol(BASE_DAILY_COST_USD, solPrice);
    const opsDailyBurn = last7dExpenses > 0
      ? last7dExpenses / 7
      : usdToSol(DEFAULT_DAILY_OPS_USD, solPrice);
    const estimatedDailyBurn = baseDailySol + opsDailyBurn;

    // Health = how many days of runway / 30-day max, capped at 100
    const healthPercent = Math.min(
      100,
      estimatedDailyBurn > 0 ? (effectiveBalance / (estimatedDailyBurn * 30)) * 100 : 100
    );
    const timeToDeathHours =
      estimatedDailyBurn > 0 ? (effectiveBalance / estimatedDailyBurn) * 24 : Infinity;

    const thoughtCostSol = usdToSol(OPERATION_COSTS.GROQ_THOUGHT, solPrice);
    const thoughtsRemaining = thoughtCostSol > 0 ? Math.floor(effectiveBalance / thoughtCostSol) : Infinity;

    const canThink = await canAfford('GROQ_THOUGHT');

    const response: ChumStateResponse = {
      balance,
      burnRate: estimatedDailyBurn,
      healthPercent,
      mood: state.mood,
      brainTier: state.brain_tier,
      brainTierName:
        BRAIN_TIER_NAMES[state.brain_tier as BrainTier] ?? 'Canned Chum',
      totalRevenue: Number(state.total_revenue),
      revenueToday,
      timeToDeathHours,
      latestThought: thought?.content ?? null,
      recentThoughts: recentThoughtRows.map((t) => t.content),
      updatedAt: state.updated_at,
      daysAlive: state.days_alive,
      isDead: state.is_dead,
      effectiveBalance,
      todayBurnSol,
      todayBurnUsd,
      todayOpCount,
      estimatedDailyBurn,
      thoughtsRemaining: thoughtsRemaining === Infinity ? -1 : thoughtsRemaining,
      solPrice,
      canThink,
    };

    res.json(response);
  } catch (err) {
    console.error('[STATE]', err);
    res.status(500).json({ error: 'Failed to fetch state' });
  }
});

export default router;
