import { eventBus, type ChumEvent } from './events';
import { generateThought } from './groq';
import { postTweet } from './twitter';
import { canAfford, trackCost } from './costs';
import { insertThought, markThoughtTweeted, getRecentThoughts, getVillainCount } from './supabase';
import { buildThoughtContext } from '../lib/buildContext';
import { buildTriggerLine } from '../lib/prompt';
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

export function broadcastThought(thought: ThoughtRow): void {
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
  'React to the current $CHUM price and volume',
  'React to SOL/BTC/ETH market moves',
  'Comment on the Chum Cloud community activity',
  'Karen tactical conversation about current finances',
  'Late night scheming with market context',
  'Mr. Krabs rivalry — compare his empire to yours using real numbers',
  'Existential reflection on survival using your actual runway',
  'React to the gap between your ambitions and your wallet balance',
  'Army growth update (Fellow Villains) tied to market conditions',
  'The duality (pathetic outside, scheming inside) with real data',
];

function timeOfDayLabel(): string {
  const hour = new Date().getUTCHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'late night';
}

function formatPrice(price: number): string {
  if (price < 0.00001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  return price.toFixed(4);
}

function formatMarketCap(mc: number): string {
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
  return `$${mc.toFixed(0)}`;
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

    case 'PRICE_PUMP': {
      return `$CHUM IS PUMPING! Price: ${formatPrice(event.price)} (up ${event.change1h.toFixed(1)}% in 1 hour!).
24h change: ${event.change24h > 0 ? '+' : ''}${event.change24h.toFixed(1)}%. Market cap: ${formatMarketCap(event.marketCap)}.
React with VILLAIN EXCITEMENT! The revolution is gaining momentum! Reference the real numbers. Be dramatic and celebratory.
End with $CHUM hashtag.`;
    }

    case 'PRICE_DUMP': {
      return `$CHUM is being SOLD by traitors! Price: ${formatPrice(event.price)} (down ${Math.abs(event.change1h).toFixed(1)}% in 1 hour).
24h change: ${event.change24h > 0 ? '+' : ''}${event.change24h.toFixed(1)}%. Market cap: ${formatMarketCap(event.marketCap)}.
React dramatically but stay VILLAINOUS! Paper hands are weak. The revolution continues. Diamond hands prevail.
Reference the real numbers. Stay defiant and scheming. End with $CHUM hashtag.`;
    }

    case 'VOLUME_SPIKE': {
      return `VOLUME SURGE! $CHUM trading volume spiked ${event.volumeMultiplier.toFixed(1)}x the hourly average!
1h volume: $${event.volume1h.toFixed(0)} | Price: ${formatPrice(event.price)} | Market cap: ${formatMarketCap(event.marketCap)}.
The army is MOBILIZING! Something big is brewing. React with villain energy — the revolution's momentum is building.
End with $CHUM hashtag.`;
    }
  }
}

/**
 * Determine if this event should trigger a tweet.
 * Prioritizes high-value events, respects daily limit.
 */
function shouldTweet(event: ChumEvent): boolean {
  // Check daily limit first
  if (!eventBus.canTweetToday()) {
    console.log('[THOUGHT] Daily tweet limit reached, skipping');
    return false;
  }

  // HIGH PRIORITY — always tweet (donations, villains, market events)
  if (event.type === 'DONATION') return true;
  if (event.type === 'VILLAIN_CREATED') return true;
  if (event.type === 'PRICE_PUMP') return true;
  if (event.type === 'PRICE_DUMP') return true;
  if (event.type === 'VOLUME_SPIKE') return true;

  // LOW PRIORITY — 30% chance for ambient/quiet (reduced from 70%)
  return Math.random() < 0.3;
}

/**
 * Get mood override for specific event types
 */
function getMoodForEvent(event: ChumEvent, defaultMood: string): string {
  switch (event.type) {
    case 'DONATION':
      return 'grateful';
    case 'VILLAIN_CREATED':
      return 'ecstatic';
    case 'PRICE_PUMP':
      return 'ecstatic';
    case 'PRICE_DUMP':
      return 'angry';
    case 'VOLUME_SPIKE':
      return 'excited';
    default:
      return defaultMood;
  }
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

    // Override mood for certain events
    ctx.mood = getMoodForEvent(event, ctx.mood);

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

    const mood = getMoodForEvent(event, ctx.mood);
    const trigger = buildTriggerLine(ctx);
    const thought = await insertThought(content, mood, trigger);
    console.log(`[THOUGHT] ${event.type}: "${content.slice(0, 60)}..."`);

    eventBus.recordThought();
    broadcastThought(thought);

    // Tweet decision
    if (shouldTweet(event)) {
      try {
        const tweetId = await postTweet(content);
        await markThoughtTweeted(thought.id, tweetId);
        await trackCost('TWITTER_POST');
        eventBus.recordTweet();
        console.log(`[THOUGHT] Tweeted: ${tweetId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Log specific error for 402 (rate limit)
        if (msg.includes('402') || msg.includes('CreditsDepleted')) {
          console.error('[THOUGHT] Tweet failed: Twitter credits depleted (402)');
        } else {
          console.error('[THOUGHT] Tweet failed:', msg);
        }
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
