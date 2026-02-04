import { getChumState, insertThought, markThoughtTweeted } from '../services/supabase';
import { generateThought } from '../services/groq';
import { postTweet } from '../services/twitter';
import { BURN_RATE } from '../types';

function randomDelayMs(): number {
  // 1-4 hours in milliseconds
  const minHours = 1;
  const maxHours = 4;
  const hours = minHours + Math.random() * (maxHours - minHours);
  return hours * 60 * 60 * 1000;
}

async function runThoughtCycle(): Promise<void> {
  try {
    const state = await getChumState();
    const balance = Number(state.balance);
    const healthPercent = Math.min(
      100,
      BURN_RATE > 0 ? (balance / (BURN_RATE * 30)) * 100 : 100
    );
    const context = {
      balance,
      burnRate: BURN_RATE,
      healthPercent,
      mood: state.mood,
      brainTier: state.brain_tier,
      revenueToday: 0,
    };

    const content = await generateThought(context);
    const thought = await insertThought(content, state.mood);
    console.log(`[THOUGHT] Generated: "${content.slice(0, 60)}..."`);

    // 70% chance to tweet
    if (Math.random() < 0.7) {
      try {
        const tweetId = await postTweet(content);
        await markThoughtTweeted(thought.id, tweetId);
        console.log(`[THOUGHT] Tweeted: ${tweetId}`);
      } catch (err) {
        console.error('[THOUGHT] Tweet failed:', err);
      }
    }
  } catch (err) {
    console.error('[THOUGHT] Cycle failed:', err);
  }
}

function scheduleNext(): void {
  const delay = randomDelayMs();
  const hours = (delay / 1000 / 60 / 60).toFixed(1);
  console.log(`[THOUGHT] Next thought in ${hours} hours`);
  setTimeout(async () => {
    await runThoughtCycle();
    scheduleNext();
  }, delay);
}

export function startThoughtLoop(): void {
  console.log('[CRON] Thought loop started');
  // First thought after a short delay (30s) to let everything initialize
  setTimeout(async () => {
    await runThoughtCycle();
    scheduleNext();
  }, 30_000);
}
