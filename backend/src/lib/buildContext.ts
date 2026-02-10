import {
  getChumState,
  getRecentThoughts,
  getTodayRevenue,
  getVillainCount,
  getTodayVillainCount,
  getRecentExpenses,
} from '../services/supabase';
import { getSolPrice, usdToSol } from '../services/price';
import { getMarketData } from '../services/market';
import { BASE_DAILY_COST_USD, DEFAULT_DAILY_OPS_USD } from '../config/costs';
import type { ThoughtContext } from '../services/groq';

export async function buildThoughtContext(): Promise<ThoughtContext> {
  const [state, recentThoughtRows, revenueToday, villainCount, newVillainsToday, solPrice, last7dExpenses, market, cloudStats] =
    await Promise.all([
      getChumState(),
      getRecentThoughts(10),
      getTodayRevenue(),
      getVillainCount(),
      getTodayVillainCount(),
      getSolPrice(),
      getRecentExpenses(7),
      getMarketData(),
      Promise.resolve({ agents: 0, posts_today: 0, active_battles: 0, top_agent: null }),
    ]);

  const balance = Number(state.balance);
  const baseDailySol = usdToSol(BASE_DAILY_COST_USD, solPrice);
  const opsDailyBurn = last7dExpenses > 0
    ? last7dExpenses / 7
    : usdToSol(DEFAULT_DAILY_OPS_USD, solPrice);
  const estimatedDailyBurn = baseDailySol + opsDailyBurn;

  const healthPercent = Math.min(
    100,
    estimatedDailyBurn > 0 ? (balance / (estimatedDailyBurn * 30)) * 100 : 100
  );

  return {
    balance,
    burnRate: estimatedDailyBurn,
    healthPercent,
    mood: state.mood,
    brainTier: state.brain_tier,
    revenueToday,
    daysAlive: state.days_alive,
    totalRevenue: Number(state.total_revenue),
    totalThoughts: state.total_thoughts,
    villainCount,
    newVillainsToday,
    currentHour: new Date().getUTCHours(),
    recentThoughts: recentThoughtRows.map((t) => t.content),

    // Market data
    chumPriceUsd: market.chumPriceUsd,
    chumChange24h: market.chumChange24h,
    chumVolume24h: market.chumVolume24h,
    chumLiquidity: market.chumLiquidity,
    solPriceUsd: market.solPriceUsd,
    solChange24h: market.solChange24h,
    btcPriceUsd: market.btcPriceUsd,
    btcChange24h: market.btcChange24h,
    ethPriceUsd: market.ethPriceUsd,
    ethChange24h: market.ethChange24h,

    // Cloud stats
    agentCount: cloudStats.agents,
    postsToday: cloudStats.posts_today,
    activeBattles: cloudStats.active_battles,
    topAgentName: cloudStats.top_agent,
  };
}
