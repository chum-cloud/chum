import { eventBus, type ChumEvent } from './events';
import { generateThought } from './groq';
import { postTweet } from './twitter';
import { canAfford, trackCost } from './costs';
import { insertThought, markThoughtTweeted, getRecentThoughts, getVillainCount } from './supabase';
import { buildThoughtContext } from '../lib/buildContext';
import { checkUniqueness } from '../lib/uniqueness';
import type { ThoughtRow } from '../types';

type SSECallback = (thought: ThoughtRow) => void;

const sseClients = new Set<SSECallback>();

export function registerSSEClient(callback: SSECallback): void {
  sseClients.add(callback);
}

export function unregisterSSEClient(callback: SSECallback): void {
  sseClients.delete(callback);
}

function broadcastThought(thought: ThoughtRow): void {
  for (const cb of sseClients) {
    try {
      cb(thought);
    } catch {
      // Remove broken clients
      sseClients.delete(cb);
    }
  }
}

function senderSnippet(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const PERIODIC_ANGLES = [
  'Karen tactical conversation',
  'Late night scheming at HQ',
  'Mr. Krabs rivalry (old world vs new)',
  'Army growth update (Fellow Villains)',
  'World domination planning',
  'Empty restaurant irony (no customers, but building a revolution)',
  'Reacting to market (army advances or traitors)',
  'The duality (pathetic outside, scheming inside)',
];

function timeOfDayLabel(): string {
  const hour = new Date().getUTCHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'late night';
}

async function buildInstruction(event: ChumEvent, ctx: Awaited<ReturnType<typeof buildThoughtContext>>): Promise<string> {
  switch (event.type) {
    case 'DONATION': {
      const villainCount = ctx.villainCount;
      return `JUST NOW: Wallet ${senderSnippet(event.sender)} donated ${event.amount.toFixed(4)} SOL to the war chest!
War chest now holds ${ctx.balance.toFixed(4)} SOL. Runway: ${(ctx.balance / ctx.burnRate * 24).toFixed(1)}h. Army: ${villainCount} soldiers.
React with genuine excitement. Reference the specific amount. Be dramatic.`;
    }

    case 'VILLAIN_CREATED': {
      const villainCount = await getVillainCount();
      return `JUST NOW: New Fellow Villain #${event.villainId} recruited! Wallet ${senderSnippet(event.walletAddress)} donated ${event.donationAmount.toFixed(4)} SOL.
Army: ${villainCount} soldiers. Welcome them triumphantly.`;
    }

    case 'QUIET': {
      return `It's been ${event.minutesSinceLastEvent} minutes since last activity. Time: ${timeOfDayLabel()}.
Pick one: Karen conversation / late-night scheming / market observation / empty restaurant reflection / existential villain moment.
Be introspective.`;
    }

    case 'PERIODIC': {
      const angle = PERIODIC_ANGLES[Math.floor(Math.random() * PERIODIC_ANGLES.length)];
      return `Generate an ambient thought. Angle: ${angle}.
Current context: ${ctx.balance.toFixed(4)} SOL, ${ctx.villainCount} villains, ${ctx.healthPercent.toFixed(0)}% health.`;
    }
  }
}

function shouldTweet(event: ChumEvent): boolean {
  // Always tweet donations and villain creations
  if (event.type === 'DONATION' || event.type === 'VILLAIN_CREATED') return true;
  // 70% for quiet/periodic
  return Math.random() < 0.7;
}

async function handleEvent(event: ChumEvent): Promise<void> {
  try {
    if (!eventBus.canEmitThought()) {
      console.log(`[THOUGHT] Rate limited, skipping ${event.type}`);
      return;
    }

    if (!(await canAfford('GROQ_THOUGHT'))) {
      console.warn('[THOUGHT] BRAIN OFFLINE: Cannot afford thought generation');
      return;
    }

    const ctx = await buildThoughtContext();

    // Override mood for donation events
    if (event.type === 'DONATION') {
      ctx.mood = 'grateful';
    }

    const instruction = await buildInstruction(event, ctx);

    // Fetch recent thoughts for dedup
    const recentThoughtRows = await getRecentThoughts(50);
    const recentContents = recentThoughtRows.map((t) => t.content);

    let content: string | null = null;
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let finalInstruction = instruction;

      if (attempt > 0 && content) {
        // Add banned phrases from previous failed attempt
        const { bannedPhrases } = checkUniqueness(content, recentContents);
        if (bannedPhrases.length > 0) {
          finalInstruction += `\nAVOID these words/themes: ${bannedPhrases.join(', ')}. Find a completely different angle.`;
        }
      }

      content = await generateThought(ctx, finalInstruction);
      await trackCost('GROQ_THOUGHT');

      const { isUnique, similarity } = checkUniqueness(content, recentContents);
      if (isUnique) {
        console.log(`[THOUGHT] Unique thought generated on attempt ${attempt + 1} (similarity: ${similarity.toFixed(2)})`);
        break;
      }

      console.log(`[THOUGHT] Too similar (${similarity.toFixed(2)}) on attempt ${attempt + 1}, ${attempt < MAX_RETRIES ? 'retrying...' : 'using anyway'}`);
    }

    if (!content) return;

    const mood = event.type === 'DONATION' ? 'grateful'
      : event.type === 'VILLAIN_CREATED' ? 'ecstatic'
      : ctx.mood;

    const thought = await insertThought(content, mood);
    console.log(`[THOUGHT] ${event.type}: "${content.slice(0, 60)}..."`);

    eventBus.recordThought();
    broadcastThought(thought);

    // Tweet decision
    if (shouldTweet(event)) {
      try {
        const tweetId = await postTweet(content);
        await markThoughtTweeted(thought.id, tweetId);
        await trackCost('TWITTER_POST');
        console.log(`[THOUGHT] Tweeted: ${tweetId}`);
      } catch (err) {
        console.error('[THOUGHT] Tweet failed:', err);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('BRAIN_OFFLINE')) {
      console.warn(`[THOUGHT] BRAIN OFFLINE for ${event.type}:`, msg);
    } else {
      console.error(`[THOUGHT] Failed to handle ${event.type}:`, err);
    }
  }
}

export function startEventThoughtListener(): void {
  eventBus.on('event', (event: ChumEvent) => {
    handleEvent(event).catch((err) => {
      console.error('[THOUGHT] Unhandled error in event handler:', err);
    });
  });
  console.log('[THOUGHT] Event listener started');
}
