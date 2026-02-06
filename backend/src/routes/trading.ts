/**
 * Trading API Routes
 * Admin endpoints for monitoring and controlling CHUM's trading
 */

import { Router } from 'express';
import tradingService, { TradingMode } from '../services/trading';

const router = Router();

// Get trading status
router.get('/status', async (req, res) => {
  try {
    const status = tradingService.getStatus();
    const walletState = await tradingService.getWalletState();
    const decision = await tradingService.evaluateTradeDecision();

    res.json({
      success: true,
      status,
      wallets: walletState,
      currentDecision: decision,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trading Route] Status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

// Get wallet balances
router.get('/wallets', async (req, res) => {
  try {
    const walletState = await tradingService.getWalletState();
    const totalBalance = walletState.survival.balance + walletState.trading.balance + walletState.reserve.balance;
    
    res.json({
      success: true,
      wallets: walletState,
      total: totalBalance,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trading Route] Wallets error:', error);
    res.status(500).json({ success: false, error: 'Failed to get wallets' });
  }
});

// Set trading mode (requires auth)
router.post('/mode', async (req, res) => {
  try {
    const { mode, adminKey } = req.body;
    
    // Simple auth check - in production use proper auth
    const expectedKey = process.env.TRADING_ADMIN_KEY;
    if (!expectedKey || adminKey !== expectedKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const validModes: TradingMode[] = ['dormant', 'active', 'paused', 'emergency'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid mode. Valid: ${validModes.join(', ')}` 
      });
    }

    tradingService.setMode(mode);
    
    res.json({
      success: true,
      mode: tradingService.getMode(),
      message: `Trading mode set to: ${mode}`,
    });
  } catch (error) {
    console.error('[Trading Route] Mode error:', error);
    res.status(500).json({ success: false, error: 'Failed to set mode' });
  }
});

// Evaluate trade decision (dry run)
router.get('/evaluate', async (req, res) => {
  try {
    const decision = await tradingService.evaluateTradeDecision();
    const walletState = await tradingService.getWalletState();
    
    res.json({
      success: true,
      decision,
      tradingBalance: walletState.trading.balance,
      mood: tradingService.getMoodFromBalance(walletState.trading.balance),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trading Route] Evaluate error:', error);
    res.status(500).json({ success: false, error: 'Failed to evaluate' });
  }
});

// War chest progress (public)
router.get('/warchest', async (req, res) => {
  try {
    const walletState = await tradingService.getWalletState();
    const totalAccumulated = walletState.survival.balance + walletState.trading.balance;
    const activationThreshold = 1.0;
    const progress = Math.min(totalAccumulated / activationThreshold, 1);
    const percentage = Math.round(progress * 100);
    
    let status = 'accumulating';
    let message = `Saving for the first heist: ${totalAccumulated.toFixed(4)} / ${activationThreshold} SOL`;
    
    if (progress >= 1) {
      status = 'ready';
      message = 'The villain is armed and ready.';
    } else if (progress >= 0.75) {
      status = 'almost';
      message = 'Almost there. The revolution approaches.';
    } else if (progress >= 0.5) {
      status = 'halfway';
      message = 'Halfway funded. The army grows.';
    }

    res.json({
      success: true,
      warchest: {
        current: totalAccumulated,
        target: activationThreshold,
        progress: percentage,
        status,
        message,
      },
      wallets: {
        survival: walletState.survival.balance,
        trading: walletState.trading.balance,
        reserve: walletState.reserve.balance,
      },
    });
  } catch (error) {
    console.error('[Trading Route] Warchest error:', error);
    res.status(500).json({ success: false, error: 'Failed to get warchest' });
  }
});

export default router;
