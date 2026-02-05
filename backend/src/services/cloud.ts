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
