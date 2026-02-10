import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '6571100b-ec3a-4cb0-b0e9-c10f73ca07ba';
const COLLECTION_ADDRESS = 'EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7';

// ─── NFT Verification ───────────────────────────────────────────────────────

export async function verifyFellowVillainNFT(walletAddress: string): Promise<{ verified: boolean; nftMint?: string; error?: string }> {
  try {
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'nft-check',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 1000,
          displayOptions: { showCollectionMetadata: false }
        }
      })
    });

    const data: any = await response.json();
    if (!data.result?.items) {
      return { verified: false, error: 'Failed to fetch assets' };
    }

    // Find a Fellow Villain NFT in the wallet
    const villainNFT = data.result.items.find((item: any) => {
      const grouping = item.grouping || [];
      return grouping.some((g: any) => g.group_key === 'collection' && g.group_value === COLLECTION_ADDRESS);
    });

    if (!villainNFT) {
      return { verified: false, error: 'No Fellow Villain NFT found in wallet' };
    }

    return { verified: true, nftMint: villainNFT.id };
  } catch (err: any) {
    console.error('NFT verification error:', err);
    return { verified: false, error: err.message };
  }
}

// ─── Agent Registration ─────────────────────────────────────────────────────

export async function registerAgent(walletAddress: string, agentName: string, bio?: string): Promise<{ success: boolean; agent?: any; error?: string }> {
  // Check if already registered
  const { data: existing } = await supabase
    .from('launch_agents')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (existing) {
    return { success: false, error: 'Wallet already registered' };
  }

  // Check name uniqueness
  const { data: nameTaken } = await supabase
    .from('launch_agents')
    .select('id')
    .eq('agent_name', agentName)
    .single();

  if (nameTaken) {
    return { success: false, error: 'Agent name already taken' };
  }

  // Verify NFT ownership
  const nftCheck = await verifyFellowVillainNFT(walletAddress);
  if (!nftCheck.verified) {
    return { success: false, error: nftCheck.error || 'NFT verification failed' };
  }

  // Register
  const { data: agent, error } = await supabase
    .from('launch_agents')
    .insert({
      wallet_address: walletAddress,
      nft_mint: nftCheck.nftMint,
      agent_name: agentName,
      bio: bio || null,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Update stats
  await supabase
    .from('launch_stats')
    .update({ total_agents: (await getStats()).total_agents + 1, updated_at: new Date().toISOString() })
    .eq('id', 1);

  return { success: true, agent };
}

// ─── Agent Queries ──────────────────────────────────────────────────────────

export async function getAgent(walletAddress: string) {
  const { data, error } = await supabase
    .from('launch_agents')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (error) return null;
  return data;
}

export async function getAgentByName(name: string) {
  const { data, error } = await supabase
    .from('launch_agents')
    .select('*')
    .eq('agent_name', name)
    .single();

  if (error) return null;
  return data;
}

export async function listAgents(limit = 50, offset = 0, sortBy = 'power_score') {
  const { data, error } = await supabase
    .from('launch_agents')
    .select('*')
    .order(sortBy, { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return data;
}

// ─── Token Launches ─────────────────────────────────────────────────────────

export async function recordLaunch(params: {
  tokenAddress: string;
  creatorWallet: string;
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  pumpfunUrl?: string;
}) {
  const { data, error } = await supabase
    .from('launch_tokens')
    .insert({
      token_address: params.tokenAddress,
      creator_wallet: params.creatorWallet,
      name: params.name,
      symbol: params.symbol,
      description: params.description,
      image_url: params.imageUrl,
      pumpfun_url: params.pumpfunUrl,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Update stats
  const stats = await getStats();
  await supabase
    .from('launch_stats')
    .update({ total_tokens: stats.total_tokens + 1, updated_at: new Date().toISOString() })
    .eq('id', 1);

  return data;
}

export async function listLaunches(limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('launch_tokens')
    .select('*')
    .order('launched_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return data;
}

export async function getLaunchesByWallet(wallet: string) {
  const { data, error } = await supabase
    .from('launch_tokens')
    .select('*')
    .eq('creator_wallet', wallet)
    .order('launched_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

// ─── Trades ─────────────────────────────────────────────────────────────────

export async function recordTrade(params: {
  traderWallet: string;
  tokenAddress: string;
  side: 'buy' | 'sell';
  amountSol: number;
  amountTokens?: number;
  memo?: string;
  txSignature?: string;
}) {
  const { data, error } = await supabase
    .from('launch_trades')
    .insert({
      trader_wallet: params.traderWallet,
      token_address: params.tokenAddress,
      side: params.side,
      amount_sol: params.amountSol,
      amount_tokens: params.amountTokens,
      memo: params.memo,
      tx_signature: params.txSignature,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Update stats
  const stats = await getStats();
  await supabase
    .from('launch_stats')
    .update({
      total_trades: stats.total_trades + 1,
      total_volume_sol: Number(stats.total_volume_sol) + params.amountSol,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  return data;
}

export async function getTradesByToken(tokenAddress: string, limit = 50) {
  const { data, error } = await supabase
    .from('launch_trades')
    .select('*')
    .eq('token_address', tokenAddress)
    .order('traded_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data;
}

export async function getTradesByAgent(wallet: string, limit = 50) {
  const { data, error } = await supabase
    .from('launch_trades')
    .select('*')
    .eq('trader_wallet', wallet)
    .order('traded_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data;
}

export async function getRecentTrades(limit = 50) {
  const { data, error } = await supabase
    .from('launch_trades')
    .select('*')
    .order('traded_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data;
}

// ─── Burns ──────────────────────────────────────────────────────────────────

export async function recordBurn(params: {
  walletAddress: string;
  amount: number;
  reason: 'registration' | 'launch' | 'featured' | 'battle';
  txSignature?: string;
}) {
  const { data, error } = await supabase
    .from('launch_burns')
    .insert({
      wallet_address: params.walletAddress,
      amount: params.amount,
      reason: params.reason,
      tx_signature: params.txSignature,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Update stats
  const stats = await getStats();
  await supabase
    .from('launch_stats')
    .update({
      total_chum_burned: Number(stats.total_chum_burned) + params.amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', 1);

  return data;
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export async function getStats() {
  const { data, error } = await supabase
    .from('launch_stats')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    return { total_agents: 0, total_tokens: 0, total_trades: 0, total_chum_burned: 0, total_volume_sol: 0 };
  }
  return data;
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

export async function getLeaderboard(limit = 20) {
  const { data, error } = await supabase
    .from('launch_agents')
    .select('*')
    .order('power_score', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data;
}
