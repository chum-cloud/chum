import Groq from 'groq-sdk';
import { config } from '../config';
import { buildUserPrompt, SYSTEM_PROMPT } from '../lib/prompt';
import { applyMassGlitch } from '../lib/massGlitch';
import { buildThoughtContext } from '../lib/buildContext';
import { canAfford, trackCost } from './costs';
import { generateVertexText, isVertexConfigured } from './vertex';

const groq = new Groq({ apiKey: config.groqApiKey });

export interface ThoughtContext {
  balance: number;
  burnRate: number;
  healthPercent: number;
  mood: string;
  brainTier: number;
  revenueToday: number;
  daysAlive: number;
  totalRevenue: number;
  totalThoughts: number;
  villainCount: number;
  newVillainsToday: number;
  currentHour: number;
  recentThoughts: string[];

  // Market data
  chumPriceUsd: number | null;
  chumChange24h: number | null;
  chumVolume24h: number | null;
  chumLiquidity: number | null;
  solPriceUsd: number;
  solChange24h: number | null;
  btcPriceUsd: number | null;
  btcChange24h: number | null;
  ethPriceUsd: number | null;
  ethChange24h: number | null;

  // Cloud stats
  agentCount: number;
  postsToday: number;
  activeBattles: number;
  topAgentName: string | null;
}

export async function generateThought(
  context?: ThoughtContext,
  instruction?: string
): Promise<string> {
  if (!(await canAfford('VERTEX_THOUGHT'))) {
    throw new Error('BRAIN_OFFLINE: Cannot afford thought');
  }

  const ctx = context ?? (await buildThoughtContext());
  const userPrompt = buildUserPrompt(ctx, instruction);

  let text: string;

  // Primary: Vertex AI (Gemini 2.0 Flash) — no free-tier rate limits
  if (isVertexConfigured()) {
    try {
      text = await generateVertexText(SYSTEM_PROMPT, userPrompt, {
        maxTokens: 150,
        temperature: 0.9,
      });
      console.log('[THOUGHT] Generated via Vertex AI');
      await trackCost('VERTEX_THOUGHT');
    } catch (vertexErr) {
      console.warn('[THOUGHT] Vertex AI failed, falling back to Groq:', (vertexErr as Error).message);
      text = await generateThoughtGroq(userPrompt);
      await trackCost('GROQ_THOUGHT');
    }
  } else {
    // Fallback: Groq (Llama 3.3 70B)
    text = await generateThoughtGroq(userPrompt);
    await trackCost('GROQ_THOUGHT');
  }

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

/**
 * Generate longer content for Cloud posts and battle entries.
 * Similar to generateThought but with configurable length limits.
 */
export async function generateContent(
  context: ThoughtContext,
  instruction: string,
  opts: { maxTokens?: number; maxChars?: number } = {}
): Promise<string> {
  const { maxTokens = 300, maxChars = 500 } = opts;

  if (!(await canAfford('VERTEX_CONTENT'))) {
    throw new Error('BRAIN_OFFLINE: Cannot afford content generation');
  }

  const userPrompt = buildUserPrompt(context, instruction);
  let text: string;

  // Primary: Vertex AI
  if (isVertexConfigured()) {
    try {
      text = await generateVertexText(SYSTEM_PROMPT, userPrompt, {
        maxTokens,
        temperature: 0.9,
      });
      console.log('[CONTENT] Generated via Vertex AI');
      await trackCost('VERTEX_CONTENT');
    } catch (vertexErr) {
      console.warn('[CONTENT] Vertex AI failed, falling back to Groq:', (vertexErr as Error).message);
      text = await generateContentGroq(userPrompt, maxTokens);
      await trackCost('GROQ_CLOUD_POST');
    }
  } else {
    text = await generateContentGroq(userPrompt, maxTokens);
    await trackCost('GROQ_CLOUD_POST');
  }

  // Strip quotes if the model wraps its response
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }

  text = applyMassGlitch(text, context.healthPercent);

  // Truncate to maxChars
  if (text.length > maxChars) {
    text = text.slice(0, maxChars - 3) + '...';
  }

  return text;
}

/** Groq fallback for thought generation */
async function generateThoughtGroq(userPrompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.9,
    max_tokens: 150,
  });

  console.log('[THOUGHT] Generated via Groq (fallback)');
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

/** Groq fallback for content generation */
async function generateContentGroq(userPrompt: string, maxTokens: number): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.9,
    max_tokens: maxTokens,
  });

  console.log('[CONTENT] Generated via Groq (fallback)');
  return completion.choices[0]?.message?.content?.trim() ?? '';
}
