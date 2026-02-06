/**
 * CHUM Trading Service
 * Survival-first trading logic for the plankton villain
 */

import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Thresholds in SOL
export const THRESHOLDS = {
  ACTIVATION: 1.0,        // Min to start trading
  THRIVING: 0.5,          // Do nothing
  COMFORTABLE: 0.3,       // Watch
  WORRIED: 0.15,          // Small trades
  DESPERATE: 0.05,        // Aggressive
  DEAD: 0,                // Game over
};

// Trading rules
export const RULES = {
  MAX_TRADE_PERCENT: 0.10,    // 10% of trading wallet per trade
  MIN_TRADE_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  MAX_TRADES_PER_DAY: 5,
  SLIPPAGE_BPS: 100,          // 1%
  RESERVE_PERCENT: 0.20,      // 20% goes to reserve on activation
};

export type TradingMode = 'dormant' | 'active' | 'paused' | 'emergency';
export type MoodLevel = 'thriving' | 'comfortable' | 'worried' | 'desperate' | 'dying';

interface WalletState {
  survival: { address: string; balance: number };
  trading: { address: string; balance: number };
  reserve: { address: string; balance: number };
}

interface TradeDecision {
  shouldTrade: boolean;
  action?: 'buy' | 'sell';
  reason?: string;
  amount?: number;
  urgency: MoodLevel;
}

class TradingService {
  private connection: Connection;
  private tradingKeypair: Keypair | null = null;
  private reserveKeypair: Keypair | null = null;
  private mode: TradingMode = 'dormant';
  private lastTradeTime: number = 0;
  private tradesToday: number = 0;
  private lastTradeDayReset: string = '';

  constructor() {
    const rpcUrl = process.env.HELIUS_RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.loadKeypairs();
  }

  private loadKeypairs(): void {
    try {
      // Try env vars first (Railway), then files (local dev)
      
      // Load trading wallet
      if (process.env.TRADING_WALLET_SECRET) {
        const secretKey = JSON.parse(process.env.TRADING_WALLET_SECRET);
        this.tradingKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        console.log('[Trading] Loaded trading wallet from env:', this.tradingKeypair.publicKey.toBase58());
      } else {
        const tradingPath = path.join(__dirname, '../../secrets/trading-wallet.json');
        if (fs.existsSync(tradingPath)) {
          const tradingData = JSON.parse(fs.readFileSync(tradingPath, 'utf-8'));
          this.tradingKeypair = Keypair.fromSecretKey(Uint8Array.from(tradingData.secretKey));
          console.log('[Trading] Loaded trading wallet from file:', this.tradingKeypair.publicKey.toBase58());
        }
      }

      // Load reserve wallet
      if (process.env.RESERVE_WALLET_SECRET) {
        const secretKey = JSON.parse(process.env.RESERVE_WALLET_SECRET);
        this.reserveKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        console.log('[Trading] Loaded reserve wallet from env:', this.reserveKeypair.publicKey.toBase58());
      } else {
        const reservePath = path.join(__dirname, '../../secrets/reserve-wallet.json');
        if (fs.existsSync(reservePath)) {
          const reserveData = JSON.parse(fs.readFileSync(reservePath, 'utf-8'));
          this.reserveKeypair = Keypair.fromSecretKey(Uint8Array.from(reserveData.secretKey));
          console.log('[Trading] Loaded reserve wallet from file:', this.reserveKeypair.publicKey.toBase58());
        }
      }
    } catch (error) {
      console.error('[Trading] Failed to load keypairs:', error);
    }
  }

  async getWalletState(): Promise<WalletState> {
    const survivalAddress = 'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T';
    const tradingAddress = this.tradingKeypair?.publicKey.toBase58() || '';
    const reserveAddress = this.reserveKeypair?.publicKey.toBase58() || '';

    const [survivalBalance, tradingBalance, reserveBalance] = await Promise.all([
      this.getBalance(survivalAddress),
      tradingAddress ? this.getBalance(tradingAddress) : 0,
      reserveAddress ? this.getBalance(reserveAddress) : 0,
    ]);

    return {
      survival: { address: survivalAddress, balance: survivalBalance },
      trading: { address: tradingAddress, balance: tradingBalance },
      reserve: { address: reserveAddress, balance: reserveBalance },
    };
  }

  private async getBalance(address: string): Promise<number> {
    try {
      const pubkey = new PublicKey(address);
      const balance = await this.connection.getBalance(pubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error(`[Trading] Failed to get balance for ${address}:`, error);
      return 0;
    }
  }

  getMoodFromBalance(balance: number): MoodLevel {
    if (balance >= THRESHOLDS.THRIVING) return 'thriving';
    if (balance >= THRESHOLDS.COMFORTABLE) return 'comfortable';
    if (balance >= THRESHOLDS.WORRIED) return 'worried';
    if (balance >= THRESHOLDS.DESPERATE) return 'desperate';
    return 'dying';
  }

  async evaluateTradeDecision(): Promise<TradeDecision> {
    const state = await this.getWalletState();
    const totalBalance = state.survival.balance + state.trading.balance;
    const tradingBalance = state.trading.balance;
    const mood = this.getMoodFromBalance(tradingBalance);

    // Check if trading is active
    if (this.mode === 'dormant') {
      if (totalBalance >= THRESHOLDS.ACTIVATION) {
        return {
          shouldTrade: false,
          reason: 'Activation threshold reached! Ready to activate trading.',
          urgency: mood,
        };
      }
      return {
        shouldTrade: false,
        reason: `Accumulating: ${totalBalance.toFixed(4)} / ${THRESHOLDS.ACTIVATION} SOL`,
        urgency: mood,
      };
    }

    if (this.mode === 'paused') {
      return {
        shouldTrade: false,
        reason: 'Trading paused by admin',
        urgency: mood,
      };
    }

    // Reset daily trade counter
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.lastTradeDayReset) {
      this.tradesToday = 0;
      this.lastTradeDayReset = today;
    }

    // Check trade limits
    if (this.tradesToday >= RULES.MAX_TRADES_PER_DAY) {
      return {
        shouldTrade: false,
        reason: 'Daily trade limit reached',
        urgency: mood,
      };
    }

    const timeSinceLastTrade = Date.now() - this.lastTradeTime;
    if (timeSinceLastTrade < RULES.MIN_TRADE_INTERVAL_MS) {
      const waitMinutes = Math.ceil((RULES.MIN_TRADE_INTERVAL_MS - timeSinceLastTrade) / 60000);
      return {
        shouldTrade: false,
        reason: `Cooldown: ${waitMinutes} minutes remaining`,
        urgency: mood,
      };
    }

    // Trading logic based on mood
    if (mood === 'thriving') {
      return {
        shouldTrade: false,
        reason: 'Thriving - no action needed',
        urgency: mood,
      };
    }

    if (mood === 'comfortable') {
      return {
        shouldTrade: false,
        reason: 'Comfortable - monitoring',
        urgency: mood,
      };
    }

    if (mood === 'worried') {
      // Small defensive trades
      const tradeAmount = tradingBalance * RULES.MAX_TRADE_PERCENT * 0.5; // Half size
      return {
        shouldTrade: true,
        action: 'sell',
        reason: 'Worried - small defensive sell',
        amount: tradeAmount,
        urgency: mood,
      };
    }

    if (mood === 'desperate' || mood === 'dying') {
      // Aggressive survival trades
      const tradeAmount = tradingBalance * RULES.MAX_TRADE_PERCENT;
      return {
        shouldTrade: true,
        action: 'sell',
        reason: mood === 'dying' ? 'EMERGENCY - survival sell' : 'Desperate - aggressive sell',
        amount: tradeAmount,
        urgency: mood,
      };
    }

    return {
      shouldTrade: false,
      reason: 'No action',
      urgency: mood,
    };
  }

  // Mode controls
  setMode(mode: TradingMode): void {
    console.log(`[Trading] Mode changed: ${this.mode} -> ${mode}`);
    this.mode = mode;
  }

  getMode(): TradingMode {
    return this.mode;
  }

  getStatus(): object {
    return {
      mode: this.mode,
      tradingWallet: this.tradingKeypair?.publicKey.toBase58() || 'not loaded',
      reserveWallet: this.reserveKeypair?.publicKey.toBase58() || 'not loaded',
      lastTradeTime: this.lastTradeTime,
      tradesToday: this.tradesToday,
      thresholds: THRESHOLDS,
      rules: RULES,
    };
  }
}

// Singleton instance
export const tradingService = new TradingService();
export default tradingService;
