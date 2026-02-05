import {
  getChumState,
  getRecentThoughts,
  getTodayRevenue,
  getVillainCount,
  getTodayVillainCount,
  getRecentExpenses,
} from '../services/supabase';
import { getSolPrice, usdToSol } from '../services/price';
import { BASE_DAILY_COST_USD, DEFAULT_DAILY_OPS_USD } from '../config/costs';
import type { ThoughtContext } from '../services/groq';

export async function buildThoughtContext(): Promise<ThoughtContext> {
  const [state, recentThoughtRows, revenueToday, villainCount, newVillainsToday, solPrice, last7dExpenses] =
    await Promise.all([
      getChumState(),
      getRecentThoughts(5),
      getTodayRevenue(),
      getVillainCount(),
      getTodayVillainCount(),
      getSolPrice(),
      getRecentExpenses(7),
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
  };
}
