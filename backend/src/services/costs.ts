import { OPERATION_COSTS, type OperationType } from '../config/costs';
import { getSolPrice, usdToSol } from './price';
import { getChumState, insertTransaction, getTodayExpenses, getTodayExpenseCount } from './supabase';

export async function trackCost(
  operation: OperationType
): Promise<{ costUsd: number; costSol: number }> {
  const costUsd = OPERATION_COSTS[operation];
  const solPrice = await getSolPrice();
  const costSol = usdToSol(costUsd, solPrice);

  await insertTransaction('expense', costSol, `${operation} ($${costUsd})`);

  console.log(
    `[COST] ${operation}: $${costUsd} = ${costSol.toFixed(8)} SOL (@ $${solPrice.toFixed(0)})`
  );

  return { costUsd, costSol };
}

export async function canAfford(operation: OperationType): Promise<boolean> {
  const solPrice = await getSolPrice();
  const costSol = usdToSol(OPERATION_COSTS[operation], solPrice);
  const effective = await getEffectiveBalance();
  return effective >= costSol;
}

export async function getEffectiveBalance(): Promise<number> {
  const state = await getChumState();
  const todayExpenses = await getTodayExpenses();
  return Math.max(0, Number(state.balance) - todayExpenses);
}

export async function getTodayBurn(): Promise<number> {
  return getTodayExpenses();
}

export async function getTodayOpCount(): Promise<number> {
  return getTodayExpenseCount();
}
