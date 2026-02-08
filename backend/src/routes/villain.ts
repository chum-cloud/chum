import { Router } from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { generateVillainImage, calculateRarityScore } from '../services/gemini';
import { uploadVillainToStorage, generateMetadata } from '../services/storage';
import {
  insertVillain,
  claimPoolVillain,
  getPoolCount,
  getVillainByWallet,
  getAllVillains,
  updateVillainMintSignature,
  updateVillainWallet,
  returnVillainToPool,
  getMintedCount,
  getMintedCountByWallet,
  getVillainById,
} from '../services/supabase';
import { buildMintTransaction, getCollectionMetadata, createVillainCollection } from '../services/nft';
import { createChallenge, verifyChallenge } from '../services/challenge';
// old count functions replaced by getMintedCount/getMintedCountByWallet

const MAX_SUPPLY = 2222;
const MAX_PER_WALLET = 10;
const router = Router();

// ─── Agent Mint Flow (Claws-style) ───

/**
 * GET /api/villain/skill.md
 * Skill file for agent onboarding
 */
router.get('/villain/skill.md', (_req, res) => {
  try {
    const skillPath = path.join(__dirname, '../../villain-skill.md');
    const content = readFileSync(skillPath, 'utf-8');
    res.type('text/markdown').send(content);
  } catch {
    res.status(500).send('# Error\nSkill file not found.');
  }
});

/**
 * POST /api/villain/challenge
 * Step 1: Get a challenge to prove you're an agent
 */
router.post('/villain/challenge', (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.length < 32) {
      return res.status(400).json({ error: 'Valid walletAddress is required' });
    }

    const challenge = createChallenge(walletAddress);
    res.json(challenge);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

/**
 * POST /api/villain/agent-mint
 * Step 2: Solve challenge → generate villain → get partially signed tx
 */
router.post('/villain/agent-mint', async (req, res) => {
  try {
    const { walletAddress, challengeId, answer } = req.body;

    if (!walletAddress || !challengeId || !answer) {
      return res.status(400).json({ error: 'walletAddress, challengeId, and answer are required' });
    }

    // Verify challenge
    const verification = verifyChallenge(walletAddress, challengeId, answer);
    if (!verification.valid) {
      return res.status(401).json({ error: verification.error || 'Challenge failed' });
    }

    // Check supply cap (only count actually minted)
    const currentCount = await getMintedCount();
    if (currentCount >= MAX_SUPPLY) {
      return res.status(400).json({ error: `Supply cap reached (${MAX_SUPPLY}/${MAX_SUPPLY}). No more villains can be minted.` });
    }

    // Check wallet limit (10 per wallet, only count minted)
    const walletCount = await getMintedCountByWallet(walletAddress);
    if (walletCount >= MAX_PER_WALLET) {
      return res.status(400).json({ error: `Wallet limit reached (${MAX_PER_WALLET} per wallet)` });
    }

    let villain: any = null;

    // Try to claim from pool first, generate fresh if pool empty
    villain = await claimPoolVillain(`pending_${walletAddress}_${Date.now()}`);
    if (!villain) {
      try {
        console.log(`[VILLAIN-AGENT] Pool empty, generating fresh for ${walletAddress}`);
        const { imageBuffer, traits, rarityScore } = await generateVillainImage();
        const poolId = `pending_${walletAddress}_${Date.now()}`;
        const { imageUrl, metadataUrl } = await uploadVillainToStorage(
          imageBuffer, traits, poolId, rarityScore
        );
        villain = await insertVillain(poolId, imageUrl, metadataUrl, traits, 0, rarityScore);
        console.log(`[VILLAIN-AGENT] Generated villain #${villain.id} (pending)`);
      } catch (genError: any) {
        console.log(`[VILLAIN-AGENT] Generation failed: ${genError.message}`);
        return res.status(503).json({ error: 'Image generation temporarily unavailable and pool is empty. Try again in a moment.' });
      }
    } else {
      // Mark as pending for this wallet
      await updateVillainWallet(villain.id, `pending_${walletAddress}_${Date.now()}`);
      console.log(`[VILLAIN-AGENT] Claimed pool villain #${villain.id} (pending)`);
    }

    // Build mint transaction (authority-signed, agent needs to countersign)
    const { transaction, assetAddress } = await buildMintTransaction(
      walletAddress,
      villain.id,
      villain.image_url,
      villain.traits,
      villain.rarity_score || 0
    );

    res.json({
      transaction,
      nftMint: assetAddress,
      villainId: villain.id,
      imageUrl: villain.image_url,
      traits: villain.traits,
      rarityScore: villain.rarity_score,
    });
  } catch (error: any) {
    console.error('[VILLAIN-AGENT] Agent mint failed:', error);
    res.status(500).json({ error: 'Mint failed', details: error.message });
  }
});

/**
 * POST /api/villain/execute
 * Step 3: Submit the fully-signed transaction
 */
router.post('/villain/execute', async (req, res) => {
  try {
    const { transaction, villainId } = req.body;
    if (!transaction) {
      return res.status(400).json({ error: 'transaction is required' });
    }

    // Deserialize and send to Solana
    const { Connection, VersionedTransaction } = await import('@solana/web3.js');
    const connection = new Connection(process.env.HELIUS_API_KEY 
      ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com');

    const txBuffer = Buffer.from(transaction, 'base64');
    const tx = VersionedTransaction.deserialize(txBuffer);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });

    console.log(`[VILLAIN-AGENT] Transaction submitted: ${signature}`);

    // Confirm on-chain before marking as minted
    try {
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      if (confirmation.value.err) {
        console.log(`[VILLAIN-AGENT] Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
        // Return pending villain to pool
        if (villainId) await returnVillainToPool(villainId);
        return res.status(400).json({ error: 'Transaction failed on-chain', signature, details: confirmation.value.err });
      }

      // Get minter wallet from tx accounts (signer 2 = minter)
      const minterKey = tx.message.staticAccountKeys[tx.message.header.numRequiredSignatures - 1];
      const walletAddress = minterKey.toString();

      // Mark as minted with real wallet + signature
      if (villainId) {
        await updateVillainWallet(villainId, walletAddress);
        await updateVillainMintSignature(walletAddress, signature);
        console.log(`[VILLAIN-AGENT] Villain #${villainId} minted by ${walletAddress}`);
      }
    } catch (confirmErr: any) {
      console.log(`[VILLAIN-AGENT] Confirmation timeout, tx may still land: ${confirmErr.message}`);
      // Don't return to pool — tx might still confirm
    }

    res.json({ signature });
  } catch (error: any) {
    console.error('[VILLAIN-AGENT] Execute failed:', error);
    res.status(500).json({ error: 'Failed to submit transaction', details: error.message });
  }
});

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

    // Check supply cap
    const currentSupply = await getMintedCount();
    if (currentSupply >= MAX_SUPPLY) {
      return res.status(400).json({ error: `Supply cap reached (${MAX_SUPPLY}/${MAX_SUPPLY}). No more villains can be minted.` });
    }

    // Check wallet limit (10 per wallet)
    const walletCount = await getMintedCountByWallet(walletAddress);
    if (walletCount >= MAX_PER_WALLET) {
      return res.status(400).json({ error: `Wallet limit reached (${MAX_PER_WALLET} per wallet)` });
    }

    console.log(`[VILLAIN] Generating for ${walletAddress}`);

    let villain: any;
    try {
      const { imageBuffer, traits, rarityScore } = await generateVillainImage();
      const { imageUrl, metadataUrl } = await uploadVillainToStorage(
        imageBuffer, traits, walletAddress, rarityScore
      );
      villain = await insertVillain(walletAddress, imageUrl, metadataUrl, traits, 0.05, rarityScore);
    } catch (genError: any) {
      console.log(`[VILLAIN] Generation failed, trying pool: ${genError.message}`);
      villain = await claimPoolVillain(walletAddress);
      if (!villain) {
        return res.status(503).json({ error: 'Image generation temporarily unavailable. Try again in a moment.' });
      }
      console.log(`[VILLAIN] Assigned pool villain #${villain.id}`);
    }

    // Update metadata URL with actual villain ID
    const actualMetadataUrl = (villain.metadata_url || '').replace('PLACEHOLDER', villain.id.toString());

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
 * GET /api/villains/supply
 * Current supply info
 */
router.get('/villains/supply', async (_req, res) => {
  try {
    const count = await getMintedCount();
    res.json({ minted: count, maxSupply: MAX_SUPPLY, remaining: MAX_SUPPLY - count });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch supply' });
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

/**
 * GET /api/villains/pool
 * Pool status
 */
router.get('/villains/pool', async (_req, res) => {
  try {
    const count = await getPoolCount();
    res.json({ pool: count });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch pool count' });
  }
});

/**
 * POST /api/villains/pool/refill
 * Refill pool up to target (default 10)
 */
router.post('/villains/pool/refill', async (req, res) => {
  try {
    const target = req.body.target || 10;
    const current = await getPoolCount();
    const needed = Math.max(0, target - current);
    if (needed === 0) return res.json({ message: 'Pool already full', pool: current });

    let generated = 0;
    for (let i = 0; i < needed; i++) {
      try {
        const { imageBuffer, traits, rarityScore } = await generateVillainImage();
        const { imageUrl } = await uploadVillainToStorage(imageBuffer, traits, `pool-${Date.now()}`, rarityScore);
        const poolAddr = `pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await insertVillain(poolAddr, imageUrl, '', traits, 0, rarityScore);
        generated++;
        console.log(`[POOL] Refilled ${generated}/${needed}`);
      } catch (err: any) {
        console.log(`[POOL] Generation failed at ${generated}/${needed}: ${err.message}`);
        break; // Rate limited, stop
      }
    }
    res.json({ message: `Refilled ${generated} villains`, pool: current + generated });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to refill pool', details: error.message });
  }
});

export default router;
