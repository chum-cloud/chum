import { Router } from 'express';
import { generateVillainImage } from '../services/gemini';
import { uploadVillainToStorage } from '../services/storage';
import {
  insertVillain,
  getVillainByWallet,
  insertTransaction,
  updateVillainMetadataUrl,
} from '../services/supabase';
import { config } from '../config';

const router = Router();

interface HeliusTransaction {
  signature: string;
  slot: number;
  timestamp: number;
  fee: number;
  feePayer: string;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
  accountData?: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges?: Array<{
      mint: string;
      rawTokenAmount: {
        tokenAmount: string;
        decimals: number;
      };
      userAccount: string;
    }>;
  }>;
}

interface HeliusWebhookPayload {
  accountData: Array<{
    account: string;
    nativeBalanceChange: number;
  }>;
  description: string;
  events: Record<string, any>;
  fee: number;
  feePayer: string;
  instructions: Array<{
    accounts: string[];
    data: string;
    programId: string;
    innerInstructions?: Array<{
      accounts: string[];
      data: string;
      programId: string;
    }>;
  }>;
  nativeTransfers: Array<{
    amount: number;
    fromUserAccount: string;
    toUserAccount: string;
  }>;
  signature: string;
  slot: number;
  source: string;
  timestamp: number;
  tokenTransfers: any[];
  transactionError: any;
  type: string;
}

/**
 * POST /api/webhook/helius
 * Helius webhook endpoint for detecting SOL transfers
 * Automatically generates Fellow Villain NFTs for donors
 */
router.post('/helius', async (req, res) => {
  try {
    console.log('[WEBHOOK] Received Helius webhook:', JSON.stringify(req.body, null, 2));

    // Validate webhook is for our wallet
    const payload = req.body as HeliusWebhookPayload[];
    
    if (!Array.isArray(payload) || payload.length === 0) {
      console.log('[WEBHOOK] Invalid payload structure');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    for (const transaction of payload) {
      try {
        await processTransaction(transaction);
      } catch (error) {
        console.error('[WEBHOOK] Failed to process transaction:', error);
        // Continue processing other transactions
      }
    }

    res.json({ success: true, processed: payload.length });
  } catch (error: any) {
    console.error('[WEBHOOK] Webhook processing failed:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      details: error.message,
    });
  }
});

async function processTransaction(transaction: HeliusWebhookPayload): Promise<void> {
  const { nativeTransfers, signature, timestamp } = transaction;

  console.log(`[WEBHOOK] Processing transaction ${signature}`);

  if (!nativeTransfers || nativeTransfers.length === 0) {
    console.log('[WEBHOOK] No native transfers found');
    return;
  }

  // Find transfers to our CHUM wallet
  const incomingTransfers = nativeTransfers.filter(
    transfer => transfer.toUserAccount === config.chumWalletAddress
  );

  if (incomingTransfers.length === 0) {
    console.log('[WEBHOOK] No transfers to CHUM wallet found');
    return;
  }

  for (const transfer of incomingTransfers) {
    const { fromUserAccount, amount } = transfer;
    const solAmount = amount / 1e9; // Convert lamports to SOL

    console.log(`[WEBHOOK] Found transfer: ${solAmount} SOL from ${fromUserAccount}`);

    // Check if donation meets minimum threshold
    if (solAmount < 0.05) {
      console.log(`[WEBHOOK] Transfer amount ${solAmount} SOL below minimum 0.05 SOL`);
      continue;
    }

    // Check if wallet already has a villain (idempotent)
    const existingVillain = await getVillainByWallet(fromUserAccount);
    if (existingVillain) {
      console.log(`[WEBHOOK] Villain already exists for wallet ${fromUserAccount}`);
      continue;
    }

    console.log(`[WEBHOOK] Generating villain for ${fromUserAccount} (${solAmount} SOL)`);

    try {
      // Generate villain image
      const { imageBuffer, traits, rarityScore } = await generateVillainImage();

      // Upload to storage
      const { imageUrl, metadataUrl } = await uploadVillainToStorage(
        imageBuffer,
        traits,
        fromUserAccount,
        rarityScore
      );

      // Save villain to database
      const villain = await insertVillain(
        fromUserAccount,
        imageUrl,
        metadataUrl,
        traits,
        solAmount,
        rarityScore
      );

      // Update metadata URL with actual villain ID
      const actualMetadataUrl = `${config.apiBaseUrl}/api/villain/${villain.id}/metadata`;
      await updateVillainMetadataUrl(villain.id, actualMetadataUrl);

      // Record the donation transaction
      await insertTransaction(
        'donation',
        solAmount,
        `Fellow Villain donation - Auto-generated villain #${villain.id}`,
        signature
      );

      console.log(`[WEBHOOK] Successfully created villain #${villain.id} for ${fromUserAccount}`);
    } catch (error) {
      console.error(`[WEBHOOK] Failed to generate villain for ${fromUserAccount}:`, error);
      
      // Still record the donation even if villain generation fails
      try {
        await insertTransaction(
          'donation',
          solAmount,
          `Donation received but villain generation failed`,
          signature
        );
      } catch (txError) {
        console.error('[WEBHOOK] Failed to record donation transaction:', txError);
      }
    }
  }
}

/**
 * GET /api/webhook/status
 * Webhook status endpoint for testing
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    chumWallet: config.chumWalletAddress,
  });
});

export default router;