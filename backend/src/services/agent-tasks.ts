/**
 * Agent Tasks Service — Bridge between Railway agents and VPS browser
 * 
 * Agents call queueTask() to schedule browser actions (post tweet, read mentions, search CT).
 * The VPS bridge (PM2 process) polls pending_tweets table and executes via headless Chrome.
 * Results are written back to the same row for agents to read.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export interface TaskRequest {
  task_type: 'post_tweet' | 'reply_tweet' | 'read_mentions' | 'search_ct' | 'read_timeline' | 'browse_feed';
  agent_id: string;
  payload: Record<string, unknown>;
  priority?: number;  // higher = processed first
  scheme_id?: number;
}

interface PendingTweetRow {
  id: number;
  agent: string;
  action: string;
  content: string | null;
  reply_to_url: string | null;
  search_query: string | null;
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
  priority: number;
  created_at: string;
  processed_at: string | null;
  scheme_id: number | null;
}

/**
 * Queue a task for the VPS browser bridge
 */
export async function queueTask(req: TaskRequest): Promise<PendingTweetRow> {
  // Map task_type to pending_tweets action format
  const actionMap: Record<string, string> = {
    'post_tweet': 'post',
    'reply_tweet': 'reply',
    'read_mentions': 'read_mentions',
    'search_ct': 'search',
    'read_timeline': 'read_timeline',
    'browse_feed': 'browse_feed',
  };

  const action = actionMap[req.task_type] || req.task_type;
  const payload = req.payload;

  const row: Record<string, unknown> = {
    agent: req.agent_id,
    action,
    content: (payload.content as string) || null,
    reply_to_url: (payload.reply_to_url as string) || null,
    search_query: (payload.search_query as string) || (payload.query as string) || null,
    status: 'pending',
    priority: req.priority ?? 0,
    scheme_id: req.scheme_id ?? null,
  };

  const { data, error } = await supabase
    .from('pending_tweets')
    .insert(row)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to queue task: ${error.message}`);
  }

  console.log(`[agent-tasks] Queued ${action} task #${data.id} for ${req.agent_id}`);
  return data as PendingTweetRow;
}

/**
 * Get completed task results for an agent
 */
export async function getTaskResults(
  agentId: string,
  action?: string,
  limit = 5
): Promise<PendingTweetRow[]> {
  let query = supabase
    .from('pending_tweets')
    .select('*')
    .eq('agent', agentId)
    .in('status', ['done', 'failed'])
    .order('processed_at', { ascending: false })
    .limit(limit);

  if (action) {
    query = query.eq('action', action);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get task results: ${error.message}`);
  }

  return (data || []) as PendingTweetRow[];
}

/**
 * Get pending task count for rate limiting
 */
export async function getPendingCount(agentId?: string): Promise<number> {
  let query = supabase
    .from('pending_tweets')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'processing']);

  if (agentId) {
    query = query.eq('agent', agentId);
  }

  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
}

/**
 * Wait for a task to complete (polls Supabase)
 * Returns result or null if timeout
 */
export async function waitForTask(
  taskId: number,
  timeoutMs = 120000,
  pollMs = 5000
): Promise<PendingTweetRow | null> {
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await supabase
      .from('pending_tweets')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) return null;

    const row = data as PendingTweetRow;
    if (row.status === 'done' || row.status === 'failed') {
      return row;
    }

    await new Promise(r => setTimeout(r, pollMs));
  }

  return null; // timeout
}

/**
 * Get pending tasks (for VPS bridge or API polling)
 */
export async function getPendingTasks(limit = 5): Promise<PendingTweetRow[]> {
  const { data, error } = await supabase
    .from('pending_tweets')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to get pending tasks: ${error.message}`);
  return (data || []) as PendingTweetRow[];
}

/**
 * Claim a task (mark as processing)
 */
export async function claimTask(taskId: number): Promise<boolean> {
  const { error } = await supabase
    .from('pending_tweets')
    .update({ status: 'processing' })
    .eq('id', taskId)
    .eq('status', 'pending');

  return !error;
}

/**
 * Complete a task with result
 */
export async function completeTask(taskId: number, result: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('pending_tweets')
    .update({
      status: 'done',
      result,
      processed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to complete task: ${error.message}`);
}

/**
 * Fail a task with error
 */
export async function failTask(taskId: number, errorMsg: string): Promise<void> {
  const { error } = await supabase
    .from('pending_tweets')
    .update({
      status: 'failed',
      error: errorMsg,
      processed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to fail task: ${error.message}`);
}

/**
 * Clean up old completed tasks (keep last N days)
 */
export async function cleanupOldTasks(daysToKeep = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  const { data, error } = await supabase
    .from('pending_tweets')
    .delete()
    .in('status', ['done', 'failed'])
    .lt('processed_at', cutoff.toISOString())
    .select('id');

  if (error) {
    console.error('[agent-tasks] Cleanup failed:', error.message);
    return 0;
  }

  return data?.length || 0;
}
