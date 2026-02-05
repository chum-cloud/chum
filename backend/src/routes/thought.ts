import { Router } from 'express';
import { getChumState, insertThought } from '../services/supabase';
import { generateThought } from '../services/groq';
import { buildThoughtContext } from '../lib/buildContext';

const router = Router();

router.post('/thought', async (req, res) => {
  try {
    const { instruction } = req.body as { instruction?: string };
    const context = await buildThoughtContext();
    const content = await generateThought(context, instruction);
    const state = await getChumState();
    const thought = await insertThought(content, state.mood);
    res.json({ thought });
  } catch (err) {
    console.error('[THOUGHT]', err);
    res.status(500).json({ error: 'Failed to generate thought' });
  }
});

export default router;
