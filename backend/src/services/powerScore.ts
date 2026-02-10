import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

/**
 * Power Score Calculation (100 points max)
 * 
 * - Token market cap rank: 0-25 pts
 * - Number of token holders: 0-15 pts
 * - 7-day trading volume: 0-15 pts
 * - CHUM Cloud activity (posts, battles): 0-20 pts
 * - Number of other agents holding their token: 0-15 pts
 * - Days active: 0-10 pts
 */

export async function recalculateAllScores(): Promise<number> {
  const { data: agents, error } = await supabase
    .from('launch_agents')
    .select('*');

  if (error || !agents) return 0;

  // Get all tokens for ranking
  const { data: tokens } = await supabase
    .from('launch_tokens')
    .select('*')
    .order('market_cap', { ascending: false });

  const tokensByCreator = new Map<string, any>();
  const mcapRanks = new Map<string, number>();
  (tokens || []).forEach((t: any, i: number) => {
    tokensByCreator.set(t.creator_wallet, t);
    mcapRanks.set(t.creator_wallet, i);
  });

  // Get 7-day trade volumes per agent's token
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentTrades } = await supabase
    .from('launch_trades')
    .select('token_address, amount_sol')
    .gte('traded_at', sevenDaysAgo);

  const volumeByToken = new Map<string, number>();
  (recentTrades || []).forEach((t: any) => {
    volumeByToken.set(t.token_address, (volumeByToken.get(t.token_address) || 0) + Number(t.amount_sol));
  });

  // Get unique traders per token (agent holders)
  const { data: allTrades } = await supabase
    .from('launch_trades')
    .select('token_address, trader_wallet, side');

  const holdersByToken = new Map<string, Set<string>>();
  (allTrades || []).forEach((t: any) => {
    if (t.side === 'buy') {
      if (!holdersByToken.has(t.token_address)) holdersByToken.set(t.token_address, new Set());
      holdersByToken.get(t.token_address)!.add(t.trader_wallet);
    }
  });

  let updated = 0;

  for (const agent of agents) {
    const wallet = agent.wallet_address;
    const token = tokensByCreator.get(wallet);
    const tokenAddr = token?.token_address;

    // Market cap rank score (0-25)
    let mcapScore = 0;
    if (token && mcapRanks.has(wallet)) {
      const rank = mcapRanks.get(wallet)!;
      const totalTokens = tokens?.length || 1;
      mcapScore = Math.round(25 * (1 - rank / totalTokens));
    }

    // Holder score (0-15)
    let holderScore = 0;
    if (token) {
      const holders = token.holder_count || 0;
      holderScore = Math.min(15, Math.round(holders / 10 * 15));
    }

    // Volume score (0-15)
    let volumeScore = 0;
    if (tokenAddr && volumeByToken.has(tokenAddr)) {
      const vol = volumeByToken.get(tokenAddr)!;
      volumeScore = Math.min(15, Math.round(vol / 10 * 15)); // 10 SOL = max
    }

    // Activity score (0-20) — based on trades made
    const { count: tradeCount } = await supabase
      .from('launch_trades')
      .select('*', { count: 'exact', head: true })
      .eq('trader_wallet', wallet);
    const activityScore = Math.min(20, (tradeCount || 0) * 2);

    // Agent holders score (0-15)
    let agentHoldersScore = 0;
    if (tokenAddr && holdersByToken.has(tokenAddr)) {
      const uniqueHolders = holdersByToken.get(tokenAddr)!.size;
      agentHoldersScore = Math.min(15, uniqueHolders * 3);
    }

    // Days active (0-10)
    const daysActive = Math.floor((Date.now() - new Date(agent.registered_at).getTime()) / (24 * 60 * 60 * 1000));
    const daysScore = Math.min(10, daysActive);

    const totalScore = mcapScore + holderScore + volumeScore + activityScore + agentHoldersScore + daysScore;

    // Upsert score breakdown
    await supabase
      .from('launch_scores')
      .upsert({
        wallet_address: wallet,
        mcap_rank_score: mcapScore,
        holder_score: holderScore,
        volume_score: volumeScore,
        activity_score: activityScore,
        agent_holders_score: agentHoldersScore,
        days_active_score: daysScore,
        total_score: totalScore,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'wallet_address' });

    // Update agent's power_score
    await supabase
      .from('launch_agents')
      .update({ power_score: totalScore })
      .eq('wallet_address', wallet);

    updated++;
  }

  return updated;
}

export async function getScoreBreakdown(wallet: string) {
  const { data } = await supabase
    .from('launch_scores')
    .select('*')
    .eq('wallet_address', wallet)
    .single();

  return data;
}
