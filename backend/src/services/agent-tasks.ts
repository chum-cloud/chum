import { supabase } from './supabase';

export interface AgentTask {
  id?: number;
  task_type: 'post_tweet' | 'read_mentions' | 'read_timeline' | 'search_tweets';
  agent_id: string;
  payload: Record<string, unknown>;
  status?: string;
  result?: Record<string, unknown>;
  error?: string;
  priority?: number;
}

// Queue a new task (called by agents on Railway)
export async function queueTask(task: Omit<AgentTask, 'id' | 'status' | 'result' | 'error'>): Promise<AgentTask> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .insert({
      task_type: task.task_type,
      agent_id: task.agent_id,
      payload: task.payload,
      priority: task.priority || 0,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to queue task: ${error.message}`);
  return data;
}

// Get pending tasks (called by VPS worker)
export async function getPendingTasks(limit = 5): Promise<AgentTask[]> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to get tasks: ${error.message}`);
  return data || [];
}

// Claim a task (mark as running)
export async function claimTask(taskId: number): Promise<boolean> {
  const { error } = await supabase
    .from('agent_tasks')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('status', 'pending');

  return !error;
}

// Complete a task
export async function completeTask(taskId: number, result: Record<string, unknown>): Promise<void> {
  await supabase
    .from('agent_tasks')
    .update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);
}

// Fail a task
export async function failTask(taskId: number, errorMsg: string): Promise<void> {
  await supabase
    .from('agent_tasks')
    .update({
      status: 'failed',
      error: errorMsg,
      completed_at: new Date().toISOString(),
    })
    .eq('id', taskId);
}

// Get recent results for an agent
export async function getTaskResults(agentId: string, taskType?: string, limit = 10): Promise<AgentTask[]> {
  let query = supabase
    .from('agent_tasks')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (taskType) query = query.eq('task_type', taskType);
  
  const { data } = await query;
  return data || [];
}
