import { Router } from 'express';
import { getChumState, insertThought } from '../services/supabase';
import { generateThought } from '../services/groq';
import { BURN_RATE } from '../types';
import type { ChumStateRow } from '../types';

const router = Router();

function stateToContext(state: ChumStateRow) {
  const balance = Number(state.balance);
  const healthPercent = Math.min(
    100,
    BURN_RATE > 0 ? (balance / (BURN_RATE * 30)) * 100 : 100
  );
  return {
    balance,
    burnRate: BURN_RATE,
    healthPercent,
    mood: state.mood,
    brainTier: state.brain_tier,
    revenueToday: 0,
  };
}

router.post('/thought', async (req, res) => {
  try {
    const { instruction } = req.body as { instruction?: string };
    const state = await getChumState();
    const context = stateToContext(state);
    const content = await generateThought(context, instruction);
    const thought = await insertThought(content, state.mood);
    res.json({ thought });
  } catch (err) {
    console.error('[THOUGHT]', err);
    res.status(500).json({ error: 'Failed to generate thought' });
  }
});

export default router;
