import cron from 'node-cron';
import { getWalletBalance, getRecentTransactions } from '../services/solana';
import {
  getChumState,
  updateChumState,
  insertTransaction,
  getVillainByWallet,
  getRecentExpenses,
} from '../services/supabase';
import { generateVillainImage } from '../services/gemini';
import { uploadVillainToIPFS } from '../services/ipfs';
import { insertVillain } from '../services/supabase';
import { trackCost } from '../services/costs';
import { getSolPrice, usdToSol } from '../services/price';
import { BASE_DAILY_COST_USD, DEFAULT_DAILY_OPS_USD } from '../config/costs';
import { eventBus } from '../services/events';
import type { Mood } from '../types';

// Track processed signatures to avoid duplicates
const processedSignatures = new Set<string>();

function moodFromHealth(health: number): Mood {
  if (health > 80) return 'ecstatic';
  if (health > 60) return 'content';
  if (health > 40) return 'hopeful';
  if (health > 20) return 'anxious';
  if (health > 10) return 'desperate';
  return 'devastated';
}

async function checkBalance(): Promise<void> {
  try {
    const balance = await getWalletBalance();
    await trackCost('HELIUS_BALANCE_CHECK');

    const state = await getChumState();
    const prevBalance = Number(state.balance);

    const solPrice = await getSolPrice();
    const last7dExpenses = await getRecentExpenses(7);
    const baseDailySol = usdToSol(BASE_DAILY_COST_USD, solPrice);
    const opsDailyBurn = last7dExpenses > 0
      ? last7dExpenses / 7
      : usdToSol(DEFAULT_DAILY_OPS_USD, solPrice);
    const estimatedDailyBurn = baseDailySol + opsDailyBurn;

    const healthPercent = Math.min(
      100,
      estimatedDailyBurn > 0 ? (balance / (estimatedDailyBurn * 30)) * 100 : 100
    );
    const mood = moodFromHealth(healthPercent);

    // Detect donation (balance increase > 0.01 SOL)
    const increase = balance - prevBalance;
    if (increase > 0.01) {
      await insertTransaction(
        'donation',
        increase,
        `Detected +${increase.toFixed(4)} SOL`
      );
      console.log(`[BALANCE] Donation detected: +${increase.toFixed(4)} SOL`);

      // Find sender from recent transactions
      let sender = 'unknown';
      try {
        const recentTxs = await getRecentTransactions(5);
        const matchingTx = recentTxs.find((tx) => Math.abs(tx.amount - increase) < 0.001);
        if (matchingTx) sender = matchingTx.sender;
      } catch {
        // use default sender
      }

      // Emit event — eventThoughts handles thought generation + tweeting
      eventBus.emitEvent({
        type: 'DONATION',
        timestamp: Date.now(),
        amount: increase,
        sender,
      });
    }

    // Check for Fellow Villain qualifying donations (>= 0.05 SOL)
    try {
      const recentTxs = await getRecentTransactions(5);
      await trackCost('HELIUS_TX_QUERY');

      for (const tx of recentTxs) {
        // Skip if already processed
        if (processedSignatures.has(tx.signature)) continue;

        // Mark as processed
        processedSignatures.add(tx.signature);

        // Check if qualifies for Fellow Villain (>= 0.05 SOL)
        if (tx.amount >= 0.05) {
          console.log(`[VILLAIN] Qualifying donation detected: ${tx.amount} SOL from ${tx.sender}`);

          // Check if this wallet already has a villain
          const existingVillain = await getVillainByWallet(tx.sender);
          if (existingVillain) {
            console.log(`[VILLAIN] Wallet ${tx.sender} already has a villain`);
            continue;
          }

          // Generate villain asynchronously (don't block balance check)
          generateVillainForDonor(tx.sender, tx.amount).catch((err) => {
            console.error(`[VILLAIN] Failed to generate for ${tx.sender}:`, err);
          });
        }
      }

      // Clean up old signatures (keep last 100)
      if (processedSignatures.size > 100) {
        const sigArray = Array.from(processedSignatures);
        processedSignatures.clear();
        sigArray.slice(-50).forEach((sig) => processedSignatures.add(sig));
      }
    } catch (err) {
      console.error('[VILLAIN] Failed to check for qualifying donations:', err);
    }

    // Only update columns that exist in the DB
    await updateChumState({
      balance,
      mood,
    });

    console.log(
      `[BALANCE] ${balance.toFixed(4)} SOL | ${healthPercent.toFixed(1)}% health | ${mood}`
    );
  } catch (err) {
    console.error('[BALANCE] Check failed:', err);
  }
}

async function generateVillainForDonor(walletAddress: string, amount: number): Promise<void> {
  try {
    console.log(`[VILLAIN] Generating for ${walletAddress}...`);

    // Generate image
    const { imageBuffer, traits } = await generateVillainImage();
    await trackCost('GEMINI_IMAGE');

    // Upload to IPFS
    const { imageUrl, metadataUrl } = await uploadVillainToIPFS(
      imageBuffer,
      traits,
      walletAddress
    );
    await trackCost('IPFS_UPLOAD');

    // Save to database
    const villain = await insertVillain(walletAddress, imageUrl, metadataUrl, traits, amount);

    console.log(`[VILLAIN] Created villain #${villain.id} for ${walletAddress}`);

    // Emit event — eventThoughts handles thought generation + tweeting
    eventBus.emitEvent({
      type: 'VILLAIN_CREATED',
      timestamp: Date.now(),
      walletAddress,
      donationAmount: amount,
      villainId: villain.id,
      imageUrl,
    });
  } catch (error) {
    console.error(`[VILLAIN] Generation failed for ${walletAddress}:`, error);
    throw error;
  }
}

export function startBalanceCheck(): void {
  // Every 5 minutes
  cron.schedule('*/5 * * * *', checkBalance);
  console.log('[CRON] Balance check started (every 5 min)');
  // Run once immediately
  checkBalance();
}
