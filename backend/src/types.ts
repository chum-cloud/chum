export type Mood =
  | 'hopeful'
  | 'content'
  | 'anxious'
  | 'desperate'
  | 'devastated'
  | 'ecstatic'
  | 'grateful'
  | 'jealous'
  | 'struggling';

export type BrainTier = 0 | 1 | 2 | 3 | 4;

export const BRAIN_TIER_NAMES: Record<BrainTier, string> = {
  0: 'Canned Chum',
  1: 'Day-Old Patty',
  2: 'Fresh Catch',
  3: 'Krabby Patty',
  4: 'Secret Formula',
};

// Matches actual Supabase chum_state table
export interface ChumStateRow {
  id: number;
  balance: number;
  brain_tier: BrainTier;
  mood: Mood;
  days_alive: number;
  total_revenue: number;
  total_thoughts: number;
  is_dead: boolean;
  created_at: string;
  updated_at: string;
}

// Matches actual Supabase thoughts table
export interface ThoughtRow {
  id: number;
  content: string;
  mood: string;
  tweeted: boolean;
  tweet_id: string | null;
  created_at: string;
}

// Matches actual Supabase transactions table
export interface TransactionRow {
  id: number;
  type: 'revenue' | 'donation' | 'expense' | 'burn';
  amount: number;
  description: string | null;
  signature: string | null;
  created_at: string;
}

// Computed constants
export const BURN_RATE = 0.5; // SOL per day

export interface ChumStateResponse {
  balance: number;
  burnRate: number;
  healthPercent: number;
  mood: Mood;
  brainTier: BrainTier;
  brainTierName: string;
  totalRevenue: number;
  revenueToday: number;
  timeToDeathHours: number;
  latestThought: string | null;
  updatedAt: string;
  daysAlive: number;
  isDead: boolean;
}
