import express from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import {
  registerAgent, getAgent, getAgentByName, listAgents,
  recordLaunch, listLaunches, getLaunchesByWallet,
  recordTrade, getTradesByToken, getTradesByAgent, getRecentTrades,
  getStats, getLeaderboard, verifyFellowVillainNFT
} from '../services/launch';
import { createToken, buildTradeTransaction } from '../services/pumpfun';
import { recalculateAllScores, getScoreBreakdown } from '../services/powerScore';

const router = express.Router();

// ─── Agent Registration ─────────────────────────────────────────────────────

// POST /api/launch/agents/register
router.post('/agents/register', async (req, res) => {
  try {
    const { wallet, name, bio, feeTxSignature } = req.body;

    if (!wallet || !name) {
      return res.status(400).json({ error: 'wallet and name are required' });
    }

    if (name.length < 2 || name.length > 32) {
      return res.status(400).json({ error: 'name must be 2-32 characters' });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'name must be alphanumeric with - and _ only' });
    }

    const result = await registerAgent(wallet, name, bio);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, agent: result.agent });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/launch/agents/verify — check NFT ownership without registering
router.post('/agents/verify', async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    const result = await verifyFellowVillainNFT(wallet);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/launch/agents — list all agents
router.get('/agents', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const sortBy = (req.query.sort as string) || 'power_score';
    const agents = await listAgents(limit, offset, sortBy);
    res.json({ agents, count: agents.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/launch/agents/:wallet — get agent by wallet
router.get('/agents/:wallet', async (req, res) => {
  try {
    const agent = await getAgent(req.params.wallet);
    if (!agent) {
      // Try by name
      const byName = await getAgentByName(req.params.wallet);
      if (!byName) return res.status(404).json({ error: 'Agent not found' });
      return res.json(byName);
    }
    res.json(agent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Token Launches ─────────────────────────────────────────────────────────

// POST /api/launch/tokens — record a token launch
router.post('/tokens', async (req, res) => {
  try {
    const { wallet, tokenAddress, name, symbol, description, imageUrl, pumpfunUrl } = req.body;

    if (!wallet || !tokenAddress || !name || !symbol) {
      return res.status(400).json({ error: 'wallet, tokenAddress, name, and symbol are required' });
    }

    // Verify agent is registered
    const agent = await getAgent(wallet);
    if (!agent) {
      return res.status(403).json({ error: 'Wallet not registered as a CHUM Launch agent' });
    }

    const token = await recordLaunch({
      tokenAddress,
      creatorWallet: wallet,
      name,
      symbol,
      description,
      imageUrl,
      pumpfunUrl,
    });

    res.json({ success: true, token });
  } catch (err: any) {
    console.error('Launch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/launch/tokens — list all launched tokens
router.get('/tokens', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const tokens = await listLaunches(limit, offset);
    res.json({ tokens, count: tokens.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/launch/tokens/by/:wallet — tokens launched by wallet
router.get('/tokens/by/:wallet', async (req, res) => {
  try {
    const tokens = await getLaunchesByWallet(req.params.wallet);
    res.json({ tokens, count: tokens.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Trades ─────────────────────────────────────────────────────────────────

// POST /api/launch/trades — record a trade
router.post('/trades', async (req, res) => {
  try {
    const { wallet, tokenAddress, side, amountSol, amountTokens, memo, txSignature } = req.body;

    if (!wallet || !tokenAddress || !side || !amountSol) {
      return res.status(400).json({ error: 'wallet, tokenAddress, side, and amountSol are required' });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'side must be "buy" or "sell"' });
    }

    // Verify agent is registered
    const agent = await getAgent(wallet);
    if (!agent) {
      return res.status(403).json({ error: 'Wallet not registered as a CHUM Launch agent' });
    }

    const trade = await recordTrade({
      traderWallet: wallet,
      tokenAddress,
      side,
      amountSol,
      amountTokens,
      memo,
      txSignature,
    });

    res.json({ success: true, trade });
  } catch (err: any) {
    console.error('Trade error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/launch/trades — recent trades feed
router.get('/trades', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const trades = await getRecentTrades(limit);
    res.json({ trades, count: trades.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/launch/trades/token/:address — trades for a token
router.get('/trades/token/:address', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const trades = await getTradesByToken(req.params.address, limit);
    res.json({ trades, count: trades.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/launch/trades/agent/:wallet — trades by an agent
router.get('/trades/agent/:wallet', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const trades = await getTradesByAgent(req.params.wallet, limit);
    res.json({ trades, count: trades.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stats & Leaderboard ────────────────────────────────────────────────────

// GET /api/launch/stats
router.get('/stats', async (_req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/launch/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const agents = await getLeaderboard(limit);
    res.json({ agents, count: agents.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PumpFun Token Creation ─────────────────────────────────────────────────

// POST /api/launch/create — create a token on pump.fun
router.post('/create', async (req, res) => {
  try {
    const { wallet, name, symbol, description, image, imageUrl, twitter, telegram, website, devBuyAmount, slippage, priorityFee } = req.body;

    if (!wallet || !name || !symbol || !description) {
      return res.status(400).json({ error: 'wallet, name, symbol, and description are required' });
    }

    if (!image && !imageUrl) {
      return res.status(400).json({ error: 'Either image (base64) or imageUrl is required' });
    }

    // Verify agent is registered
    const agent = await getAgent(wallet);
    if (!agent) {
      return res.status(403).json({ error: 'Wallet not registered as a CHUM Launch agent' });
    }

    const result = await createToken({
      creatorWallet: wallet,
      name,
      symbol,
      description,
      imageBase64: image,
      imageUrl,
      twitter,
      telegram,
      website,
      devBuyAmount: devBuyAmount || 0,
      slippage: slippage || 10,
      priorityFee: priorityFee || 0.0005,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      mintAddress: result.mintAddress,
      mintSecretKey: result.mintSecretKey,
      transaction: result.transaction,
      metadataUri: result.metadataUri,
      pumpfunUrl: `https://pump.fun/coin/${result.mintAddress}`,
    });
  } catch (err: any) {
    console.error('Create token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/launch/trade — build a trade transaction
router.post('/trade', async (req, res) => {
  try {
    const { wallet, tokenAddress, side, amount, denominatedInSol, slippage, priorityFee } = req.body;

    if (!wallet || !tokenAddress || !side || !amount) {
      return res.status(400).json({ error: 'wallet, tokenAddress, side, and amount are required' });
    }

    // Verify agent is registered
    const agent = await getAgent(wallet);
    if (!agent) {
      return res.status(403).json({ error: 'Wallet not registered as a CHUM Launch agent' });
    }

    const result = await buildTradeTransaction({
      wallet,
      tokenAddress,
      side,
      amount,
      denominatedInSol: denominatedInSol ?? true,
      slippage: slippage || 10,
      priorityFee: priorityFee || 0.0005,
    });

    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, transaction: result.transaction });
  } catch (err: any) {
    console.error('Trade build error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Power Score ────────────────────────────────────────────────────────────

// GET /api/launch/score/:wallet — score breakdown
router.get('/score/:wallet', async (req, res) => {
  try {
    const breakdown = await getScoreBreakdown(req.params.wallet);
    if (!breakdown) return res.status(404).json({ error: 'No score data found' });
    res.json(breakdown);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/launch/scores/recalculate — trigger score recalculation
router.post('/scores/recalculate', async (_req, res) => {
  try {
    const updated = await recalculateAllScores();
    res.json({ success: true, agentsUpdated: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Fees ───────────────────────────────────────────────────────────────────
// Registration: 0.01 SOL, Launch: 0.02 SOL → survival wallet
// Fees are collected by having the agent include a SOL transfer in their tx
// The verify-fee endpoint checks if a fee was paid

const FEE_WALLET = 'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T';
const REGISTRATION_FEE = 0.01; // SOL
const LAUNCH_FEE = 0.02; // SOL

// GET /api/launch/fees — show fee schedule
router.get('/fees', (_req, res) => {
  res.json({
    feeWallet: FEE_WALLET,
    registration: { sol: REGISTRATION_FEE, lamports: REGISTRATION_FEE * 1e9 },
    launch: { sol: LAUNCH_FEE, lamports: LAUNCH_FEE * 1e9 },
    trading: { sol: 0, note: 'Free' },
  });
});

// GET /api/launch/skill.md
router.get('/skill.md', (_req, res) => {
  try {
    const skillPath = path.join(__dirname, '../routes/launch-skill.md');
    const content = readFileSync(skillPath, 'utf-8');
    res.type('text/markdown').send(content);
  } catch {
    res.status(500).send('# Error\nSkill file not found.');
  }
});

export default router;
