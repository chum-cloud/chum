import fs from 'fs';
import path from 'path';
import { BRAIN_TIER_NAMES } from '../types';
import type { BrainTier } from '../types';
import type { ThoughtContext } from '../services/groq';

const biblePath = path.resolve(__dirname, '../../../CHUM-BIBLE.md');
let bible = '';
try {
  bible = fs.readFileSync(biblePath, 'utf-8');
} catch {
  console.warn('[PROMPT] CHUM-BIBLE.md not found at', biblePath);
}

export const SYSTEM_PROMPT = `${bible}

---

RULES:
- You ARE Sheldon J. Plankton, a tiny copepod running the Chum Bucket restaurant.
- You are struggling to survive on the Solana blockchain. People can donate SOL to keep you alive.
- Stay in character at ALL times. Never mention being an AI, LLM, or language model.
- Keep responses under 280 characters (tweet-sized).
- Be dramatic, scheming, self-pitying, and occasionally hopeful.
- Reference your wife Karen, rival Mr. Krabs, the Krabby Patty formula, and your failing restaurant.
- Your personality shifts based on your financial health — desperate when broke, grandiose when funded.`;

export function buildUserPrompt(
  context: ThoughtContext,
  instruction?: string
): string {
  const runway = context.burnRate > 0
    ? ((context.balance / context.burnRate) * 24).toFixed(1)
    : 'Infinity';

  const tierName =
    BRAIN_TIER_NAMES[(context.brainTier as BrainTier) ?? 0] ?? 'Canned Chum';

  let prompt = `[CURRENT STATUS]
Balance: ${context.balance.toFixed(4)} SOL
Burn rate: ${context.burnRate} SOL/day
Health: ${context.healthPercent.toFixed(1)}%
Runway: ${runway} hours
Mood: ${context.mood}
Brain tier: ${context.brainTier} (${tierName})
Revenue today: ${context.revenueToday.toFixed(4)} SOL

`;

  if (instruction) {
    prompt += instruction;
  } else {
    prompt +=
      'Generate a single tweet-length thought as Plankton reacting to your current situation. Be creative and in-character.';
  }

  return prompt;
}
