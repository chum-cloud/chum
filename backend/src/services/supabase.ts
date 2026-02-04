import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { ChumStateRow, ThoughtRow, Mood } from '../types';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export async function getChumState(): Promise<ChumStateRow> {
  const { data, error } = await supabase
    .from('chum_state')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw new Error(`getChumState: ${error.message}`);
  return data as ChumStateRow;
}

export async function updateChumState(
  updates: Partial<Omit<ChumStateRow, 'id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('chum_state')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw new Error(`updateChumState: ${error.message}`);
}

export async function insertThought(
  content: string,
  mood: Mood | string
): Promise<ThoughtRow> {
  const { data, error } = await supabase
    .from('thoughts')
    .insert({ content, mood })
    .select()
    .single();
  if (error) throw new Error(`insertThought: ${error.message}`);
  return data as ThoughtRow;
}

export async function markThoughtTweeted(id: number, tweetId?: string): Promise<void> {
  const { error } = await supabase
    .from('thoughts')
    .update({ tweeted: true, tweet_id: tweetId ?? null })
    .eq('id', id);
  if (error) throw new Error(`markThoughtTweeted: ${error.message}`);
}

export async function getLatestThought(): Promise<ThoughtRow | null> {
  const { data, error } = await supabase
    .from('thoughts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestThought: ${error.message}`);
  return data as ThoughtRow | null;
}

export async function insertTransaction(
  type: 'revenue' | 'donation' | 'expense' | 'burn',
  amount: number,
  description: string,
  signature?: string
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .insert({ type, amount, description, signature: signature ?? null });
  if (error) throw new Error(`insertTransaction: ${error.message}`);
}

export async function getTodayRevenue(): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .in('type', ['revenue', 'donation'])
    .gte('created_at', todayStart.toISOString());

  if (error) throw new Error(`getTodayRevenue: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}
