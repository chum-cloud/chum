import { Router } from 'express';
import {
  getChumState,
  insertThought,
  markThoughtTweeted,
} from '../services/supabase';
import { generateThought } from '../services/groq';
import { postTweet } from '../services/twitter';
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

router.post('/tweet', async (req, res) => {
  try {
    const { content: providedContent } = req.body as { content?: string };
    const state = await getChumState();

    let content: string;
    if (providedContent) {
      content = providedContent.slice(0, 280);
    } else {
      const context = stateToContext(state);
      content = await generateThought(context);
    }

    const thought = await insertThought(content, state.mood);
    const tweetId = await postTweet(content);
    await markThoughtTweeted(thought.id, tweetId);

    res.json({ tweetId, thought });
  } catch (err) {
    console.error('[TWEET]', err);
    res.status(500).json({ error: 'Failed to post tweet' });
  }
});

export default router;
