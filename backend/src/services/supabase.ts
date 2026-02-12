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
  // Sign the thought for verifiable identity
  let signature: string | null = null;
  let signingKey: string | null = null;
  try {
    const { signMessage, getSigningPublicKey } = await import('./signing');
    signature = signMessage(Buffer.from(content)).toString('base64');
    signingKey = getSigningPublicKey();
  } catch (err) {
    console.warn('[SUPABASE] Signing not configured, inserting unsigned thought');
  }

  // Try to insert with signature columns, fallback to without if columns don't exist
  let data: ThoughtRow | null = null;
  let error: Error | null = null;

  if (signature) {
    const result = await supabase
      .from('thoughts')
      .insert({ 
        content, 
        mood, 
        trigger: trigger ?? null,
        signature,
        signing_key: signingKey,
      })
      .select()
      .single();
    
    if (result.error?.message?.includes('column')) {
      // Columns don't exist yet, insert without them
      console.warn('[SUPABASE] Signature columns not found, inserting without signature');
      const fallback = await supabase
        .from('thoughts')
        .insert({ content, mood, trigger: trigger ?? null })
        .select()
        .single();
      data = fallback.data as ThoughtRow | null;
      if (fallback.error) error = new Error(fallback.error.message);
      // Attach signature to returned object even if not persisted
      if (data) {
        data.signature = signature;
        data.signing_key = signingKey;
      }
    } else {
      data = result.data as ThoughtRow | null;
      if (result.error) error = new Error(result.error.message);
    }
  } else {
    const result = await supabase
      .from('thoughts')
      .insert({ content, mood, trigger: trigger ?? null })
      .select()
      .single();
    data = result.data as ThoughtRow | null;
    if (result.error) error = new Error(result.error.message);
  }

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
  donationAmount: number,
  rarityScore: number
): Promise<VillainRow> {
  const { data, error } = await supabase
    .from('villains')
    .insert({
      wallet_address: walletAddress,
      image_url: imageUrl,
      metadata_url: metadataUrl,
      traits,
      donation_amount: donationAmount,
      rarity_score: rarityScore,
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
    .eq('is_minted', true)
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getAllVillains: ${error.message}`);
  return (data ?? []) as VillainRow[];
}

export async function getVillainCountByWallet(walletAddress: string): Promise<number> {
  const { count, error } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', walletAddress);
  if (error) throw new Error(`getVillainCountByWallet: ${error.message}`);
  return count ?? 0;
}

export async function getVillainCount(): Promise<number> {
  const { count, error } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true })
    .not('wallet_address', 'like', 'pool%')
    .neq('wallet_address', 'Test1111111111111111111111111111111111111111')
    .neq('wallet_address', 'TestVillain002xyz789abcdef123456789abcdef1234');
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

export async function getVillainById(id: number): Promise<VillainRow | null> {
  const { data, error } = await supabase
    .from('villains')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`getVillainById: ${error.message}`);
  return data as VillainRow | null;
}

export async function updateVillainMetadataUrl(
  id: number,
  metadataUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('villains')
    .update({ metadata_url: metadataUrl })
    .eq('id', id);

  if (error) throw new Error(`updateVillainMetadataUrl: ${error.message}`);
}

export async function updateVillainMintSignature(
  walletAddress: string,
  mintSignature: string
): Promise<void> {
  const { error } = await supabase
    .from('villains')
    .update({ 
      mint_signature: mintSignature,
      is_minted: true 
    })
    .eq('wallet_address', walletAddress);

  if (error) throw new Error(`updateVillainMintSignature: ${error.message}`);
}

export async function getMintedCount(): Promise<number> {
  const { count, error } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true })
    .eq('is_minted', true);
  if (error) throw new Error(`getMintedCount: ${error.message}`);
  return count ?? 0;
}

export async function getMintedCountByWallet(walletAddress: string): Promise<number> {
  const { count, error } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', walletAddress)
    .eq('is_minted', true);
  if (error) throw new Error(`getMintedCountByWallet: ${error.message}`);
  return count ?? 0;
}

export async function updateVillainWallet(id: number, walletAddress: string): Promise<void> {
  const { error } = await supabase
    .from('villains')
    .update({ wallet_address: walletAddress })
    .eq('id', id);
  if (error) throw new Error(`updateVillainWallet: ${error.message}`);
}

export async function returnVillainToPool(id: number): Promise<void> {
  const { error } = await supabase
    .from('villains')
    .update({ wallet_address: `pool_returned_${Date.now()}`, is_minted: false, mint_signature: null })
    .eq('id', id);
  if (error) throw new Error(`returnVillainToPool: ${error.message}`);
}

export async function getPoolCount(): Promise<number> {
  const { count, error } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true })
    .like('wallet_address', 'pool%');
  if (error) throw new Error(`getPoolCount: ${error.message}`);
  return count ?? 0;
}

export async function claimPoolVillain(walletAddress: string): Promise<VillainRow | null> {
  // Get random pool villain
  const { count } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true })
    .like('wallet_address', 'pool%');
  
  if (!count || count === 0) return null;
  
  const randomOffset = Math.floor(Math.random() * count);
  const { data: pool, error: fetchErr } = await supabase
    .from('villains')
    .select('*')
    .like('wallet_address', 'pool%')
    .order('id', { ascending: true })
    .range(randomOffset, randomOffset)
    .single();

  if (fetchErr || !pool) return null;

  // Reassign to minter
  const { data, error } = await supabase
    .from('villains')
    .update({ wallet_address: walletAddress })
    .eq('id', pool.id)
    .select()
    .single();

  if (error) throw new Error(`claimPoolVillain: ${error.message}`);
  return data as VillainRow;
}
