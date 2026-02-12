import { Router } from 'express';
import {
  mintArt,
  confirmMint,
  joinVoting,
  confirmJoin,
  voteFree,
  votePaid,
  confirmVotePaid,
  placeBid,
  confirmBid,
  getLeaderboard,
  getCurrentEpoch,
  getAuction,
  getCandidates,
} from '../services/auction';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
const router = Router();

/**
 * POST /api/auction/mint
 * Mint a new art NFT. Returns partially-signed tx for user to countersign.
 * Body: { creatorWallet, name, uri }
 */
router.post('/auction/mint', async (req, res) => {
  try {
    const { creatorWallet, name, uri } = req.body;
    if (!creatorWallet || !uri) {
      return res.status(400).json({ error: 'creatorWallet and uri are required' });
    }

    const result = await mintArt(creatorWallet, name, uri);
    res.json({
      success: true,
      transaction: result.transaction,
      assetAddress: result.assetAddress,
      message: 'Sign this transaction to mint your art NFT',
    });
  } catch (error: any) {
    console.error('[AUCTION] Mint failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auction/mint/confirm
 * Confirm a mint after user signed and submitted the tx.
 * Body: { assetAddress, signature }
 */
router.post('/auction/mint/confirm', async (req, res) => {
  try {
    const { assetAddress, signature } = req.body;
    if (!assetAddress || !signature) {
      return res.status(400).json({ error: 'assetAddress and signature are required' });
    }

    const result = await confirmMint(assetAddress, signature);
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
 */
router.post('/auction/join', async (req, res) => {
  try {
    const { creatorWallet, mintAddress } = req.body;
    if (!creatorWallet || !mintAddress) {
      return res.status(400).json({ error: 'creatorWallet and mintAddress are required' });
    }

    const result = await joinVoting(creatorWallet, mintAddress);
    res.json({
      success: true,
      transaction: result.transaction,
      message: 'Sign this transaction to join the voting leaderboard',
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

    const result = await voteFree(voterWallet, candidateMint);
    res.json({
      success: true,
      totalVotes: result.totalVotes,
      message: 'Free vote recorded!',
    });
  } catch (error: any) {
    console.error('[AUCTION] Vote failed:', error.message);
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
    res.json({ success: true, config: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
