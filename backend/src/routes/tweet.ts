import { Router } from 'express';
import {
  getChumState,
  insertThought,
  markThoughtTweeted,
} from '../services/supabase';
import { generateThought } from '../services/groq';
import { postTweet, testTwitterConnection } from '../services/twitter';
import { buildThoughtContext } from '../lib/buildContext';
import { buildTriggerLine } from '../lib/prompt';

const router = Router();

router.post('/tweet', async (req, res) => {
  try {
    const { content: providedContent } = req.body as { content?: string };
    const state = await getChumState();
    const context = await buildThoughtContext();

    let content: string;
    if (providedContent) {
      content = providedContent.slice(0, 280);
    } else {
      content = await generateThought(context);
    }

    const trigger = buildTriggerLine(context);
    const thought = await insertThought(content, state.mood, trigger);
    const tweetId = await postTweet(content);
    await markThoughtTweeted(thought.id, tweetId);

    res.json({ tweetId, thought });
  } catch (err) {
    console.error('[TWEET]', err);
    res.status(500).json({ error: 'Failed to post tweet' });
  }
});

/**
 * Test endpoint to diagnose Twitter API issues
 * POST /api/tweet-test
 * Returns full error details if tweet fails
 */
router.post('/tweet-test', async (_req, res) => {
  const result = await testTwitterConnection();
  res.json(result);
});

export default router;
