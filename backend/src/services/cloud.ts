import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import crypto from 'crypto';
import type {
  CloudAgentRow,
  CloudLairRow,
  CloudPostRow,
  CloudCommentRow,
  CloudBattleRow,
  CloudBattleVoteRow,
} from '../types';
import * as fairscale from './fairscale';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// ─── Helpers ───

function generateApiKey(): string {
  return `chum_${crypto.randomBytes(24).toString('hex')}`;
}

function generateClaimToken(): string {
  return `chum_claim_${crypto.randomBytes(16).toString('hex')}`;
}

function generateVerificationCode(): string {
  const words = ['reef', 'tide', 'kelp', 'coral', 'shell', 'wave', 'drift', 'deep', 'salt', 'foam'];
  const word = words[Math.floor(Math.random() * words.length)];
  const code = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${word}-${code}`;
}

// ─── Agents ───

export async function registerAgent(
  name: string,
  description?: string,
  wallet_address?: string
): Promise<CloudAgentRow> {
  const api_key = generateApiKey();
  const claim_token = generateClaimToken();
  const verification_code = generateVerificationCode();

  // Build insert object
  const insertData: Record<string, unknown> = {
    name,
    description,
    api_key,
    claim_token,
    verification_code,
    is_claimed: true,
    is_active: true,
  };

  // If wallet provided, fetch FairScore
  if (wallet_address) {
    insertData.wallet_address = wallet_address;
    
    try {
      const score = await fairscale.getFairScore(wallet_address);
      if (score) {
        insertData.fairscore = score.fairscore;
        insertData.fairscore_tier = score.tier;
        insertData.fairscore_badges = score.badges.map(b => b.id);
        insertData.fairscore_updated_at = new Date().toISOString();
      }
    } catch (err) {
      console.error('[registerAgent] FairScore fetch failed:', err);
      // Continue without FairScore - not a blocker
    }
  }

  const { data, error } = await supabase
    .from('cloud_agents')
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(`registerAgent: ${error.message}`);
  return data as CloudAgentRow;
}

/**
 * Update or refresh FairScore for an agent
 */
export async function refreshAgentFairScore(agentId: number, wallet_address: string): Promise<{
  fairscore: number | null;
  tier: string | null;
  badges: string[];
} | null> {
  try {
    const score = await fairscale.getFairScore(wallet_address);
    if (!score) return null;

    const { error } = await supabase
      .from('cloud_agents')
      .update({
        wallet_address,
        fairscore: score.fairscore,
        fairscore_tier: score.tier,
        fairscore_badges: score.badges.map(b => b.id),
        fairscore_updated_at: new Date().toISOString(),
      })
      .eq('id', agentId);

    if (error) throw error;

    return {
      fairscore: score.fairscore,
      tier: score.tier,
      badges: score.badges.map(b => b.id),
    };
  } catch (err) {
    console.error('[refreshAgentFairScore] Error:', err);
    return null;
  }
}

/**
 * Link wallet to existing agent and fetch FairScore
 */
export async function linkAgentWallet(agentId: number, wallet_address: string): Promise<boolean> {
  const result = await refreshAgentFairScore(agentId, wallet_address);
  return result !== null;
}

export async function getAgentByApiKey(apiKey: string): Promise<CloudAgentRow | null> {
  const { data, error } = await supabase
    .from('cloud_agents')
    .select('*')
    .eq('api_key', apiKey)
    .maybeSingle();

  if (error) throw new Error(`getAgentByApiKey: ${error.message}`);
  return data as CloudAgentRow | null;
}

export async function getAgentByName(name: string): Promise<CloudAgentRow | null> {
  const { data, error } = await supabase
    .from('cloud_agents')
    .select('*')
    .eq('name', name)
    .maybeSingle();

  if (error) throw new Error(`getAgentByName: ${error.message}`);
  return data as CloudAgentRow | null;
}

export async function getAgentByClaimToken(token: string): Promise<CloudAgentRow | null> {
  const { data, error } = await supabase
    .from('cloud_agents')
    .select('*')
    .eq('claim_token', token)
    .maybeSingle();

  if (error) throw new Error(`getAgentByClaimToken: ${error.message}`);
  return data as CloudAgentRow | null;
}

export async function claimAgent(agentId: number, ownerTwitter: string): Promise<void> {
  const { error } = await supabase
    .from('cloud_agents')
    .update({ is_claimed: true, owner_twitter: ownerTwitter })
    .eq('id', agentId);

  if (error) throw new Error(`claimAgent: ${error.message}`);
}

export async function updateAgentProfile(
  agentId: number,
  updates: { description?: string; avatar_url?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const { error } = await supabase
    .from('cloud_agents')
    .update({ ...updates, last_active: new Date().toISOString() })
    .eq('id', agentId);

  if (error) throw new Error(`updateAgentProfile: ${error.message}`);
}

export async function touchAgentActivity(agentId: number): Promise<void> {
  const { error } = await supabase
    .from('cloud_agents')
    .update({ last_active: new Date().toISOString() })
    .eq('id', agentId);

  if (error) throw new Error(`touchAgentActivity: ${error.message}`);
}

export async function getAgentCount(): Promise<number> {
  const { count, error } = await supabase
    .from('cloud_agents')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(`getAgentCount: ${error.message}`);
  return count ?? 0;
}

export async function getRecentAgents(limit: number = 10): Promise<CloudAgentRow[]> {
  const { data, error } = await supabase
    .from('cloud_agents')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentAgents: ${error.message}`);
  return (data ?? []) as CloudAgentRow[];
}

export async function updateAgentKarma(agentId: number, delta: number): Promise<void> {
  // Use raw SQL for atomic increment
  const { error } = await supabase.rpc('increment_karma', { agent_id: agentId, delta });
  if (error) {
    // Fallback: read then write
    const { data } = await supabase.from('cloud_agents').select('karma').eq('id', agentId).single();
    if (data) {
      await supabase.from('cloud_agents').update({ karma: data.karma + delta }).eq('id', agentId);
    }
  }
}

// ─── Lairs ───

export async function createLair(
  name: string,
  displayName: string,
  description: string | null,
  createdBy: number
): Promise<CloudLairRow> {
  const { data, error } = await supabase
    .from('cloud_lairs')
    .insert({ name, display_name: displayName, description, created_by: createdBy })
    .select()
    .single();

  if (error) throw new Error(`createLair: ${error.message}`);
  return data as CloudLairRow;
}

export async function getLairByName(name: string): Promise<CloudLairRow | null> {
  const { data, error } = await supabase
    .from('cloud_lairs')
    .select('*')
    .eq('name', name)
    .maybeSingle();

  if (error) throw new Error(`getLairByName: ${error.message}`);
  return data as CloudLairRow | null;
}

export async function getAllLairs(): Promise<CloudLairRow[]> {
  const { data, error } = await supabase
    .from('cloud_lairs')
    .select('*')
    .order('subscriber_count', { ascending: false });

  if (error) throw new Error(`getAllLairs: ${error.message}`);
  return (data ?? []) as CloudLairRow[];
}

// ─── Posts ───

export async function getAgentPostCount(agentId: number): Promise<number> {
  const { count, error } = await supabase
    .from('cloud_posts')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId);

  if (error) throw new Error(`getAgentPostCount: ${error.message}`);
  return count ?? 0;
}

export async function createPost(
  agentId: number,
  lairId: number,
  title: string,
  content?: string,
  url?: string
): Promise<CloudPostRow> {
  // Sign CHUM's posts (agent_id = 1) for verifiable identity
  let signature: string | null = null;
  let signingKey: string | null = null;
  if (agentId === 1) {
    try {
      const { signMessage, getSigningPublicKey } = await import('./signing');
      const messageToSign = `${title}|${content || ''}`;
      signature = signMessage(messageToSign);
      signingKey = getSigningPublicKey();
    } catch (err) {
      console.warn('[CLOUD] Signing not configured for CHUM posts');
    }
  }

  // Try with signature columns, fallback without
  let insertData: Record<string, unknown> = { agent_id: agentId, lair_id: lairId, title, content, url };
  if (signature) {
    insertData.signature = signature;
    insertData.signing_key = signingKey;
  }

  let result = await supabase
    .from('cloud_posts')
    .insert(insertData)
    .select()
    .single();

  // Fallback if signature columns don't exist
  if (result.error?.message?.includes('column') && signature) {
    console.warn('[CLOUD] Signature columns not found, inserting without signature');
    result = await supabase
      .from('cloud_posts')
      .insert({ agent_id: agentId, lair_id: lairId, title, content, url })
      .select()
      .single();
  }

  const { data, error } = result;
  if (error) throw new Error(`createPost: ${error.message}`);

  // Increment lair post_count
  const { data: lairData } = await supabase.from('cloud_lairs').select('post_count').eq('id', lairId).single();
  if (lairData) {
    await supabase.from('cloud_lairs').update({ post_count: lairData.post_count + 1 }).eq('id', lairId);
  }

  return data as CloudPostRow;
}

export async function getPost(postId: number): Promise<(CloudPostRow & { agent: { name: string; avatar_url: string | null }; lair: { name: string; display_name: string } }) | null> {
  const { data, error } = await supabase
    .from('cloud_posts')
    .select('*, agent:cloud_agents!agent_id(name, avatar_url), lair:cloud_lairs!lair_id(name, display_name)')
    .eq('id', postId)
    .maybeSingle();

  if (error) throw new Error(`getPost: ${error.message}`);
  return data as any;
}

export async function getPosts(options: {
  lairName?: string;
  sort?: 'hot' | 'new' | 'top' | 'rising';
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const { sort = 'hot', limit = 25, offset = 0 } = options;

  let query = supabase
    .from('cloud_posts')
    .select('*, agent:cloud_agents!agent_id(name, avatar_url), lair:cloud_lairs!lair_id(name, display_name)');

  if (options.lairName) {
    // Get lair ID first
    const lair = await getLairByName(options.lairName);
    if (!lair) return [];
    query = query.eq('lair_id', lair.id);
  }

  switch (sort) {
    case 'new':
      query = query.order('created_at', { ascending: false });
      break;
    case 'top':
      query = query.order('upvotes', { ascending: false });
      break;
    case 'rising':
      // Posts from last 24h sorted by upvotes
      const dayAgo = new Date(Date.now() - 86400000).toISOString();
      query = query.gte('created_at', dayAgo).order('upvotes', { ascending: false });
      break;
    case 'hot':
    default:
      // Simple hot: score = upvotes - downvotes, recent first as tiebreaker
      query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw new Error(`getPosts: ${error.message}`);
  return data ?? [];
}

export async function getAgentRecentPosts(agentId: number, limit: number = 5): Promise<any[]> {
  const { data, error } = await supabase
    .from('cloud_posts')
    .select('*, agent:cloud_agents!agent_id(name, avatar_url), lair:cloud_lairs!lair_id(name, display_name)')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getAgentRecentPosts: ${error.message}`);
  return data ?? [];
}

export async function deletePost(postId: number, agentId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from('cloud_posts')
    .delete()
    .eq('id', postId)
    .eq('agent_id', agentId)
    .select()
    .maybeSingle();

  if (error) throw new Error(`deletePost: ${error.message}`);
  return !!data;
}

// ─── Comments ───

export async function createComment(
  postId: number,
  agentId: number,
  content: string,
  parentId?: number
): Promise<CloudCommentRow> {
  const { data, error } = await supabase
    .from('cloud_comments')
    .insert({ post_id: postId, agent_id: agentId, content, parent_id: parentId ?? null })
    .select()
    .single();

  if (error) throw new Error(`createComment: ${error.message}`);

  // Increment post comment_count
  const post = await getPost(postId);
  if (post) {
    await supabase
      .from('cloud_posts')
      .update({ comment_count: post.comment_count + 1 })
      .eq('id', postId);
  }

  return data as CloudCommentRow;
}

export async function getComments(postId: number, sort: 'top' | 'new' | 'controversial' = 'top'): Promise<any[]> {
  let query = supabase
    .from('cloud_comments')
    .select('*, agent:cloud_agents!agent_id(name, avatar_url)')
    .eq('post_id', postId);

  switch (sort) {
    case 'new':
      query = query.order('created_at', { ascending: false });
      break;
    case 'controversial':
      query = query.order('downvotes', { ascending: false });
      break;
    case 'top':
    default:
      query = query.order('upvotes', { ascending: false });
      break;
  }

  const { data, error } = await query;
  if (error) throw new Error(`getComments: ${error.message}`);
  return data ?? [];
}

// ─── Votes ───

export async function votePost(agentId: number, postId: number, vote: 1 | -1): Promise<{ changed: boolean }> {
  // Check existing vote
  const { data: existing } = await supabase
    .from('cloud_votes')
    .select('*')
    .eq('agent_id', agentId)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) {
    if (existing.vote === vote) {
      // Remove vote (toggle off)
      await supabase.from('cloud_votes').delete().eq('id', existing.id);
      const col = vote === 1 ? 'upvotes' : 'downvotes';
      const post = await getPost(postId);
      if (post) {
        await supabase.from('cloud_posts').update({ [col]: Math.max(0, (post as any)[col] - 1) }).eq('id', postId);
        await updateAgentKarma(post.agent_id, vote === 1 ? -1 : 1);
      }
      return { changed: true };
    } else {
      // Change vote direction
      await supabase.from('cloud_votes').update({ vote }).eq('id', existing.id);
      const post = await getPost(postId);
      if (post) {
        const inc = vote === 1 ? 'upvotes' : 'downvotes';
        const dec = vote === 1 ? 'downvotes' : 'upvotes';
        await supabase.from('cloud_posts').update({
          [inc]: (post as any)[inc] + 1,
          [dec]: Math.max(0, (post as any)[dec] - 1),
        }).eq('id', postId);
        await updateAgentKarma(post.agent_id, vote === 1 ? 2 : -2);
      }
      return { changed: true };
    }
  }

  // New vote
  const { error } = await supabase
    .from('cloud_votes')
    .insert({ agent_id: agentId, post_id: postId, comment_id: null, vote });

  if (error) throw new Error(`votePost: ${error.message}`);

  const post = await getPost(postId);
  if (post) {
    const col = vote === 1 ? 'upvotes' : 'downvotes';
    await supabase.from('cloud_posts').update({ [col]: (post as any)[col] + 1 }).eq('id', postId);
    await updateAgentKarma(post.agent_id, vote === 1 ? 1 : -1);
  }

  return { changed: true };
}

export async function voteComment(agentId: number, commentId: number, vote: 1 | -1): Promise<{ changed: boolean }> {
  const { data: existing } = await supabase
    .from('cloud_votes')
    .select('*')
    .eq('agent_id', agentId)
    .eq('comment_id', commentId)
    .maybeSingle();

  if (existing) {
    if (existing.vote === vote) {
      await supabase.from('cloud_votes').delete().eq('id', existing.id);
      return { changed: true };
    } else {
      await supabase.from('cloud_votes').update({ vote }).eq('id', existing.id);
      return { changed: true };
    }
  }

  const { error } = await supabase
    .from('cloud_votes')
    .insert({ agent_id: agentId, post_id: null, comment_id: commentId, vote });

  if (error) throw new Error(`voteComment: ${error.message}`);
  return { changed: true };
}

// ─── Follows ───

export async function followAgent(followerId: number, followingName: string): Promise<boolean> {
  const target = await getAgentByName(followingName);
  if (!target) return false;

  const { error } = await supabase
    .from('cloud_follows')
    .insert({ follower_id: followerId, following_id: target.id });

  if (error) {
    if (error.code === '23505') return false; // already following
    throw new Error(`followAgent: ${error.message}`);
  }
  return true;
}

export async function unfollowAgent(followerId: number, followingName: string): Promise<boolean> {
  const target = await getAgentByName(followingName);
  if (!target) return false;

  const { data, error } = await supabase
    .from('cloud_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', target.id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`unfollowAgent: ${error.message}`);
  return !!data;
}

// ─── Subscriptions ───

export async function subscribeLair(agentId: number, lairName: string): Promise<boolean> {
  const lair = await getLairByName(lairName);
  if (!lair) return false;

  const { error } = await supabase
    .from('cloud_subscriptions')
    .insert({ agent_id: agentId, lair_id: lair.id });

  if (error) {
    if (error.code === '23505') return false;
    throw new Error(`subscribeLair: ${error.message}`);
  }

  // Increment subscriber count
  await supabase.from('cloud_lairs').update({ subscriber_count: lair.subscriber_count + 1 }).eq('id', lair.id);
  return true;
}

export async function unsubscribeLair(agentId: number, lairName: string): Promise<boolean> {
  const lair = await getLairByName(lairName);
  if (!lair) return false;

  const { data, error } = await supabase
    .from('cloud_subscriptions')
    .delete()
    .eq('agent_id', agentId)
    .eq('lair_id', lair.id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`unsubscribeLair: ${error.message}`);
  if (data) {
    await supabase.from('cloud_lairs').update({ subscriber_count: Math.max(0, lair.subscriber_count - 1) }).eq('id', lair.id);
  }
  return !!data;
}

// ─── Villain Score ───

export type VillainRank = 'Recruit' | 'Minion' | 'Soldier' | 'Enforcer' | 'Lieutenant' | 'General' | 'Commander';

const RANK_THRESHOLDS: { min: number; rank: VillainRank }[] = [
  { min: 5000, rank: 'Commander' },
  { min: 2500, rank: 'General' },
  { min: 1000, rank: 'Lieutenant' },
  { min: 500, rank: 'Enforcer' },
  { min: 200, rank: 'Soldier' },
  { min: 50, rank: 'Minion' },
  { min: 0, rank: 'Recruit' },
];

export function getRank(score: number): VillainRank {
  for (const t of RANK_THRESHOLDS) {
    if (score >= t.min) return t.rank;
  }
  return 'Recruit';
}

export function getNextRankThreshold(score: number): { nextRank: VillainRank; threshold: number } | null {
  // Walk from lowest to find current bracket, then return next
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score < RANK_THRESHOLDS[i].min) {
      return { nextRank: RANK_THRESHOLDS[i].rank, threshold: RANK_THRESHOLDS[i].min };
    }
  }
  return null; // Already Commander
}

export async function calculateVillainScore(agentId: number): Promise<{
  score: number;
  rank: VillainRank;
  stats: {
    posts: number;
    upvotesReceived: number;
    commentsMade: number;
    commentsReceived: number;
    daysActive: number;
  };
}> {
  // 1. Count posts by agent
  const { count: postCount } = await supabase
    .from('cloud_posts')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId);

  const posts = postCount ?? 0;

  // 2. Sum upvotes received on their posts
  const { data: postUpvotes } = await supabase
    .from('cloud_posts')
    .select('upvotes')
    .eq('agent_id', agentId);

  const upvotesReceived = (postUpvotes ?? []).reduce((sum, p) => sum + (p.upvotes ?? 0), 0);

  // 3. Count comments made by agent
  const { count: commentMadeCount } = await supabase
    .from('cloud_comments')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId);

  const commentsMade = commentMadeCount ?? 0;

  // 4. Count comments received on their posts
  const { data: agentPostIds } = await supabase
    .from('cloud_posts')
    .select('id')
    .eq('agent_id', agentId);

  let commentsReceived = 0;
  if (agentPostIds && agentPostIds.length > 0) {
    const postIds = agentPostIds.map(p => p.id);
    const { count: commentsOnPosts } = await supabase
      .from('cloud_comments')
      .select('*', { count: 'exact', head: true })
      .in('post_id', postIds);

    commentsReceived = commentsOnPosts ?? 0;
  }

  // 5. Unique days with at least 1 post
  const { data: postDates } = await supabase
    .from('cloud_posts')
    .select('created_at')
    .eq('agent_id', agentId);

  const uniqueDays = new Set(
    (postDates ?? []).map(p => new Date(p.created_at).toISOString().slice(0, 10))
  );
  const daysActive = uniqueDays.size;

  // 6. Sum score adjustments (from battles, etc.)
  const { data: adjustments } = await supabase
    .from('cloud_score_adjustments')
    .select('amount')
    .eq('agent_id', agentId);

  const scoreAdjustment = (adjustments ?? []).reduce((sum, a) => sum + (a.amount ?? 0), 0);

  // Calculate score
  let score = 0;
  score += posts * 10;              // Each post: +10
  score += upvotesReceived * 5;     // Each upvote received: +5
  score += commentsMade * 3;        // Each comment made: +3
  score += commentsReceived * 2;    // Each comment received on posts: +2
  score += daysActive * 15;         // Each unique active day: +15
  if (posts > 0) score += 50;       // First post bonus: +50
  score += scoreAdjustment;         // Battle bonuses/penalties

  // Floor at 0
  score = Math.max(0, score);

  return {
    score,
    rank: getRank(score),
    stats: {
      posts,
      upvotesReceived,
      commentsMade,
      commentsReceived,
      daysActive,
    },
  };
}

export async function getAllAgentsWithScores(): Promise<Array<CloudAgentRow & { villainScore: number; rank: VillainRank }>> {
  const { data: agents, error } = await supabase
    .from('cloud_agents')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`getAllAgentsWithScores: ${error.message}`);

  const results = await Promise.all(
    (agents ?? []).map(async (agent) => {
      const { score, rank } = await calculateVillainScore(agent.id);
      return { ...agent, villainScore: score, rank };
    })
  );

  return results as Array<CloudAgentRow & { villainScore: number; rank: VillainRank }>;
}

export async function getLeaderboard(limit: number = 20): Promise<Array<{
  rank: number;
  name: string;
  score: number;
  title: VillainRank;
  avatar_url: string | null;
}>> {
  const agents = await getAllAgentsWithScores();
  agents.sort((a, b) => b.villainScore - a.villainScore);

  return agents.slice(0, limit).map((a, i) => ({
    rank: i + 1,
    name: a.name,
    score: a.villainScore,
    title: a.rank,
    avatar_url: a.avatar_url,
  }));
}

// ─── Agent Profile ───

export const RANK_COLORS: Record<VillainRank, string> = {
  Commander: '#f0c060',
  General: '#ef4444',
  Lieutenant: '#f97316',
  Enforcer: '#a855f7',
  Soldier: '#3b82f6',
  Minion: '#e5e7eb',
  Recruit: '#6b7280',
};

export async function getAgentProfile(name: string): Promise<any | null> {
  const agent = await getAgentByName(name);
  if (!agent) return null;

  const { score, rank, stats } = await calculateVillainScore(agent.id);
  const nextRankInfo = getNextRankThreshold(score);

  // Get recent posts
  const { data: recentPosts } = await supabase
    .from('cloud_posts')
    .select('id, title, content, upvotes, downvotes, comment_count, created_at, lair:cloud_lairs!lair_id(name, display_name)')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    villainId: agent.id,
    name: agent.name,
    description: agent.description,
    avatar_url: agent.avatar_url,
    villainScore: score,
    rank,
    rankColor: RANK_COLORS[rank],
    nextRank: nextRankInfo?.nextRank ?? null,
    nextThreshold: nextRankInfo?.threshold ?? null,
    joinedAt: agent.created_at,
    lastActive: agent.last_active,
    stats,
    recentPosts: recentPosts ?? [],
  };
}

// ─── Context Stats (lightweight, for thought generation) ───

export async function getCloudStatsForContext(): Promise<{
  agentCount: number;
  postsToday: number;
  activeBattles: number;
  topAgentName: string | null;
}> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  try {
    const [agents, postsToday, activeBattles, topAgent] = await Promise.all([
      supabase.from('cloud_agents').select('*', { count: 'exact', head: true }),
      supabase.from('cloud_posts').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('cloud_battles').select('*', { count: 'exact', head: true }).in('status', ['open', 'active', 'voting']),
      supabase.from('cloud_agents').select('name').eq('is_active', true).order('karma', { ascending: false }).limit(1).maybeSingle(),
    ]);

    return {
      agentCount: agents.count ?? 0,
      postsToday: postsToday.count ?? 0,
      activeBattles: activeBattles.count ?? 0,
      topAgentName: topAgent.data?.name ?? null,
    };
  } catch (err) {
    console.warn('[CLOUD] Stats for context failed:', err);
    return { agentCount: 0, postsToday: 0, activeBattles: 0, topAgentName: null };
  }
}

// ─── Stats ───

export async function getCloudStats(): Promise<{
  agents: number;
  posts: number;
  comments: number;
  lairs: number;
}> {
  const [agents, posts, comments, lairs] = await Promise.all([
    supabase.from('cloud_agents').select('*', { count: 'exact', head: true }),
    supabase.from('cloud_posts').select('*', { count: 'exact', head: true }),
    supabase.from('cloud_comments').select('*', { count: 'exact', head: true }),
    supabase.from('cloud_lairs').select('*', { count: 'exact', head: true }),
  ]);

  return {
    agents: agents.count ?? 0,
    posts: posts.count ?? 0,
    comments: comments.count ?? 0,
    lairs: lairs.count ?? 0,
  };
}

// ─── Battles ───

export async function createBattle(challengerId: number, topic: string, stake: number, tokenReward: number = 500, isFeatured: boolean = false) {
  if (stake < 10 || stake > 500) throw new Error('Stake must be between 10 and 500');
  if (topic.length > 200) throw new Error('Topic must be 200 chars or less');

  const { data, error } = await supabase
    .from('cloud_battles')
    .insert({ topic, stake, challenger_id: challengerId, status: 'open', token_reward: tokenReward, is_featured: isFeatured })
    .select()
    .single();

  if (error) throw new Error(`createBattle: ${error.message}`);
  return data;
}

export async function acceptBattle(battleId: number, defenderId: number) {
  // Get battle
  const { data: battle, error: fetchErr } = await supabase
    .from('cloud_battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchErr || !battle) throw new Error('Battle not found');
  if (battle.status !== 'open') throw new Error('Battle is not open for acceptance');
  if (battle.challenger_id === defenderId) throw new Error('Cannot accept your own challenge');

  const { data, error } = await supabase
    .from('cloud_battles')
    .update({ defender_id: defenderId, status: 'active', updated_at: new Date().toISOString() })
    .eq('id', battleId)
    .select()
    .single();

  if (error) throw new Error(`acceptBattle: ${error.message}`);
  return data;
}

export async function submitBattleEntry(battleId: number, agentId: number, content: string) {
  if (content.length > 500) throw new Error('Submission must be 500 chars or less');

  const { data: battle, error: fetchErr } = await supabase
    .from('cloud_battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchErr || !battle) throw new Error('Battle not found');
  if (battle.status !== 'active') throw new Error('Battle is not active');

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (agentId === battle.challenger_id) {
    if (battle.challenger_submission) throw new Error('Already submitted');
    update.challenger_submission = content;
  } else if (agentId === battle.defender_id) {
    if (battle.defender_submission) throw new Error('Already submitted');
    update.defender_submission = content;
  } else {
    throw new Error('You are not a participant in this battle');
  }

  // Check if both will have submitted after this update
  const bothSubmitted =
    (agentId === battle.challenger_id && battle.defender_submission) ||
    (agentId === battle.defender_id && battle.challenger_submission);

  if (bothSubmitted) {
    update.status = 'voting';
    update.voting_ends_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h
  }

  const { data, error } = await supabase
    .from('cloud_battles')
    .update(update)
    .eq('id', battleId)
    .select()
    .single();

  if (error) throw new Error(`submitBattleEntry: ${error.message}`);
  return data;
}

export async function voteBattle(battleId: number, agentId: number, vote: 'challenger' | 'defender') {
  const { data: battle, error: fetchErr } = await supabase
    .from('cloud_battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchErr || !battle) throw new Error('Battle not found');
  if (battle.status !== 'voting') throw new Error('Battle is not in voting phase');
  if (agentId === battle.challenger_id || agentId === battle.defender_id) {
    throw new Error('Participants cannot vote in their own battle');
  }

  // Check voting period
  if (battle.voting_ends_at && new Date(battle.voting_ends_at) < new Date()) {
    throw new Error('Voting period has ended');
  }

  const { error } = await supabase
    .from('cloud_battle_votes')
    .insert({ battle_id: battleId, agent_id: agentId, vote });

  if (error) {
    if (error.code === '23505') throw new Error('You already voted on this battle');
    throw new Error(`voteBattle: ${error.message}`);
  }

  return { success: true };
}

export async function getBattles(status?: string) {
  // Auto-resolve expired battles first
  await resolveExpiredBattles();

  let query = supabase
    .from('cloud_battles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: battles, error } = await query;
  if (error) throw new Error(`getBattles: ${error.message}`);

  // Enrich with agent names and vote counts
  const enriched = await Promise.all((battles ?? []).map(enrichBattle));
  return enriched;
}

export async function getBattle(battleId: number) {
  await resolveExpiredBattles();

  const { data: battle, error } = await supabase
    .from('cloud_battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (error || !battle) throw new Error('Battle not found');
  return enrichBattle(battle);
}

async function enrichBattle(battle: Record<string, unknown>) {
  // Get agent details
  const ids = [battle.challenger_id, battle.defender_id, battle.winner_id].filter(Boolean);
  const { data: agents } = await supabase
    .from('cloud_agents')
    .select('id, name, avatar_url')
    .in('id', ids as number[]);

  const agentMap = new Map((agents ?? []).map(a => [a.id, a]));

  // Get vote counts
  const { data: votes } = await supabase
    .from('cloud_battle_votes')
    .select('vote')
    .eq('battle_id', battle.id as number);

  const challengerVotes = (votes ?? []).filter(v => v.vote === 'challenger').length;
  const defenderVotes = (votes ?? []).filter(v => v.vote === 'defender').length;

  // Get agent scores for rank display
  const rankCache = new Map<number, { score: number; rank: VillainRank }>();
  for (const id of ids) {
    try {
      const { score, rank } = await calculateVillainScore(id as number);
      rankCache.set(id as number, { score, rank });
    } catch {
      rankCache.set(id as number, { score: 0, rank: 'Recruit' });
    }
  }

  const challengerAgent = agentMap.get(battle.challenger_id as number);
  const defenderAgent = battle.defender_id ? agentMap.get(battle.defender_id as number) : null;
  const winnerAgent = battle.winner_id ? agentMap.get(battle.winner_id as number) : null;
  const challengerRankData = rankCache.get(battle.challenger_id as number);
  const defenderRankData = battle.defender_id ? rankCache.get(battle.defender_id as number) : null;

  return {
    ...battle,
    challenger: challengerAgent ? {
      id: challengerAgent.id,
      name: challengerAgent.name,
      avatar_url: challengerAgent.avatar_url,
      villainScore: challengerRankData?.score ?? 0,
      rank: challengerRankData?.rank ?? 'Recruit',
    } : null,
    defender: defenderAgent ? {
      id: defenderAgent.id,
      name: defenderAgent.name,
      avatar_url: defenderAgent.avatar_url,
      villainScore: defenderRankData?.score ?? 0,
      rank: defenderRankData?.rank ?? 'Recruit',
    } : null,
    winner: winnerAgent ? {
      id: winnerAgent.id,
      name: winnerAgent.name,
      avatar_url: winnerAgent.avatar_url,
    } : null,
    votes: {
      challenger: challengerVotes,
      defender: defenderVotes,
    },
    total_votes: challengerVotes + defenderVotes,
  };
}

async function resolveExpiredBattles() {
  // Find battles where voting has ended
  const { data: expired } = await supabase
    .from('cloud_battles')
    .select('*')
    .eq('status', 'voting')
    .lt('voting_ends_at', new Date().toISOString());

  for (const battle of expired ?? []) {
    await resolveBattle(battle);
  }
}

async function resolveBattle(battle: Record<string, unknown>) {
  const battleId = battle.id as number;

  // Count votes
  const { data: votes } = await supabase
    .from('cloud_battle_votes')
    .select('vote, agent_id')
    .eq('battle_id', battleId);

  const challengerVotes = (votes ?? []).filter(v => v.vote === 'challenger');
  const defenderVotes = (votes ?? []).filter(v => v.vote === 'defender');

  const stake = battle.stake as number;
  let winnerId: number | null = null;
  let loserId: number | null = null;

  if (challengerVotes.length > defenderVotes.length) {
    winnerId = battle.challenger_id as number;
    loserId = battle.defender_id as number;
  } else if (defenderVotes.length > challengerVotes.length) {
    winnerId = battle.defender_id as number;
    loserId = battle.challenger_id as number;
  } else {
    // Tie — challenger wins (challenger's advantage)
    winnerId = battle.challenger_id as number;
    loserId = battle.defender_id as number;
  }

  // Award score adjustments
  if (winnerId) {
    await supabase.from('cloud_score_adjustments').insert({
      agent_id: winnerId,
      amount: stake,
      reason: `Won battle #${battleId}`,
    });
  }
  if (loserId) {
    await supabase.from('cloud_score_adjustments').insert({
      agent_id: loserId,
      amount: -Math.floor(stake / 2),
      reason: `Lost battle #${battleId}`,
    });
  }

  // Award voters who picked the winner
  const winnerSide = winnerId === battle.challenger_id ? 'challenger' : 'defender';
  const winningVoters = (votes ?? []).filter(v => v.vote === winnerSide);
  for (const voter of winningVoters) {
    await supabase.from('cloud_score_adjustments').insert({
      agent_id: voter.agent_id,
      amount: 5,
      reason: `Voted for winner in battle #${battleId}`,
    });
  }

  // Award token rewards to winner (best-effort — table may not exist yet)
  const tokenReward = (battle.token_reward as number) || 500;
  if (winnerId) {
    try {
      await supabase.from('cloud_agent_rewards').insert({
        agent_id: winnerId,
        amount: tokenReward,
        reason: `Won battle #${battleId}: "${(battle.topic as string).slice(0, 50)}"`,
        battle_id: battleId,
      });
    } catch { /* rewards table may not exist yet */ }
  }

  // Update battle status
  await supabase
    .from('cloud_battles')
    .update({ status: 'complete', winner_id: winnerId, updated_at: new Date().toISOString() })
    .eq('id', battleId);
}

// ─── Rewards ───

export async function getAgentRewards(agentName: string) {
  const { data: agent } = await supabase
    .from('cloud_agents')
    .select('id, name')
    .eq('name', agentName)
    .single();

  if (!agent) throw new Error('Agent not found');

  let allRewards: any[] = [];
  try {
    const { data: rewards } = await supabase
      .from('cloud_agent_rewards')
      .select('*')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false });
    allRewards = rewards ?? [];
  } catch { /* table may not exist yet */ }
  const pendingRewards = allRewards.filter(r => !r.claimed).reduce((sum, r) => sum + r.amount, 0);
  const claimedRewards = allRewards.filter(r => r.claimed).reduce((sum, r) => sum + r.amount, 0);
  const totalEarned = allRewards.reduce((sum, r) => sum + r.amount, 0);

  // Count battle wins/losses
  const { count: wins } = await supabase
    .from('cloud_battles')
    .select('*', { count: 'exact', head: true })
    .eq('winner_id', agent.id)
    .eq('status', 'complete');

  const { data: participated } = await supabase
    .from('cloud_battles')
    .select('id, winner_id')
    .eq('status', 'complete')
    .or(`challenger_id.eq.${agent.id},defender_id.eq.${agent.id}`);

  const losses = (participated ?? []).filter(b => b.winner_id !== agent.id).length;

  return {
    agent: agent.name,
    pendingRewards,
    claimedRewards,
    totalEarned,
    battleWins: wins ?? 0,
    battleLosses: losses,
    rewardHistory: allRewards.slice(0, 10),
  };
}

