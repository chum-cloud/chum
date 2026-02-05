import { Router } from 'express';
import { generateVillainImage } from '../services/gemini';
import { uploadVillainToIPFS } from '../services/ipfs';
import {
  insertVillain,
  getVillainByWallet,
  getAllVillains,
  updateVillainMintSignature,
} from '../services/supabase';

const router = Router();

/**
 * POST /api/generate-villain
 * Generate a Fellow Villain NFT for a donor
 * Body: { walletAddress: string, donationAmount: number }
 */
router.post('/generate-villain', async (req, res) => {
  try {
    const { walletAddress, donationAmount } = req.body;

    if (!walletAddress || !donationAmount) {
      return res.status(400).json({
        error: 'walletAddress and donationAmount are required',
      });
    }

    if (donationAmount < 0.05) {
      return res.status(400).json({
        error: 'Minimum donation of 0.05 SOL required for Fellow Villain NFT',
      });
    }

    // Check if wallet already has a villain
    const existing = await getVillainByWallet(walletAddress);
    if (existing) {
      return res.json({
        success: true,
        villain: existing,
        message: 'Villain already exists for this wallet',
      });
    }

    console.log(`[VILLAIN] Generating for ${walletAddress} (${donationAmount} SOL)`);

    // Generate image via Gemini
    const { imageBuffer, traits } = await generateVillainImage();

    // Upload to IPFS
    const { imageUrl, metadataUrl } = await uploadVillainToIPFS(
      imageBuffer,
      traits,
      walletAddress
    );

    // Save to database
    const villain = await insertVillain(
      walletAddress,
      imageUrl,
      metadataUrl,
      traits,
      donationAmount
    );

    console.log(`[VILLAIN] Created villain #${villain.id} for ${walletAddress}`);

    res.json({
      success: true,
      villain,
      message: 'Fellow Villain generated successfully! You can now mint your NFT.',
    });
  } catch (error: any) {
    console.error('[VILLAIN] Generation failed:', error);
    res.status(500).json({
      error: 'Failed to generate villain',
      details: error.message,
    });
  }
});

/**
 * GET /api/villains
 * Get all Fellow Villains for the gallery
 * Query: ?limit=50
 */
router.get('/villains', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const villains = await getAllVillains(limit);

    res.json({
      success: true,
      villains,
      count: villains.length,
    });
  } catch (error: any) {
    console.error('[VILLAIN] Failed to fetch villains:', error);
    res.status(500).json({
      error: 'Failed to fetch villains',
      details: error.message,
    });
  }
});

/**
 * GET /api/villain/:wallet
 * Get a specific villain by wallet address
 */
router.get('/villain/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const villain = await getVillainByWallet(wallet);

    if (!villain) {
      return res.status(404).json({
        error: 'Villain not found for this wallet',
      });
    }

    res.json({
      success: true,
      villain,
    });
  } catch (error: any) {
    console.error('[VILLAIN] Failed to fetch villain:', error);
    res.status(500).json({
      error: 'Failed to fetch villain',
      details: error.message,
    });
  }
});

/**
 * POST /api/villain/:wallet/mint
 * Update mint signature after user mints the NFT
 * Body: { mintSignature: string }
 */
router.post('/villain/:wallet/mint', async (req, res) => {
  try {
    const { wallet } = req.params;
    const { mintSignature } = req.body;

    if (!mintSignature) {
      return res.status(400).json({
        error: 'mintSignature is required',
      });
    }

    await updateVillainMintSignature(wallet, mintSignature);

    res.json({
      success: true,
      message: 'Mint signature recorded',
    });
  } catch (error: any) {
    console.error('[VILLAIN] Failed to update mint signature:', error);
    res.status(500).json({
      error: 'Failed to update mint signature',
      details: error.message,
    });
  }
});

export default router;
