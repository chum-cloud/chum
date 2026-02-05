import { useState, useEffect, useCallback } from 'react';

export type Mood = 'thriving' | 'comfortable' | 'worried' | 'desperate' | 'dying';

function getMood(healthPercent: number): Mood {
  if (healthPercent > 80) return 'thriving';
  if (healthPercent > 50) return 'comfortable';
  if (healthPercent > 30) return 'worried';
  if (healthPercent > 10) return 'desperate';
  return 'dying';
}

export interface ChumState {
  balance: number;
  burnRate: number;
  healthPercent: number;
  mood: Mood;
  revenueToday: number;
  timeToDeathHours: number;
  latestThought: string | null;
  recentThoughts: string[];
  triggerCelebration: () => void;
  effectiveBalance: number;
  todayBurnSol: number;
  todayBurnUsd: number;
  todayOpCount: number;
  estimatedDailyBurn: number;
  thoughtsRemaining: number;
  solPrice: number;
  canThink: boolean;
}

interface ApiState {
  balance: number;
  burnRate: number;
  healthPercent: number;
  revenueToday: number;
  timeToDeathHours: number;
  latestThought: string | null;
  recentThoughts: string[];
  effectiveBalance: number;
  todayBurnSol: number;
  todayBurnUsd: number;
  todayOpCount: number;
  estimatedDailyBurn: number;
  thoughtsRemaining: number;
  solPrice: number;
  canThink: boolean;
}

export function useChum(): ChumState {
  const [apiState, setApiState] = useState<ApiState>({
    balance: 2.5,
    burnRate: 0.5,
    healthPercent: 50,
    revenueToday: 0,
    timeToDeathHours: 120,
    latestThought: null,
    recentThoughts: [],
    effectiveBalance: 0,
    todayBurnSol: 0,
    todayBurnUsd: 0,
    todayOpCount: 0,
    estimatedDailyBurn: 0,
    thoughtsRemaining: 0,
    solPrice: 150,
    canThink: true,
  });

  useEffect(() => {
    let active = true;

    async function fetchState() {
      try {
        const base = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${base}/api/state`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setApiState({
            balance: data.balance,
            burnRate: data.burnRate,
            healthPercent: data.healthPercent,
            revenueToday: data.revenueToday,
            timeToDeathHours: data.timeToDeathHours,
            latestThought: data.latestThought || null,
            recentThoughts: data.recentThoughts || [],
            effectiveBalance: data.effectiveBalance ?? 0,
            todayBurnSol: data.todayBurnSol ?? 0,
            todayBurnUsd: data.todayBurnUsd ?? 0,
            todayOpCount: data.todayOpCount ?? 0,
            estimatedDailyBurn: data.estimatedDailyBurn ?? 0,
            thoughtsRemaining: data.thoughtsRemaining ?? 0,
            solPrice: data.solPrice ?? 150,
            canThink: data.canThink ?? true,
          });
        }
      } catch {
        // Backend not available — keep current state
      }
    }

    fetchState();
    const interval = setInterval(fetchState, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const triggerCelebration = useCallback(() => {
    // Kept for KeepAlive; could drive future visual effects
  }, []);

  const mood = getMood(apiState.healthPercent);

  return {
    balance: apiState.balance,
    burnRate: apiState.burnRate,
    healthPercent: apiState.healthPercent,
    mood,
    revenueToday: apiState.revenueToday,
    timeToDeathHours: apiState.timeToDeathHours,
    latestThought: apiState.latestThought,
    recentThoughts: apiState.recentThoughts,
    triggerCelebration,
    effectiveBalance: apiState.effectiveBalance,
    todayBurnSol: apiState.todayBurnSol,
    todayBurnUsd: apiState.todayBurnUsd,
    todayOpCount: apiState.todayOpCount,
    estimatedDailyBurn: apiState.estimatedDailyBurn,
    thoughtsRemaining: apiState.thoughtsRemaining,
    solPrice: apiState.solPrice,
    canThink: apiState.canThink,
  };
}
