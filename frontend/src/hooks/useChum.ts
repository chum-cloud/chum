import { useState, useEffect, useCallback } from 'react';

export type Mood = 'thriving' | 'comfortable' | 'worried' | 'desperate' | 'dying';
export type AnimationState = 'running' | 'sad-walk' | 'idle' | 'death' | 'celebrate';

function getMood(healthPercent: number): Mood {
  if (healthPercent > 80) return 'thriving';
  if (healthPercent > 50) return 'comfortable';
  if (healthPercent > 30) return 'worried';
  if (healthPercent > 10) return 'desperate';
  return 'dying';
}

function getAnimationState(healthPercent: number, celebrating: boolean): AnimationState {
  if (healthPercent <= 0) return 'death';
  if (celebrating) return 'celebrate';
  if (healthPercent < 30) return 'sad-walk';
  if (healthPercent < 15) return 'idle';
  return 'running';
}

export interface ChumState {
  balance: number;
  burnRate: number;
  healthPercent: number;
  mood: Mood;
  animationState: AnimationState;
  revenueToday: number;
  timeToDeathHours: number;
  triggerCelebration: () => void;
}

interface ApiState {
  balance: number;
  burnRate: number;
  healthPercent: number;
  revenueToday: number;
  timeToDeathHours: number;
}

export function useChum(): ChumState {
  const [apiState, setApiState] = useState<ApiState>({
    balance: 2.5,
    burnRate: 0.5,
    healthPercent: 50,
    revenueToday: 0,
    timeToDeathHours: 120,
  });
  const [celebrating, setCelebrating] = useState(false);

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
    setCelebrating(true);
    setTimeout(() => setCelebrating(false), 2000);
  }, []);

  const mood = getMood(apiState.healthPercent);
  const animationState = getAnimationState(apiState.healthPercent, celebrating);

  return {
    balance: apiState.balance,
    burnRate: apiState.burnRate,
    healthPercent: apiState.healthPercent,
    mood,
    animationState,
    revenueToday: apiState.revenueToday,
    timeToDeathHours: apiState.timeToDeathHours,
    triggerCelebration,
  };
}
