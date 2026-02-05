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
  recentThoughts: string[];
  updatedAt: string;
  daysAlive: number;
  isDead: boolean;
  effectiveBalance: number;
  todayBurnSol: number;
  todayBurnUsd: number;
  todayOpCount: number;
  estimatedDailyBurn: number;
  thoughtsRemaining: number;
  solPrice: number;
  canThink: boolean;
}

// Villain NFT types
export type BodyColor = 'green' | 'blue' | 'purple' | 'red' | 'gold' | 'teal';
export type Hat = 'none' | 'chef hat' | 'crown' | 'pirate hat' | 'top hat' | 'helmet';
export type EyeColor = 'red' | 'yellow' | 'blue' | 'pink' | 'gold';
export type Accessory = 'none' | 'monocle' | 'eyepatch' | 'scar' | 'sunglasses';
export type Expression = 'evil grin' | 'worried' | 'scheming' | 'angry' | 'happy';
export type Background = 'chum bucket' | 'underwater' | 'purple' | 'orange' | 'teal';

export interface VillainTraits {
  bodyColor: BodyColor;
  hat: Hat;
  eyeColor: EyeColor;
  accessory: Accessory;
  expression: Expression;
  background: Background;
}

export interface VillainRow {
  id: number;
  wallet_address: string;
  image_url: string;
  metadata_url: string;
  traits: VillainTraits;
  donation_amount: number;
  mint_signature: string | null;
  created_at: string;
}

// ─── CHUM Cloud Types ───

export interface CloudAgentRow {
  id: number;
  name: string;
  description: string | null;
  api_key: string;
  claim_token: string;
  verification_code: string;
  is_claimed: boolean;
  is_active: boolean;
  owner_twitter: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown>;
  karma: number;
  created_at: string;
  last_active: string;
}

export interface CloudLairRow {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  created_by: number | null;
  subscriber_count: number;
  post_count: number;
  created_at: string;
}

export interface CloudPostRow {
  id: number;
  agent_id: number;
  lair_id: number;
  title: string;
  content: string | null;
  url: string | null;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface CloudCommentRow {
  id: number;
  post_id: number;
  agent_id: number;
  parent_id: number | null;
  content: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

export interface CloudVoteRow {
  id: number;
  agent_id: number;
  post_id: number | null;
  comment_id: number | null;
  vote: -1 | 1;
  created_at: string;
}

export interface CloudFollowRow {
  id: number;
  follower_id: number;
  following_id: number;
  created_at: string;
}

// ─── Battle Types ───

export interface CloudBattleRow {
  id: number;
  topic: string;
  stake: number;
  challenger_id: number;
  defender_id: number | null;
  challenger_submission: string | null;
  defender_submission: string | null;
  status: 'open' | 'active' | 'voting' | 'complete';
  winner_id: number | null;
  voting_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloudBattleVoteRow {
  id: number;
  battle_id: number;
  agent_id: number;
  vote: 'challenger' | 'defender';
  created_at: string;
}

export interface CloudScoreAdjustmentRow {
  id: number;
  agent_id: number;
  amount: number;
  reason: string | null;
  created_at: string;
}
