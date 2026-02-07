import { Router } from 'express';
import { generateVillainImage } from '../services/gemini';
import { uploadVillainToStorage, generateMetadata } from '../services/storage';
import {
  insertVillain,
  getVillainByWallet,
  getVillainById,
  getAllVillains,
  updateVillainMetadataUrl,
  updateVillainMintSignature,
} from '../services/supabase';
import { config } from '../config';

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

    // Generate image via Imagen 4.0
    const { imageBuffer, traits, rarityScore } = await generateVillainImage();

    // Upload to Supabase Storage
    const { imageUrl, metadataUrl } = await uploadVillainToStorage(
      imageBuffer,
      traits,
      walletAddress,
      rarityScore
    );

    // Save to database
    const villain = await insertVillain(
      walletAddress,
      imageUrl,
      metadataUrl,
      traits,
      donationAmount,
      rarityScore
    );

    // Update metadata URL with actual villain ID
    const actualMetadataUrl = `${config.apiBaseUrl}/api/villain/${villain.id}/metadata`;
    await updateVillainMetadataUrl(villain.id, actualMetadataUrl);
    villain.metadata_url = actualMetadataUrl;

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
 * GET /api/villain/:id/metadata
 * Get NFT-standard metadata for a villain by ID
 */
router.get('/villain/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params;
    const villainId = parseInt(id);

    if (isNaN(villainId)) {
      return res.status(400).json({
        error: 'Invalid villain ID',
      });
    }

    const villain = await getVillainById(villainId);

    if (!villain) {
      return res.status(404).json({
        error: 'Villain not found',
      });
    }

    const metadata = generateMetadata(
      villain.id,
      villain.traits,
      villain.wallet_address,
      villain.image_url,
      villain.rarity_score
    );

    res.json(metadata);
  } catch (error: any) {
    console.error('[VILLAIN] Failed to fetch metadata:', error);
    res.status(500).json({
      error: 'Failed to fetch metadata',
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
