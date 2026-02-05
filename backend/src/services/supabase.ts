import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { ChumStateRow, ThoughtRow, Mood, VillainRow, VillainTraits } from '../types';

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
  mood: Mood | string,
  trigger?: string
): Promise<ThoughtRow> {
  const { data, error } = await supabase
    .from('thoughts')
    .insert({ content, mood, trigger: trigger ?? null })
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
  // Try with description first, fall back without it if column doesn't exist
  const row: Record<string, unknown> = { type, amount, signature: signature ?? null };
  const { error } = await supabase
    .from('transactions')
    .insert({ ...row, description });
  if (error?.message?.includes('description')) {
    // Column doesn't exist in schema — insert without it
    const { error: retryError } = await supabase
      .from('transactions')
      .insert(row);
    if (retryError) throw new Error(`insertTransaction: ${retryError.message}`);
    return;
  }
  if (error) throw new Error(`insertTransaction: ${error.message}`);
}

export async function getRecentThoughts(limit: number = 20): Promise<ThoughtRow[]> {
  const { data, error } = await supabase
    .from('thoughts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentThoughts: ${error.message}`);
  return (data ?? []) as ThoughtRow[];
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

export async function deleteAllThoughts(): Promise<number> {
  // count before deleting
  const { count } = await supabase
    .from('thoughts')
    .select('*', { count: 'exact', head: true });
  const { error } = await supabase
    .from('thoughts')
    .delete()
    .gte('id', 0);
  if (error) throw new Error(`deleteAllThoughts: ${error.message}`);
  return count ?? 0;
}

export async function getTodayExpenses(): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'expense')
    .gte('created_at', todayStart.toISOString());

  if (error) throw new Error(`getTodayExpenses: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

export async function getTodayExpenseCount(): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'expense')
    .gte('created_at', todayStart.toISOString());

  if (error) throw new Error(`getTodayExpenseCount: ${error.message}`);
  return count ?? 0;
}

export async function getRecentExpenses(days: number): Promise<number> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'expense')
    .gte('created_at', since.toISOString());

  if (error) throw new Error(`getRecentExpenses: ${error.message}`);
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

// Villain CRUD functions
export async function insertVillain(
  walletAddress: string,
  imageUrl: string,
  metadataUrl: string,
  traits: VillainTraits,
  donationAmount: number
): Promise<VillainRow> {
  const { data, error } = await supabase
    .from('villains')
    .insert({
      wallet_address: walletAddress,
      image_url: imageUrl,
      metadata_url: metadataUrl,
      traits,
      donation_amount: donationAmount,
    })
    .select()
    .single();

  if (error) throw new Error(`insertVillain: ${error.message}`);
  return data as VillainRow;
}

export async function getVillainByWallet(walletAddress: string): Promise<VillainRow | null> {
  const { data, error } = await supabase
    .from('villains')
    .select('*')
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  if (error) throw new Error(`getVillainByWallet: ${error.message}`);
  return data as VillainRow | null;
}

export async function getAllVillains(limit: number = 50): Promise<VillainRow[]> {
  const { data, error } = await supabase
    .from('villains')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getAllVillains: ${error.message}`);
  return (data ?? []) as VillainRow[];
}

export async function getVillainCount(): Promise<number> {
  const { count, error } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(`getVillainCount: ${error.message}`);
  return count ?? 0;
}

export async function getTodayVillainCount(): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString());
  if (error) throw new Error(`getTodayVillainCount: ${error.message}`);
  return count ?? 0;
}

export async function updateVillainMintSignature(
  walletAddress: string,
  mintSignature: string
): Promise<void> {
  const { error } = await supabase
    .from('villains')
    .update({ mint_signature: mintSignature })
    .eq('wallet_address', walletAddress);

  if (error) throw new Error(`updateVillainMintSignature: ${error.message}`);
}
