import cron from 'node-cron';
import { getWalletBalance } from '../services/solana';
import {
  getChumState,
  updateChumState,
  insertTransaction,
  insertThought,
  markThoughtTweeted,
} from '../services/supabase';
import { generateThought } from '../services/groq';
import { postTweet } from '../services/twitter';
import { BURN_RATE } from '../types';
import type { Mood } from '../types';

function moodFromHealth(health: number): Mood {
  if (health > 80) return 'ecstatic';
  if (health > 60) return 'content';
  if (health > 40) return 'hopeful';
  if (health > 20) return 'anxious';
  if (health > 10) return 'desperate';
  return 'devastated';
}

async function checkBalance(): Promise<void> {
  try {
    const balance = await getWalletBalance();
    const state = await getChumState();
    const prevBalance = Number(state.balance);

    const healthPercent = Math.min(
      100,
      BURN_RATE > 0 ? (balance / (BURN_RATE * 30)) * 100 : 100
    );
    const mood = moodFromHealth(healthPercent);

    // Detect donation (balance increase > 0.01 SOL)
    const increase = balance - prevBalance;
    if (increase > 0.01) {
      await insertTransaction(
        'donation',
        increase,
        `Detected +${increase.toFixed(4)} SOL`
      );
      console.log(`[BALANCE] Donation detected: +${increase.toFixed(4)} SOL`);

      // Celebrate
      try {
        const content = await generateThought(
          {
            balance,
            burnRate: BURN_RATE,
            healthPercent,
            mood: 'grateful',
            brainTier: state.brain_tier,
            revenueToday: increase,
          },
          `Someone just donated ${increase.toFixed(4)} SOL! React with excitement and gratitude. Be dramatic.`
        );
        const thought = await insertThought(content, 'grateful');
        const tweetId = await postTweet(content);
        await markThoughtTweeted(thought.id, tweetId);
        console.log(`[BALANCE] Celebration tweet posted: ${tweetId}`);
      } catch (err) {
        console.error('[BALANCE] Failed to tweet celebration:', err);
      }
    }

    // Only update columns that exist in the DB
    await updateChumState({
      balance,
      mood,
    });

    console.log(
      `[BALANCE] ${balance.toFixed(4)} SOL | ${healthPercent.toFixed(1)}% health | ${mood}`
    );
  } catch (err) {
    console.error('[BALANCE] Check failed:', err);
  }
}

export function startBalanceCheck(): void {
  // Every 5 minutes
  cron.schedule('*/5 * * * *', checkBalance);
  console.log('[CRON] Balance check started (every 5 min)');
  // Run once immediately
  checkBalance();
}
