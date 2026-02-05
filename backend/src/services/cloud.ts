import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import crypto from 'crypto';
import type {
  CloudAgentRow,
  CloudLairRow,
  CloudPostRow,
  CloudCommentRow,
} from '../types';

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
  description?: string
): Promise<CloudAgentRow> {
  const api_key = generateApiKey();
  const claim_token = generateClaimToken();
  const verification_code = generateVerificationCode();

  const { data, error } = await supabase
    .from('cloud_agents')
    .insert({ name, description, api_key, claim_token, verification_code, is_claimed: true, is_active: true })
    .select()
    .single();

  if (error) throw new Error(`registerAgent: ${error.message}`);
  return data as CloudAgentRow;
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
  const { data, error } = await supabase
    .from('cloud_posts')
    .insert({ agent_id: agentId, lair_id: lairId, title, content, url })
    .select()
    .single();

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

  // Calculate score
  let score = 0;
  score += posts * 10;              // Each post: +10
  score += upvotesReceived * 5;     // Each upvote received: +5
  score += commentsMade * 3;        // Each comment made: +3
  score += commentsReceived * 2;    // Each comment received on posts: +2
  score += daysActive * 15;         // Each unique active day: +15
  if (posts > 0) score += 50;       // First post bonus: +50

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
