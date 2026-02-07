import { Router } from 'express';
import { generateVillainImage, calculateRarityScore } from '../services/gemini';
import { uploadVillainToStorage, generateMetadata } from '../services/storage';
import {
  insertVillain,
  getVillainByWallet,
  getAllVillains,
  updateVillainMintSignature,
  getVillainById,
} from '../services/supabase';
import { buildMintTransaction, getCollectionMetadata, createVillainCollection } from '../services/nft';

const router = Router();

/**
 * POST /api/villain/generate
 * Step 1: Generate villain art + traits, store in DB
 * Body: { walletAddress: string }
 */
router.post('/villain/generate', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
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

    console.log(`[VILLAIN] Generating for ${walletAddress}`);

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
      0.05,
      rarityScore
    );

    // Update metadata URL with actual villain ID
    const actualMetadataUrl = metadataUrl.replace('PLACEHOLDER', villain.id.toString());

    console.log(`[VILLAIN] Created villain #${villain.id} for ${walletAddress}`);

    res.json({
      success: true,
      villain: { ...villain, metadata_url: actualMetadataUrl },
      message: 'Fellow Villain generated! Ready to mint.',
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
 * POST /api/villain/:id/mint-tx
 * Step 2: Build mint transaction for user to sign
 * Body: { walletAddress: string }
 */
router.post('/villain/:id/mint-tx', async (req, res) => {
  try {
    const villainId = parseInt(req.params.id);
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    const villain = await getVillainById(villainId);
    if (!villain) {
      return res.status(404).json({ error: 'Villain not found' });
    }

    if (villain.wallet_address !== walletAddress) {
      return res.status(403).json({ error: 'This villain belongs to a different wallet' });
    }

    if (villain.is_minted) {
      return res.status(400).json({ error: 'Already minted' });
    }

    // Build the mint transaction
    const { transaction, assetAddress } = await buildMintTransaction(
      walletAddress,
      villainId,
      villain.image_url,
      villain.traits,
      villain.rarity_score || 0
    );

    res.json({
      success: true,
      transaction,
      assetAddress,
      message: 'Sign this transaction to mint your Fellow Villain NFT',
    });
  } catch (error: any) {
    console.error('[VILLAIN] Mint tx failed:', error);
    res.status(500).json({
      error: 'Failed to build mint transaction',
      details: error.message,
    });
  }
});

/**
 * POST /api/villain/:id/confirm-mint
 * Step 3: Confirm mint after user signs
 * Body: { mintSignature: string, assetAddress: string }
 */
router.post('/villain/:id/confirm-mint', async (req, res) => {
  try {
    const villainId = parseInt(req.params.id);
    const { mintSignature, assetAddress } = req.body;

    if (!mintSignature) {
      return res.status(400).json({ error: 'mintSignature is required' });
    }

    await updateVillainMintSignature(
      (await getVillainById(villainId))!.wallet_address,
      mintSignature
    );

    res.json({
      success: true,
      message: 'Villain minted successfully! Welcome to the army, soldier.',
      assetAddress,
    });
  } catch (error: any) {
    console.error('[VILLAIN] Confirm mint failed:', error);
    res.status(500).json({
      error: 'Failed to confirm mint',
      details: error.message,
    });
  }
});

/**
 * GET /api/villains
 * Get all Fellow Villains for the gallery
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
    res.status(500).json({ error: 'Failed to fetch villains' });
  }
});

/**
 * GET /api/villains/collection-metadata
 * Collection metadata for Metaplex Core
 */
router.get('/villains/collection-metadata', (_req, res) => {
  res.json(getCollectionMetadata());
});

/**
 * GET /api/villain/:id
 * Get a specific villain by ID
 */
router.get('/villain/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const villain = await getVillainById(id);

    if (!villain) {
      return res.status(404).json({ error: 'Villain not found' });
    }

    res.json({ success: true, villain });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch villain' });
  }
});

/**
 * GET /api/villain/:id/metadata
 * NFT-standard metadata for wallets/marketplaces
 */
router.get('/villain/:id/metadata', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const villain = await getVillainById(id);

    if (!villain) {
      return res.status(404).json({ error: 'Villain not found' });
    }

    const metadata = generateMetadata(
      villain.id,
      villain.traits,
      villain.wallet_address,
      villain.image_url,
      villain.rarity_score || 0
    );

    res.json(metadata);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate metadata' });
  }
});

/**
 * GET /api/villain/wallet/:wallet
 * Get villain by wallet address
 */
router.get('/villain/wallet/:wallet', async (req, res) => {
  try {
    const villain = await getVillainByWallet(req.params.wallet);
    if (!villain) {
      return res.status(404).json({ error: 'Villain not found for this wallet' });
    }
    res.json({ success: true, villain });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch villain' });
  }
});

/**
 * POST /api/villains/create-collection
 * Admin: Create the Metaplex Core collection (one-time)
 */
router.post('/villains/create-collection', async (req, res) => {
  try {
    const { adminKey } = req.body;
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const collectionAddress = await createVillainCollection();
    res.json({
      success: true,
      collectionAddress,
      message: 'Collection created! Set VILLAIN_COLLECTION_ADDRESS in env.',
    });
  } catch (error: any) {
    console.error('[VILLAIN] Collection creation failed:', error);
    res.status(500).json({ error: 'Failed to create collection', details: error.message });
  }
});

export default router;
