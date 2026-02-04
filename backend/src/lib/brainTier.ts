import type { BrainTier } from '../types';

/**
 * Map monthly revenue (USD) to brain tier.
 * Higher revenue = better brain food = smarter CHUM.
 */
export function calculateBrainTier(monthlyRevenue: number): BrainTier {
  if (monthlyRevenue >= 200) return 4;
  if (monthlyRevenue >= 100) return 3;
  if (monthlyRevenue >= 50) return 2;
  if (monthlyRevenue >= 30) return 1;
  return 0;
}
