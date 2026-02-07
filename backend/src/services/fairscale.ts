/**
 * FairScale API Integration
 * Fetches reputation scores for Solana wallets
 */

import { config } from '../config';

const FAIRSCALE_API_URL = 'https://api2.fairscale.xyz';
const FAIRSCALE_API_KEY = config.fairscaleApiKey;

export interface FairScaleBadge {
  id: string;
  label: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface FairScaleFeatures {
  lst_percentile_score: number;
  major_percentile_score: number;
  native_sol_percentile: number;
  stable_percentile_score: number;
  tx_count: number;
  active_days: number;
  median_gap_hours: number;
  tempo_cv: number;
  burst_ratio: number;
  net_sol_flow_30d: number;
  median_hold_days: number;
  no_instant_dumps: number;
  conviction_ratio: number;
  platform_diversity: number;
  wallet_age_score: number;
}

export interface FairScaleResponse {
  wallet: string;
  fairscore_base: number;
  social_score: number;
  fairscore: number;
  badges: FairScaleBadge[];
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  timestamp: string;
  features: FairScaleFeatures;
}

/**
 * Fetch complete FairScore for a wallet
 */
export async function getFairScore(wallet: string): Promise<FairScaleResponse | null> {
  if (!FAIRSCALE_API_KEY) {
    console.warn('[FairScale] No API key configured');
    return null;
  }

  try {
    const response = await fetch(`${FAIRSCALE_API_URL}/score?wallet=${wallet}`, {
      headers: {
        'fairkey': FAIRSCALE_API_KEY,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[FairScale] Rate limit exceeded');
      } else if (response.status === 401) {
        console.error('[FairScale] Invalid API key');
      } else {
        console.error(`[FairScale] API error: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();
    return data as FairScaleResponse;
  } catch (error) {
    console.error('[FairScale] Fetch error:', error);
    return null;
  }
}

/**
 * Get just the FairScore number (lighter endpoint)
 */
export async function getFairScoreOnly(wallet: string): Promise<number | null> {
  if (!FAIRSCALE_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${FAIRSCALE_API_URL}/fairScore?wallet=${wallet}`, {
      headers: {
        'fairkey': FAIRSCALE_API_KEY,
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as { fairscore?: number };
    return data.fairscore ?? null;
  } catch {
    return null;
  }
}

/**
 * Determine villain tier based on FairScore
 * Higher FairScore = more trusted = higher villain rank potential
 */
export function getFairScoreTier(score: number): {
  tier: string;
  label: string;
  color: string;
  multiplier: number;
} {
  if (score >= 80) {
    return { tier: 'elite', label: '🏆 Elite Villain', color: '#FFD700', multiplier: 2.0 };
  } else if (score >= 60) {
    return { tier: 'veteran', label: '⚔️ Veteran Villain', color: '#C0C0C0', multiplier: 1.5 };
  } else if (score >= 40) {
    return { tier: 'trusted', label: '✅ Trusted Villain', color: '#CD7F32', multiplier: 1.25 };
  } else if (score >= 20) {
    return { tier: 'verified', label: '🔰 Verified Villain', color: '#4CAF50', multiplier: 1.1 };
  } else {
    return { tier: 'unverified', label: '❓ Unverified', color: '#808080', multiplier: 1.0 };
  }
}

/**
 * Check if wallet meets minimum FairScore for gated features
 */
export function meetsMinimumScore(score: number | null, minimum: number = 30): boolean {
  return score !== null && score >= minimum;
}
