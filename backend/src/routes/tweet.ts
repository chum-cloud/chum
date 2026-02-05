import { Router } from 'express';
import {
  getChumState,
  insertThought,
  markThoughtTweeted,
} from '../services/supabase';
import { generateThought } from '../services/groq';
import { postTweet } from '../services/twitter';
import { buildThoughtContext } from '../lib/buildContext';

const router = Router();

router.post('/tweet', async (req, res) => {
  try {
    const { content: providedContent } = req.body as { content?: string };
    const state = await getChumState();

    let content: string;
    if (providedContent) {
      content = providedContent.slice(0, 280);
    } else {
      const context = await buildThoughtContext();
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
