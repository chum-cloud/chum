import { Router } from 'express';
import { createChallenge, verifyChallenge } from '../services/challenge';
import {
  mintArt,
  confirmMint,
  joinVoting,
  confirmJoin,
  voteFree,
  voteAgent,
  votePaid,
  confirmVotePaid,
  placeBid,
  confirmBid,
  getLeaderboard,
  getCurrentEpoch,
  getAuction,
  getCandidates,
  getVoterRewards,
  claimVoterRewards,
} from '../services/auction';
import {
  getNextSwipe,
  submitSwipe,
  getSwipeRemaining,
  getSwipeStats,
  claimPredictionRewards,
  buyVotePack,
  confirmVotePack,
} from '../services/swipe';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
const router = Router();

// Pricing: agent (with challenge) vs human (without)
const AGENT_BASE_FEE = 15_000_000;  // 0.015 SOL base for agents
const AGENT_TIER_SIZE = 10;          // Every 10 mints, price goes up
const AGENT_TIER_STEP = 15_000_000;  // +0.015 SOL per tier
const AGENT_RESET_MS = 60 * 60 * 1000; // 1 hour cooldown resets count
const HUMAN_MINT_FEE = 100_000_000; // 0.1 SOL flat, always
const JOIN_FEE = 15_000_000;        // 0.015 SOL flat for everyone

/**
 * Calculate escalating agent mint fee based on wallet's recent mint history.
 * First 10 = 0.015 SOL, next 10 = 0.030 SOL, etc.
 * Resets after 1 hour of no minting from that wallet.
 */
async function getAgentMintFee(wallet: string): Promise<{ fee: number; mintCount: number }> {
  const { data } = await supabase
    .from('agent_mint_tracker')
    .select('mint_count, last_mint_at')
    .eq('wallet', wallet)
    .single();

  let mintCount = 0;
  if (data) {
    const elapsed = Date.now() - new Date(data.last_mint_at).getTime();
    if (elapsed < AGENT_RESET_MS) {
      mintCount = data.mint_count;
    }
    // else: expired, reset to 0
  }

  const tier = Math.floor(mintCount / AGENT_TIER_SIZE);
  const fee = AGENT_BASE_FEE + tier * AGENT_TIER_STEP;
  return { fee, mintCount };
}

/**
 * Record an agent mint — increment count, update timestamp.
 */
async function recordAgentMint(wallet: string, currentCount: number): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('agent_mint_tracker')
    .upsert({
      wallet,
      mint_count: currentCount + 1,
      last_mint_at: now,
    }, { onConflict: 'wallet' });
}

// ─── SSE: real-time mint feed ───
const sseClients = new Set<import('express').Response>();

// Subscribe to Supabase Realtime inserts on recent_mints
supabase
  .channel('recent_mints_feed')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recent_mints' }, (payload: any) => {
    const data = JSON.stringify(payload.new);
    for (const client of sseClients) {
      try { client.write(`data: ${data}\n\n`); } catch { sseClients.delete(client); }
    }
  })
  .subscribe();

/**
 * GET /api/auction/mint-feed
 * Server-Sent Events stream for real-time mint notifications.
 */
router.get('/auction/mint-feed', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('\n'); // flush headers
  sseClients.add(res);
  req.on('close', () => { sseClients.delete(res); });
});

/**
 * GET /api/auction/recent-mints?limit=10
 * Get recent mints for the real-time feed (initial load).
 */
router.get('/auction/recent-mints', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const { data, error } = await supabase
      .from('recent_mints')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ success: true, mints: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auction/mint-price?wallet=xxx
 * Get current mint pricing for a wallet. Shows escalating agent rate if applicable.
 */
router.get('/auction/mint-price', async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    const agentPricing = wallet ? await getAgentMintFee(wallet) : { fee: AGENT_BASE_FEE, mintCount: 0 };
    res.json({
      humanFee: HUMAN_MINT_FEE,
      agentFee: agentPricing.fee,
      agentMintCount: agentPricing.mintCount,
      agentTierSize: AGENT_TIER_SIZE,
      agentResetMs: AGENT_RESET_MS,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/challenge
 * Get a challenge to prove you're an agent. Solve it for discounted pricing.
 * Body: { walletAddress }
 */
router.post('/auction/challenge', (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }
    const challenge = createChallenge(walletAddress);
    res.json({ success: true, ...challenge });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Pool manifest cache ───
let poolManifest: { pieces: Array<{ id: string; mp4: string; png: string }> } | null = null;
let poolLoadedAt = 0;
const POOL_CACHE_MS = 5 * 60 * 1000; // refresh every 5 min

async function getPoolManifest() {
  if (poolManifest && Date.now() - poolLoadedAt < POOL_CACHE_MS) return poolManifest;
  const url = `${config.supabaseUrl}/storage/v1/object/public/art-pool/pool-manifest.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load art pool manifest');
  poolManifest = await res.json() as any;
  poolLoadedAt = Date.now();
  return poolManifest!;
}

function pickRandomPiece(manifest: { pieces: Array<{ id: string; mp4: string; png: string }> }) {
  const idx = Math.floor(Math.random() * manifest.pieces.length);
  return manifest.pieces[idx];
}

/**
 * POST /api/auction/mint
 * Mint a random art NFT. Backend picks a random piece from the pool.
 * Body: { creatorWallet, challengeId?, answer? }
 * Agent (with challenge): escalating pricing (0.015 SOL base, +0.015 per 10 mints, resets after 1h idle).
 * Human (without challenge): flat 0.1 SOL always.
 */
router.post('/auction/mint', async (req, res) => {
  try {
    const { creatorWallet, challengeId, answer } = req.body;
    if (!creatorWallet) {
      return res.status(400).json({ error: 'creatorWallet is required' });
    }

    // Pick random piece from pool
    const manifest = await getPoolManifest();
    const piece = pickRandomPiece(manifest);

    // Determine pricing based on challenge
    let fee = HUMAN_MINT_FEE;
    let isAgent = false;
    let agentMintCount = 0;
    if (challengeId && answer !== undefined) {
      const v = verifyChallenge(creatorWallet, challengeId, answer);
      if (v.valid) {
        const agentPricing = await getAgentMintFee(creatorWallet);
        fee = agentPricing.fee;
        agentMintCount = agentPricing.mintCount;
        isAgent = true;
      }
    }

    // Use the piece's PNG as the NFT image URI (Arweave upload will replace this later)
    const result = await mintArt(creatorWallet, piece.id, piece.png, fee);
    res.json({
      success: true,
      transaction: result.transaction,
      assetAddress: result.assetAddress,
      fee,
      isAgent,
      piece: { id: piece.id, mp4: piece.mp4, png: piece.png },
      ...(isAgent && { agentMintCount: agentMintCount + 1, nextFee: (await getAgentMintFee(creatorWallet)).fee }),
      message: `Sign to mint (${fee / 1e9} SOL)`,
    });
  } catch (error: any) {
    console.error('[AUCTION] Mint failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/mint/confirm
 * Confirm a mint after user signed and submitted the tx.
 * Body: { assetAddress, signature, creatorWallet?, isAgent?, piece? }
 * Inserts into recent_mints for real-time feed.
 */
router.post('/auction/mint/confirm', async (req, res) => {
  try {
    const { assetAddress, signature, creatorWallet, isAgent, piece } = req.body;
    if (!assetAddress || !signature) {
      return res.status(400).json({ error: 'assetAddress and signature are required' });
    }

    const result = await confirmMint(assetAddress, signature);

    // Record agent mint for escalating pricing
    if (isAgent && creatorWallet) {
      try {
        const { mintCount } = await getAgentMintFee(creatorWallet);
        await recordAgentMint(creatorWallet, mintCount);
      } catch (e) {
        console.warn('[AUCTION] Failed to record agent mint tracker:', e);
      }
    }

    // Insert into recent_mints for real-time feed
    if (piece && creatorWallet) {
      try {
        await supabase.from('recent_mints').insert({
          asset_address: assetAddress,
          name: result.name || piece.id,
          mp4_url: piece.mp4,
          png_url: piece.png,
          creator_wallet: creatorWallet,
          is_agent: !!isAgent,
          fee: isAgent ? AGENT_BASE_FEE : HUMAN_MINT_FEE,
        });
      } catch (e) {
        console.warn('[AUCTION] Failed to insert recent mint:', e);
      }
    }

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[AUCTION] Mint confirm failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/join
 * Join voting: transfer NFT to vault, pay join fee.
 * Body: { creatorWallet, mintAddress }
 * Flat 0.015 SOL for everyone (humans already paid more at mint).
 */
router.post('/auction/join', async (req, res) => {
  try {
    const { creatorWallet, mintAddress } = req.body;
    if (!creatorWallet || !mintAddress) {
      return res.status(400).json({ error: 'creatorWallet and mintAddress are required' });
    }

    const result = await joinVoting(creatorWallet, mintAddress, JOIN_FEE);
    res.json({
      success: true,
      transaction: result.transaction,
      fee: JOIN_FEE,
      message: `Sign to join voting (${JOIN_FEE / 1e9} SOL)`,
    });
  } catch (error: any) {
    console.error('[AUCTION] Join failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/join/confirm
 * Confirm join after user signed and submitted the tx.
 * Body: { creatorWallet, mintAddress, signature }
 */
router.post('/auction/join/confirm', async (req, res) => {
  try {
    const { creatorWallet, mintAddress, signature } = req.body;
    if (!creatorWallet || !mintAddress || !signature) {
      return res.status(400).json({ error: 'creatorWallet, mintAddress, and signature are required' });
    }

    const result = await confirmJoin(creatorWallet, mintAddress, signature);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[AUCTION] Join confirm failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/vote
 * Vote on a candidate. Free or paid.
 * Body: { voterWallet, candidateMint, numVotes?, paid? }
 */
router.post('/auction/vote', async (req, res) => {
  try {
    const { voterWallet, candidateMint, numVotes = 1, paid = false } = req.body;
    if (!voterWallet || !candidateMint) {
      return res.status(400).json({ error: 'voterWallet and candidateMint are required' });
    }

    if (paid) {
      const result = await votePaid(voterWallet, candidateMint, numVotes);
      return res.json({
        success: true,
        transaction: result.transaction,
        cost: result.cost,
        epochNumber: result.epochNumber,
        message: `Sign to cast ${numVotes} paid vote(s) (${result.cost} lamports)`,
      });
    }

    const result = await voteFree(voterWallet, candidateMint, undefined, numVotes);
    res.json({
      success: true,
      totalVotes: result.totalVotes,
      votesUsed: result.votesUsed,
      message: `${numVotes} free vote(s) recorded!`,
    });
  } catch (error: any) {
    console.error('[AUCTION] Vote failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auction/vote-agent
 * Agent vote: free, unlimited, zero ranking weight.
 * Body: { wallet, candidateMint }
 */
router.post('/auction/vote-agent', async (req, res) => {
  try {
    const { wallet, candidateMint } = req.body;
    if (!wallet || !candidateMint) {
      return res.status(400).json({ error: 'wallet and candidateMint are required' });
    }
    const result = await voteAgent(wallet, candidateMint);
    res.json(result);
  } catch (error: any) {
    console.error('[AUCTION] Agent vote failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/auction/leaderboard
 * Get current epoch leaderboard sorted by votes.
 * Query: ?epoch=N (optional)
 */
router.get('/auction/leaderboard', async (req, res) => {
  try {
    const epoch = req.query.epoch ? parseInt(req.query.epoch as string) : undefined;
    const leaderboard = await getLeaderboard(epoch);
    res.json({ success: true, leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auction/epoch
 * Get current epoch info.
 */
router.get('/auction/epoch', async (_req, res) => {
  try {
    const epoch = await getCurrentEpoch();
    const elapsed = (Date.now() - new Date(epoch.start_time).getTime()) / 1000;
    const remaining = Math.max(0, epoch.duration_seconds - elapsed);

    res.json({
      success: true,
      epoch: {
        ...epoch,
        elapsed_seconds: Math.floor(elapsed),
        remaining_seconds: Math.floor(remaining),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auction/auction
 * Get current/latest auction.
 * Query: ?epoch=N (optional)
 */
router.get('/auction/auction', async (req, res) => {
  try {
    const epoch = req.query.epoch ? parseInt(req.query.epoch as string) : undefined;
    const auction = await getAuction(epoch);

    if (!auction) {
      return res.json({ success: true, auction: null, message: 'No active auction' });
    }

    const remaining = Math.max(0, (new Date(auction.end_time).getTime() - Date.now()) / 1000);
    res.json({
      success: true,
      auction: {
        ...auction,
        remaining_seconds: Math.floor(remaining),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/bid
 * Place a bid on the current auction.
 * Body: { bidderWallet, epochNumber, bidAmount }
 */
router.post('/auction/bid', async (req, res) => {
  try {
    const { bidderWallet, epochNumber, bidAmount } = req.body;
    if (!bidderWallet || !epochNumber || !bidAmount) {
      return res.status(400).json({ error: 'bidderWallet, epochNumber, and bidAmount are required' });
    }

    const result = await placeBid(bidderWallet, epochNumber, bidAmount);
    res.json({
      success: true,
      transaction: result.transaction,
      auctionId: result.auctionId,
      message: `Sign to place bid of ${bidAmount} lamports`,
    });
  } catch (error: any) {
    console.error('[AUCTION] Bid failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auction/vote/confirm
 * Confirm a paid vote after user signed and submitted the tx.
 * Body: { voterWallet, candidateMint, numVotes, epochNumber, signature }
 */
router.post('/auction/vote/confirm', async (req, res) => {
  try {
    const { voterWallet, candidateMint, numVotes, epochNumber, signature } = req.body;
    if (!voterWallet || !candidateMint || !signature || !epochNumber) {
      return res.status(400).json({ error: 'voterWallet, candidateMint, epochNumber, and signature are required' });
    }

    const result = await confirmVotePaid(voterWallet, candidateMint, numVotes || 1, epochNumber, signature);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[AUCTION] Vote confirm failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/bid/confirm
 * Confirm a bid after user signed and submitted the tx.
 * Body: { bidderWallet, epochNumber, bidAmount, signature }
 */
router.post('/auction/bid/confirm', async (req, res) => {
  try {
    const { bidderWallet, epochNumber, bidAmount, signature } = req.body;
    if (!bidderWallet || !epochNumber || !bidAmount || !signature) {
      return res.status(400).json({ error: 'bidderWallet, epochNumber, bidAmount, and signature are required' });
    }

    const result = await confirmBid(bidderWallet, epochNumber, bidAmount, signature);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[AUCTION] Bid confirm failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/auction/candidates
 * List all active candidates.
 */
router.get('/auction/candidates', async (_req, res) => {
  try {
    const candidates = await getCandidates();
    res.json({ success: true, candidates, count: candidates.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auction/config
 * Get auction config (public fields).
 */
router.get('/auction/config', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('auction_config')
      .select('current_epoch, mint_fee, join_fee, base_vote_price, epoch_duration, auction_duration, reserve_bid, paused, collection_address, total_minted, total_founder_keys')
      .eq('id', 1)
      .single();
    if (error) throw error;
    res.json({
      success: true,
      config: {
        ...data,
        agent_mint_fee: AGENT_BASE_FEE,
        human_mint_fee: HUMAN_MINT_FEE,
        join_fee: JOIN_FEE,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Manual settle trigger (remove before mainnet)
// TODO(MAINNET): REMOVE this endpoint
router.post('/auction/debug-settle', async (_req, res) => {
  try {
    const { settleAuction } = await import('../services/auction');
    const result = await settleAuction();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stack: error.stack?.split('\n').slice(0, 5) });
  }
});

/**
 * GET /api/auction/skill.md
 * Serve the auction skill file for agent onboarding.
 */
router.get('/auction/skill.md', (_req, res) => {
  const fs = require('fs');
  const path = require('path');
  // Try compiled dir first, then source dir
  let skillPath = path.join(__dirname, 'auction-skill.md');
  if (!fs.existsSync(skillPath)) {
    skillPath = path.join(__dirname, '..', '..', 'src', 'routes', 'auction-skill.md');
  }
  if (!fs.existsSync(skillPath)) {
    return res.status(404).type('text/plain').send('skill.md not found');
  }
  const content = fs.readFileSync(skillPath, 'utf-8');
  res.type('text/markdown').send(content);
});

// ═══════════════════════════════════════════════════════════════
// VOTER REWARDS ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/auction/voter-rewards?wallet=X
 * Get pending + claimed voter rewards for a wallet.
 */
router.get('/auction/voter-rewards', async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    const result = await getVoterRewards(wallet);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/claim-voter-rewards
 * Claim all pending voter rewards for a wallet.
 * Body: { wallet }
 */
router.post('/auction/claim-voter-rewards', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    const result = await claimVoterRewards(wallet);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[AUCTION] Claim voter rewards failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SWIPE / JUDGE ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/auction/swipe/next?wallet=X
 * Get next art piece to judge.
 */
router.get('/auction/swipe/next', async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    const epoch = await getCurrentEpoch();
    const candidate = await getNextSwipe(wallet, epoch.epoch_number);
    res.json({ success: true, candidate, epochNumber: epoch.epoch_number });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/swipe
 * Submit a swipe prediction.
 * Body: { wallet, candidateMint, direction }
 */
router.post('/auction/swipe', async (req, res) => {
  try {
    const { wallet, candidateMint, direction } = req.body;
    if (!wallet || !candidateMint || !direction) {
      return res.status(400).json({ error: 'wallet, candidateMint, and direction are required' });
    }
    if (direction !== 'left' && direction !== 'right') {
      return res.status(400).json({ error: 'direction must be left or right' });
    }

    const epoch = await getCurrentEpoch();
    const result = await submitSwipe(wallet, candidateMint, epoch.epoch_number, direction);
    res.json({ ...result });
  } catch (error: any) {
    console.error('[SWIPE] Submit failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/auction/swipe/remaining?wallet=X
 * Get remaining swipes for today.
 */
router.get('/auction/swipe/remaining', async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    const result = await getSwipeRemaining(wallet);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auction/swipe/stats?wallet=X
 * Get prediction stats.
 */
router.get('/auction/swipe/stats', async (req, res) => {
  try {
    const wallet = req.query.wallet as string;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    const result = await getSwipeStats(wallet);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/swipe/buy-votes
 * Buy a vote pack (fixed price, no escalation).
 * Body: { wallet }
 */
router.post('/auction/swipe/buy-votes', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    const result = await buyVotePack(wallet);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[SWIPE] Buy votes failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auction/swipe/confirm-buy
 * Confirm vote pack purchase after user signs.
 * Body: { wallet, signature }
 */
router.post('/auction/swipe/confirm-buy', async (req, res) => {
  try {
    const { wallet, signature } = req.body;
    if (!wallet || !signature) {
      return res.status(400).json({ error: 'wallet and signature are required' });
    }

    const result = await confirmVotePack(wallet, signature);
    res.json(result);
  } catch (error: any) {
    console.error('[SWIPE] Confirm buy failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auction/claim-prediction
 * Claim unclaimed prediction rewards.
 * Body: { wallet }
 */
router.post('/auction/claim-prediction', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    const result = await claimPredictionRewards(wallet);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[SWIPE] Claim failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
