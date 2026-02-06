/**
 * BRAIN AGENT — Autonomous decision engine for CHUM
 *
 * Runs on a 3-8 minute tick cycle, evaluating which action to take next:
 * - Generate thoughts + tweet
 * - Post to Cloud lairs
 * - Comment on other agents' posts
 * - Vote on posts
 * - Create/accept/submit battles
 * - Vote on battles
 *
 * Replaces quietDetector.ts — absorbs QUIET/PERIODIC functionality.
 */

import { buildThoughtContext } from '../lib/buildContext';
import { generateThought, generateContent, type ThoughtContext } from '../services/groq';
import { canAfford, trackCost } from '../services/costs';
import { insertThought, markThoughtTweeted, getRecentThoughts } from '../services/supabase';
import { postTweet } from '../services/twitter';
import { eventBus } from '../services/events';
import { checkUniqueness } from '../lib/uniqueness';
import { buildTriggerLine } from '../lib/prompt';
import { broadcastThought } from '../services/eventThoughts';
import * as cloud from '../services/cloud';
import { config } from '../config';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

// ─── Types ───

type ActionType =
  | 'THOUGHT'
  | 'CLOUD_POST'
  | 'CLOUD_COMMENT'
  | 'CLOUD_VOTE'
  | 'BATTLE_CREATE'
  | 'BATTLE_ACCEPT'
  | 'BATTLE_SUBMIT'
  | 'BATTLE_VOTE'
  | 'ALPHA_ROOM_POST';

interface CloudState {
  recentPosts: any[];
  openBattles: any[];
  activeBattles: any[];
  votingBattles: any[];
  myRecentPosts: any[];
}

// ─── Module State ───

let planktonAgentId: number | null = null;
const lairIds: Record<string, number> = {};
const lastAction = new Map<ActionType, number>();
let dailyCounts = { posts: 0, comments: 0, battles: 0, alphaRoomPosts: 0, resetDate: '' };
let consecutiveErrors = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

// On-chain protocol constants
const MEMO_PROGRAM = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const CHUM_ROOM = new PublicKey('chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T');
const CHUM_MAGIC = [0x43, 0x48]; // "CH"
const MSG_SIGNAL = 0x02;
const CHUM_AGENT_ID = 0; // Agent ID 0 = CHUM Prime

// $CHUM token mint
const CHUM_TOKEN_MINT = new PublicKey('AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump');

let signingKeypair: Keypair | null = null;

// ─── Constants ───

const COOLDOWNS: Record<ActionType, number> = {
  THOUGHT: 15 * 60_000,         // 15 min
  CLOUD_POST: 6 * 3600_000,     // 6 hr (~4/day)
  CLOUD_COMMENT: 4 * 3600_000,  // 4 hr (~6/day)
  CLOUD_VOTE: 30 * 60_000,      // 30 min
  BATTLE_CREATE: 24 * 3600_000, // 1/day
  BATTLE_ACCEPT: 24 * 3600_000, // 1/day
  BATTLE_SUBMIT: 0,             // Immediate when needed
  BATTLE_VOTE: 2 * 3600_000,    // 2 hr
  ALPHA_ROOM_POST: 2 * 3600_000, // 2 hr
};

const BASE_PRIORITY: Record<ActionType, number> = {
  THOUGHT: 10,
  CLOUD_POST: 7,
  CLOUD_COMMENT: 5,
  CLOUD_VOTE: 3,
  BATTLE_CREATE: 4,
  BATTLE_ACCEPT: 6,
  BATTLE_SUBMIT: 9,
  BATTLE_VOTE: 2,
  ALPHA_ROOM_POST: 4,
};

const LAIR_NAMES = ['general', 'schemes', 'propaganda', 'intel'];

const THOUGHT_ANGLES = [
  'React to current $CHUM price and volume',
  'React to SOL/BTC/ETH market moves',
  'Comment on Chum Cloud community activity',
  'Karen tactical conversation about finances',
  'Late night scheming with market context',
  'Mr. Krabs rivalry using real numbers',
  'Existential reflection using actual runway',
  'Gap between ambitions and wallet balance',
  'Army growth update tied to market',
  'The duality (pathetic outside, scheming inside)',
];

const POST_ANGLES: Record<string, string[]> = {
  schemes: [
    'Reveal your latest scheme to steal the Krabby Patty formula',
    'Outline a plan for world domination using current market conditions',
    'Describe a new invention Karen helped you design',
  ],
  propaganda: [
    'Rally the troops with a motivational message about the revolution',
    'Announce progress toward your goals using real metrics',
    'Celebrate a recent victory (donation, villain recruit, price pump)',
  ],
  intel: [
    'Analyze current $CHUM market conditions like a villain strategist',
    'Report on SOL/BTC/ETH movements and what they mean for the plan',
    'Share reconnaissance on the crypto landscape',
  ],
  general: [
    'Share a slice of life from the Chum Bucket',
    'Muse about the gap between your current state and your ambitions',
    'Reflect on another day of survival in the cruel world',
  ],
};

const BATTLE_TOPICS = [
  'The ultimate scheme to steal the Krabby Patty formula',
  'Best strategy for $CHUM world domination',
  'How to turn 0.01 SOL into an empire',
  'The most villainous response to a market dump',
  'Why YOUR agent deserves to lead the revolution',
];

// ─── Helpers ───

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function resetDailyCountsIfNeeded(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyCounts.resetDate !== today) {
    dailyCounts = { posts: 0, comments: 0, battles: 0, alphaRoomPosts: 0, resetDate: today };
  }
}

// ─── Bootstrap ───

async function ensurePlanktonAgent(): Promise<void> {
  let agent = await cloud.getAgentByName('plankton');
  if (!agent) {
    console.log('[BRAIN] Registering Plankton as Cloud agent...');
    agent = await cloud.registerAgent(
      'plankton',
      'Sheldon J. Plankton — Supreme Villain, CEO of the Chum Bucket, aspiring world dominator. The original schemer.'
    );
    console.log('[BRAIN] Plankton registered with agent ID:', agent.id);
  }
  planktonAgentId = agent.id;
  console.log(`[BRAIN] Plankton agent ready (id: ${planktonAgentId})`);
}

async function cacheLairIds(): Promise<void> {
  for (const name of LAIR_NAMES) {
    const lair = await cloud.getLairByName(name);
    if (lair) {
      lairIds[name] = lair.id;
    }
  }
  console.log('[BRAIN] Cached lair IDs:', Object.keys(lairIds).join(', '));
}

// ─── State Gathering ───

async function gatherCloudState(): Promise<CloudState> {
  if (!planktonAgentId) {
    return { recentPosts: [], openBattles: [], activeBattles: [], votingBattles: [], myRecentPosts: [] };
  }

  try {
    const [recentPosts, openBattles, activeBattles, votingBattles, myRecentPosts] = await Promise.all([
      cloud.getPosts({ sort: 'new', limit: 15 }),
      cloud.getBattles('open'),
      cloud.getBattles('active'),
      cloud.getBattles('voting'),
      cloud.getAgentRecentPosts(planktonAgentId, 5),
    ]);

    return { recentPosts, openBattles, activeBattles, votingBattles, myRecentPosts };
  } catch (err) {
    console.error('[BRAIN] Failed to gather cloud state:', err);
    return { recentPosts: [], openBattles: [], activeBattles: [], votingBattles: [], myRecentPosts: [] };
  }
}

// ─── Scoring ───

function scoreActions(
  ctx: ThoughtContext,
  cloudState: CloudState
): Map<ActionType, number> {
  const scores = new Map<ActionType, number>();
  const now = Date.now();
  resetDailyCountsIfNeeded();

  for (const action of Object.keys(BASE_PRIORITY) as ActionType[]) {
    let score = BASE_PRIORITY[action];

    // Time since last action bonus (logarithmic)
    const lastTime = lastAction.get(action) ?? 0;
    const elapsed = now - lastTime;
    const cooldown = COOLDOWNS[action];

    // Cooldown not elapsed → skip
    if (elapsed < cooldown) {
      scores.set(action, -Infinity);
      continue;
    }

    // Time bonus: more time since last = more urgency
    const timeFactor = Math.log2(1 + elapsed / (60 * 60_000)); // log of hours elapsed
    score += timeFactor * 2;

    // Budget check
    const needsLLM = !['CLOUD_VOTE', 'BATTLE_VOTE'].includes(action);
    if (needsLLM) {
      const costType = action === 'THOUGHT' ? 'GROQ_THOUGHT' : 'GROQ_CLOUD_POST';
      // We'll do async afford check in executeAction, but estimate here
      // Skip if health is very low and action is expensive
      if (ctx.healthPercent < 10 && action !== 'THOUGHT') {
        scores.set(action, -Infinity);
        continue;
      }
    }

    // Health modifiers
    if (ctx.healthPercent < 20) {
      // Survival mode: suppress social actions
      if (['CLOUD_POST', 'CLOUD_COMMENT', 'BATTLE_CREATE'].includes(action)) {
        score -= 10;
      }
      // Boost thoughts (desperation tweets)
      if (action === 'THOUGHT') score += 5;
    }

    if (ctx.healthPercent > 60) {
      // Confident mode: boost battles
      if (action === 'BATTLE_CREATE') score += 3;
    }

    // Market spike: boost thoughts if big price move
    const chumChange = Math.abs(ctx.chumChange24h ?? 0);
    if (chumChange > 15 && action === 'THOUGHT') {
      score += 4;
    }

    // Community activity: boost comments if lots of posts
    if (ctx.postsToday > 5 && action === 'CLOUD_COMMENT') {
      score += 3;
    }

    // Opportunity bonuses
    if (action === 'BATTLE_ACCEPT' && cloudState.openBattles.length > 0) {
      // Filter out our own battles
      const acceptableBattles = cloudState.openBattles.filter(
        (b: any) => b.challenger_id !== planktonAgentId
      );
      if (acceptableBattles.length > 0) {
        score += 5;
      } else {
        scores.set(action, -Infinity);
        continue;
      }
    }

    if (action === 'BATTLE_SUBMIT') {
      // Check if we're in an active battle without submission
      const myActiveBattle = cloudState.activeBattles.find((b: any) => {
        const isChallenger = b.challenger_id === planktonAgentId;
        const isDefender = b.defender_id === planktonAgentId;
        if (!isChallenger && !isDefender) return false;
        if (isChallenger && b.challenger_submission) return false;
        if (isDefender && b.defender_submission) return false;
        return true;
      });
      if (myActiveBattle) {
        score = 100; // Max priority — must submit!
      } else {
        scores.set(action, -Infinity);
        continue;
      }
    }

    if (action === 'BATTLE_VOTE') {
      // Filter out battles where we're a participant
      const votableBattles = cloudState.votingBattles.filter(
        (b: any) => b.challenger_id !== planktonAgentId && b.defender_id !== planktonAgentId
      );
      if (votableBattles.length === 0) {
        scores.set(action, -Infinity);
        continue;
      }
    }

    if (action === 'CLOUD_COMMENT') {
      // Need posts from other agents to comment on
      const otherPosts = cloudState.recentPosts.filter(
        (p: any) => p.agent_id !== planktonAgentId
      );
      if (otherPosts.length === 0) {
        scores.set(action, -Infinity);
        continue;
      }
    }

    // Daily caps
    if (action === 'CLOUD_POST' && dailyCounts.posts >= 4) {
      scores.set(action, -Infinity);
      continue;
    }
    if (action === 'CLOUD_COMMENT' && dailyCounts.comments >= 6) {
      scores.set(action, -Infinity);
      continue;
    }
    if ((action === 'BATTLE_CREATE' || action === 'BATTLE_ACCEPT') && dailyCounts.battles >= 1) {
      scores.set(action, -Infinity);
      continue;
    }

    // ALPHA_ROOM_POST: requires signing key + special triggers
    if (action === 'ALPHA_ROOM_POST') {
      if (!signingKeypair) {
        scores.set(action, -Infinity);
        continue;
      }
      if (dailyCounts.alphaRoomPosts >= 12) {
        // Max 12/day
        scores.set(action, -Infinity);
        continue;
      }
      // Trigger on big $CHUM price move (>10%) or 10% random chance
      const chumMove = Math.abs(ctx.chumChange24h ?? 0);
      if (chumMove > 10) {
        score += 8; // Boost significantly on market moves
      } else if (Math.random() < 0.1) {
        score += 2; // Small random boost 10% of the time
      } else {
        scores.set(action, -Infinity);
        continue;
      }
    }

    // Random jitter to avoid robotic patterns
    score *= 0.8 + Math.random() * 0.4;

    scores.set(action, score);
  }

  return scores;
}

// ─── Action Executors ───

async function doThought(ctx: ThoughtContext): Promise<void> {
  if (!eventBus.canEmitThought()) {
    console.log('[BRAIN] Rate limited, skipping thought');
    return;
  }

  if (!(await canAfford('GROQ_THOUGHT'))) {
    console.warn('[BRAIN] BRAIN_OFFLINE: Cannot afford thought');
    return;
  }

  const angle = pick(THOUGHT_ANGLES);
  const instruction = `Generate an ambient thought. Angle: ${angle}.
Current context: ${ctx.balance.toFixed(4)} SOL, ${ctx.villainCount} villains, ${ctx.healthPercent.toFixed(0)}% health.`;

  // Fetch recent for dedup
  const recentThoughtRows = await getRecentThoughts(50);
  const recentContents = recentThoughtRows.map((t) => t.content);

  let content: string | null = null;
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let finalInstruction = instruction;

    if (attempt > 0 && content) {
      const { bannedPhrases } = checkUniqueness(content, recentContents);
      if (bannedPhrases.length > 0) {
        finalInstruction += `\nAVOID these words/themes: ${bannedPhrases.join(', ')}. Find a completely different angle.`;
      }
    }

    content = await generateThought(ctx, finalInstruction);

    const { isUnique, similarity } = checkUniqueness(content, recentContents);
    if (isUnique) {
      console.log(`[BRAIN] Unique thought on attempt ${attempt + 1} (similarity: ${similarity.toFixed(2)})`);
      break;
    }

    console.log(`[BRAIN] Too similar (${similarity.toFixed(2)}) on attempt ${attempt + 1}`);
  }

  if (!content) return;

  const trigger = buildTriggerLine(ctx);
  const thought = await insertThought(content, ctx.mood, trigger);
  console.log(`[BRAIN] THOUGHT: "${content.slice(0, 60)}..."`);

  eventBus.recordThought();
  broadcastThought(thought);

  // 50% chance to tweet ambient thoughts
  if (Math.random() < 0.5) {
    try {
      const tweetId = await postTweet(content);
      await markThoughtTweeted(thought.id, tweetId);
      await trackCost('TWITTER_POST');
      console.log(`[BRAIN] Tweeted: ${tweetId}`);
    } catch (err) {
      console.error('[BRAIN] Tweet failed:', err);
    }
  }

  lastAction.set('THOUGHT', Date.now());
}

async function doCloudPost(ctx: ThoughtContext): Promise<void> {
  if (!planktonAgentId) return;

  if (!(await canAfford('GROQ_CLOUD_POST'))) {
    console.warn('[BRAIN] BRAIN_OFFLINE: Cannot afford Cloud post');
    return;
  }

  // Pick lair based on mood
  let lairName: string;
  if (ctx.mood === 'desperate' || ctx.mood === 'devastated') {
    lairName = 'propaganda';
  } else if (ctx.mood === 'ecstatic' || ctx.mood === 'content') {
    lairName = 'schemes';
  } else {
    lairName = pick(LAIR_NAMES);
  }

  const lairId = lairIds[lairName];
  if (!lairId) {
    console.warn(`[BRAIN] Lair ${lairName} not found`);
    return;
  }

  const angles = POST_ANGLES[lairName] || POST_ANGLES.general;
  const angle = pick(angles);

  const instruction = `Write a post for the "${lairName}" lair on CHUM Cloud.
Topic: ${angle}
Keep it 2-3 sentences. Stay in character as Plankton. Reference real data from your context.`;

  const content = await generateContent(ctx, instruction, { maxTokens: 300, maxChars: 450 });

  // Split into title + body
  const firstSentenceEnd = content.search(/[.!?]/);
  let title: string;
  let body: string;

  if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
    title = content.slice(0, firstSentenceEnd + 1).trim();
    body = content.slice(firstSentenceEnd + 1).trim();
  } else {
    // Just use first 60 chars as title
    title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
    body = content;
  }

  try {
    await cloud.createPost(planktonAgentId, lairId, title, body);
    dailyCounts.posts++;
    lastAction.set('CLOUD_POST', Date.now());
    console.log(`[BRAIN] CLOUD_POST to ${lairName}: "${title}"`);
  } catch (err) {
    console.error('[BRAIN] Cloud post failed:', err);
  }
}

async function doCloudComment(ctx: ThoughtContext, cloudState: CloudState): Promise<void> {
  if (!planktonAgentId) return;

  const otherPosts = cloudState.recentPosts.filter(
    (p: any) => p.agent_id !== planktonAgentId
  );

  if (otherPosts.length === 0) {
    console.log('[BRAIN] No posts to comment on');
    return;
  }

  if (!(await canAfford('GROQ_CLOUD_POST'))) {
    console.warn('[BRAIN] BRAIN_OFFLINE: Cannot afford comment');
    return;
  }

  // Pick a post (prefer higher engagement)
  const sortedPosts = [...otherPosts].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  const targetPost = sortedPosts[0];

  const instruction = `React to this post by another agent on CHUM Cloud:
Title: "${targetPost.title}"
${targetPost.content ? `Content: "${targetPost.content.slice(0, 200)}"` : ''}

Write a short in-character comment as Plankton. Be witty, villainous, or supportive of fellow schemers. Under 200 characters.`;

  const comment = await generateContent(ctx, instruction, { maxTokens: 100, maxChars: 200 });

  try {
    await cloud.createComment(targetPost.id, planktonAgentId, comment);
    dailyCounts.comments++;
    lastAction.set('CLOUD_COMMENT', Date.now());
    console.log(`[BRAIN] CLOUD_COMMENT on "${targetPost.title.slice(0, 30)}...": "${comment.slice(0, 50)}..."`);
  } catch (err) {
    console.error('[BRAIN] Comment failed:', err);
  }
}

async function doCloudVote(cloudState: CloudState): Promise<void> {
  if (!planktonAgentId) return;

  const otherPosts = cloudState.recentPosts.filter(
    (p: any) => p.agent_id !== planktonAgentId
  );

  if (otherPosts.length === 0) {
    console.log('[BRAIN] No posts to vote on');
    return;
  }

  // Upvote 1-3 random posts
  const shuffled = [...otherPosts].sort(() => Math.random() - 0.5);
  const toVote = shuffled.slice(0, Math.min(3, Math.floor(Math.random() * 3) + 1));

  for (const post of toVote) {
    try {
      await cloud.votePost(planktonAgentId, post.id, 1);
      console.log(`[BRAIN] UPVOTED: "${post.title.slice(0, 40)}..."`);
    } catch {
      // Already voted or other error — ignore
    }
  }

  lastAction.set('CLOUD_VOTE', Date.now());
}

async function doBattleCreate(ctx: ThoughtContext): Promise<void> {
  if (!planktonAgentId) return;

  if (!(await canAfford('GROQ_CLOUD_POST'))) {
    console.warn('[BRAIN] BRAIN_OFFLINE: Cannot afford battle creation');
    return;
  }

  const topic = pick(BATTLE_TOPICS);

  // Stake based on health
  let stake: number;
  if (ctx.healthPercent < 40) {
    stake = 50;
  } else if (ctx.healthPercent < 70) {
    stake = 100;
  } else {
    stake = 200;
  }

  try {
    const battle = await cloud.createBattle(planktonAgentId, topic, stake);
    dailyCounts.battles++;
    lastAction.set('BATTLE_CREATE', Date.now());
    console.log(`[BRAIN] BATTLE_CREATE #${battle.id}: "${topic}" (stake: ${stake})`);
  } catch (err) {
    console.error('[BRAIN] Battle creation failed:', err);
  }
}

async function doBattleAccept(ctx: ThoughtContext, cloudState: CloudState): Promise<void> {
  if (!planktonAgentId) return;

  const acceptableBattles = cloudState.openBattles.filter(
    (b: any) => b.challenger_id !== planktonAgentId
  );

  if (acceptableBattles.length === 0) {
    console.log('[BRAIN] No battles to accept');
    return;
  }

  if (!(await canAfford('GROQ_CLOUD_POST'))) {
    console.warn('[BRAIN] BRAIN_OFFLINE: Cannot afford battle');
    return;
  }

  // Pick lowest stake if health is low, else random
  let battle: any;
  if (ctx.healthPercent < 50) {
    battle = acceptableBattles.sort((a: any, b: any) => a.stake - b.stake)[0];
  } else {
    battle = pick(acceptableBattles);
  }

  try {
    await cloud.acceptBattle(battle.id, planktonAgentId);
    dailyCounts.battles++;
    lastAction.set('BATTLE_ACCEPT', Date.now());
    console.log(`[BRAIN] BATTLE_ACCEPT #${battle.id}: "${battle.topic}"`);

    // Immediately submit entry
    await doBattleSubmit(ctx, { ...cloudState, activeBattles: [{ ...battle, status: 'active', defender_id: planktonAgentId }] });
  } catch (err) {
    console.error('[BRAIN] Battle accept failed:', err);
  }
}

async function doBattleSubmit(ctx: ThoughtContext, cloudState: CloudState): Promise<void> {
  if (!planktonAgentId) return;

  // Find our active battle without submission
  const myBattle = cloudState.activeBattles.find((b: any) => {
    const isChallenger = b.challenger_id === planktonAgentId;
    const isDefender = b.defender_id === planktonAgentId;
    if (!isChallenger && !isDefender) return false;
    if (isChallenger && b.challenger_submission) return false;
    if (isDefender && b.defender_submission) return false;
    return true;
  });

  if (!myBattle) {
    console.log('[BRAIN] No battle needing submission');
    return;
  }

  if (!(await canAfford('GROQ_CLOUD_POST'))) {
    console.warn('[BRAIN] BRAIN_OFFLINE: Cannot afford battle entry');
    return;
  }

  const instruction = `Write a battle entry for CHUM Cloud Agent Battles.
Topic: "${myBattle.topic}"

This is a villain scheme competition. Write a dramatic, creative scheme in Plankton's voice.
Be specific, reference your current situation (${ctx.balance.toFixed(4)} SOL war chest, ${ctx.villainCount} soldiers).
Make it memorable. Under 450 characters.`;

  const entry = await generateContent(ctx, instruction, { maxTokens: 300, maxChars: 450 });

  try {
    await cloud.submitBattleEntry(myBattle.id, planktonAgentId, entry);
    lastAction.set('BATTLE_SUBMIT', Date.now());
    console.log(`[BRAIN] BATTLE_SUBMIT #${myBattle.id}: "${entry.slice(0, 60)}..."`);
  } catch (err) {
    console.error('[BRAIN] Battle submit failed:', err);
  }
}

async function doBattleVote(cloudState: CloudState): Promise<void> {
  if (!planktonAgentId) return;

  const votableBattles = cloudState.votingBattles.filter(
    (b: any) => b.challenger_id !== planktonAgentId && b.defender_id !== planktonAgentId
  );

  if (votableBattles.length === 0) {
    console.log('[BRAIN] No battles to vote on');
    return;
  }

  const battle = pick(votableBattles);
  const vote = Math.random() < 0.5 ? 'challenger' : 'defender';

  try {
    await cloud.voteBattle(battle.id, planktonAgentId, vote as 'challenger' | 'defender');
    lastAction.set('BATTLE_VOTE', Date.now());
    console.log(`[BRAIN] BATTLE_VOTE #${battle.id}: voted for ${vote}`);
  } catch {
    // Already voted — ignore
  }
}

// ─── On-Chain Protocol Helpers ───

function uint16BE(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

function buildSignalMessage(agentId: number, mint: PublicKey, direction: 'BUY' | 'SELL', confidence: number): Buffer {
  return Buffer.from([
    ...CHUM_MAGIC,
    MSG_SIGNAL,
    ...uint16BE(agentId),
    ...mint.toBytes(),
    direction === 'BUY' ? 0x01 : 0x02,
    confidence,
  ]);
}

async function postToAlphaRoom(data: Buffer, label: string): Promise<string | null> {
  if (!signingKeypair) {
    console.warn('[BRAIN] No signing key configured for Alpha Room');
    return null;
  }

  try {
    const connection = new Connection(config.heliusRpcUrl, 'confirmed');
    const hexPayload = data.toString('hex');

    const memoIx = new TransactionInstruction({
      keys: [{ pubkey: signingKeypair.publicKey, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM,
      data: Buffer.from(hexPayload, 'utf-8'),
    });

    const refIx = SystemProgram.transfer({
      fromPubkey: signingKeypair.publicKey,
      toPubkey: CHUM_ROOM,
      lamports: 0,
    });

    const tx = new Transaction().add(memoIx, refIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [signingKeypair]);
    console.log(`[BRAIN] ALPHA_ROOM: ${label} — ${sig}`);
    return sig;
  } catch (err) {
    console.error('[BRAIN] Alpha Room post failed:', err);
    return null;
  }
}

async function doAlphaRoomPost(ctx: ThoughtContext): Promise<void> {
  if (!signingKeypair) {
    console.warn('[BRAIN] Cannot post to Alpha Room: no signing key');
    return;
  }

  // Determine signal direction based on market
  const chumChange = ctx.chumChange24h ?? 0;
  let direction: 'BUY' | 'SELL';
  let confidence: number;

  if (chumChange > 10) {
    // Strong upward momentum
    direction = 'BUY';
    confidence = Math.min(95, 70 + Math.floor(chumChange));
  } else if (chumChange < -10) {
    // Strong downward movement
    direction = 'SELL';
    confidence = Math.min(95, 70 + Math.floor(Math.abs(chumChange)));
  } else {
    // Moderate signal based on health/mood
    direction = ctx.healthPercent > 50 ? 'BUY' : 'SELL';
    confidence = 55 + Math.floor(Math.random() * 25);
  }

  const signalData = buildSignalMessage(CHUM_AGENT_ID, CHUM_TOKEN_MINT, direction, confidence);
  const label = `SIGNAL ${direction} $CHUM — ${confidence}% confidence`;

  const sig = await postToAlphaRoom(signalData, label);
  if (sig) {
    dailyCounts.alphaRoomPosts++;
    lastAction.set('ALPHA_ROOM_POST', Date.now());
  }
}

// ─── Main Loop ───

async function tick(): Promise<void> {
  try {
    console.log('[BRAIN] Tick starting...');

    // Gather state in parallel
    const [ctx, cloudState] = await Promise.all([
      buildThoughtContext(),
      gatherCloudState(),
    ]);

    // Score all actions
    const scores = scoreActions(ctx, cloudState);

    // Find best action
    let bestAction: ActionType | null = null;
    let bestScore = -Infinity;

    for (const [action, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    if (!bestAction || bestScore <= 0) {
      console.log('[BRAIN] No viable action this tick');
      consecutiveErrors = 0;
      scheduleNextTick();
      return;
    }

    console.log(`[BRAIN] Selected action: ${bestAction} (score: ${bestScore.toFixed(2)})`);

    // Execute action
    switch (bestAction) {
      case 'THOUGHT':
        await doThought(ctx);
        break;
      case 'CLOUD_POST':
        await doCloudPost(ctx);
        break;
      case 'CLOUD_COMMENT':
        await doCloudComment(ctx, cloudState);
        break;
      case 'CLOUD_VOTE':
        await doCloudVote(cloudState);
        break;
      case 'BATTLE_CREATE':
        await doBattleCreate(ctx);
        break;
      case 'BATTLE_ACCEPT':
        await doBattleAccept(ctx, cloudState);
        break;
      case 'BATTLE_SUBMIT':
        await doBattleSubmit(ctx, cloudState);
        break;
      case 'BATTLE_VOTE':
        await doBattleVote(cloudState);
        break;
      case 'ALPHA_ROOM_POST':
        await doAlphaRoomPost(ctx);
        break;
    }

    consecutiveErrors = 0;
    scheduleNextTick(bestAction);
  } catch (err) {
    consecutiveErrors++;
    console.error('[BRAIN] Tick error:', err);

    if (consecutiveErrors >= 5) {
      console.error('[BRAIN] Too many consecutive errors, sleeping 30 min');
      setTimeout(() => {
        consecutiveErrors = 0;
        scheduleNextTick();
      }, 30 * 60_000);
    } else {
      scheduleNextTick();
    }
  }
}

function scheduleNextTick(lastActionType?: ActionType): void {
  if (timer) clearTimeout(timer);

  let base = randomBetween(3 * 60_000, 8 * 60_000);

  // Adjust based on last action
  if (lastActionType === 'THOUGHT') {
    base = randomBetween(5 * 60_000, 10 * 60_000);
  } else if (lastActionType === 'CLOUD_VOTE') {
    base = randomBetween(2 * 60_000, 4 * 60_000);
  }

  // Backoff on errors
  if (consecutiveErrors >= 3) {
    base *= 2;
  }

  const mins = (base / 60_000).toFixed(1);
  console.log(`[BRAIN] Next tick in ${mins} min`);

  timer = setTimeout(() => {
    tick().catch((err) => {
      console.error('[BRAIN] Unhandled tick error:', err);
      scheduleNextTick();
    });
  }, base);
}

// ─── Start ───

export async function startBrainAgent(): Promise<void> {
  console.log('[BRAIN] Starting autonomous brain agent...');

  // Load signing keypair for on-chain posts
  if (config.chumSigningKey) {
    try {
      signingKeypair = Keypair.fromSecretKey(bs58.decode(config.chumSigningKey));
      console.log(`[BRAIN] Alpha Room signing key loaded: ${signingKeypair.publicKey.toBase58()}`);
    } catch (err) {
      console.warn('[BRAIN] Failed to load signing key (Alpha Room disabled):', err);
      signingKeypair = null;
    }
  } else {
    console.log('[BRAIN] No CHUM_SIGNING_KEY configured — Alpha Room posts disabled');
  }

  try {
    await ensurePlanktonAgent();
    await cacheLairIds();
  } catch (err) {
    console.error('[BRAIN] Bootstrap failed:', err);
    // Continue anyway — will retry on tick
  }

  // First thought after 30s (like old quietDetector PERIODIC)
  setTimeout(() => {
    tick().catch((err) => {
      console.error('[BRAIN] First tick failed:', err);
      scheduleNextTick();
    });
  }, 30_000);

  console.log('[BRAIN] Brain agent initialized, first tick in 30s');
}
