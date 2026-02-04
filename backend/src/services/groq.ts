import Groq from 'groq-sdk';
import { config } from '../config';
import { buildUserPrompt, SYSTEM_PROMPT } from '../lib/prompt';
import { applyMassGlitch } from '../lib/massGlitch';
import { getChumState } from './supabase';
import { BURN_RATE } from '../types';
import type { ChumStateRow } from '../types';

const groq = new Groq({ apiKey: config.groqApiKey });

export interface ThoughtContext {
  balance: number;
  burnRate: number;
  healthPercent: number;
  mood: string;
  brainTier: number;
  revenueToday: number;
}

function stateToContext(state: ChumStateRow): ThoughtContext {
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

export async function generateThought(
  context?: ThoughtContext,
  instruction?: string
): Promise<string> {
  const ctx = context ?? stateToContext(await getChumState());

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(ctx, instruction) },
    ],
    temperature: 0.9,
    max_tokens: 150,
  });

  let text = completion.choices[0]?.message?.content?.trim() ?? '';

  // Strip quotes if the model wraps its response
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }

  text = applyMassGlitch(text, ctx.healthPercent);

  // Truncate to 280 chars (tweet-safe)
  if (text.length > 280) {
    text = text.slice(0, 277) + '...';
  }

  return text;
}
