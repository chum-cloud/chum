import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createCollection,
  create,
  fetchCollectionV1,
  ruleSet,
} from '@metaplex-foundation/mpl-core';
import {
  generateSigner,
  keypairIdentity,
  publicKey,
  type Umi,
  type KeypairSigner,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import { readFileSync } from 'fs';
import path from 'path';
import { transactionBuilder } from '@metaplex-foundation/umi';
import { SystemProgram, PublicKey } from '@solana/web3.js';
import { config } from '../config';
import type { VillainTraits } from '../types';

const MINT_FEE_LAMPORTS = 5_000_000; // 0.005 SOL

// Collection address - set after first creation
const COLLECTION_ADDRESS = process.env.VILLAIN_COLLECTION_ADDRESS || '';

let umi: Umi;
let authoritySigner: KeypairSigner;

function getUmi(): Umi {
  if (!umi) {
    umi = createUmi(config.heliusRpcUrl);

    // Load survival wallet keypair from env (JSON array) or file fallback
    let keyBytes: number[];
    if (process.env.SURVIVAL_WALLET_SECRET) {
      keyBytes = JSON.parse(process.env.SURVIVAL_WALLET_SECRET);
    } else {
      const walletPath = path.join(__dirname, '../../../chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T.json');
      keyBytes = JSON.parse(readFileSync(walletPath, 'utf-8'));
    }
    const keypair = Keypair.fromSecretKey(Uint8Array.from(keyBytes));
    authoritySigner = fromWeb3JsKeypair(keypair) as unknown as KeypairSigner;
    umi.use(keypairIdentity(authoritySigner));

    console.log('[NFT] Authority wallet:', keypair.publicKey.toString());
  }
  return umi;
}

/**
 * Create the "CHUM: Fellow Villains" collection (one-time setup)
 */
export async function createVillainCollection(): Promise<string> {
  const u = getUmi();
  const collectionSigner = generateSigner(u);

  console.log('[NFT] Creating collection:', collectionSigner.publicKey.toString());

  const builder = createCollection(u, {
    collection: collectionSigner,
    name: 'CHUM: Fellow Villains',
    uri: `${config.apiBaseUrl}/api/villains/collection-metadata`,
  });

  await builder.sendAndConfirm(u);

  console.log('[NFT] Collection created:', collectionSigner.publicKey.toString());
  return collectionSigner.publicKey.toString();
}

/**
 * Build a mint transaction for a villain NFT
 * Returns serialized transaction for the user to sign
 */
export async function buildMintTransaction(
  minterWallet: string,
  villainId: number,
  imageUrl: string,
  traits: VillainTraits,
  rarityScore: number
): Promise<{ transaction: string; assetAddress: string }> {
  if (!COLLECTION_ADDRESS) {
    throw new Error('Collection not created yet. Set VILLAIN_COLLECTION_ADDRESS env var.');
  }

  const u = getUmi();
  const assetSigner = generateSigner(u);
  const minterPubkey = publicKey(minterWallet);

  // Fetch collection for the create instruction
  const collection = await fetchCollectionV1(u, publicKey(COLLECTION_ADDRESS));

  console.log(`[NFT] Building mint tx for villain #${villainId}, asset: ${assetSigner.publicKey}`);

  // Survival wallet receives royalties
  const authorityPubkey = u.identity.publicKey;

  const builder = create(u, {
    asset: assetSigner,
    collection,
    name: `Fellow Villain #${villainId}`,
    uri: `${config.apiBaseUrl}/api/villain/${villainId}/metadata`,
    owner: minterPubkey,
    plugins: [
      {
        type: 'Royalties',
        basisPoints: 500, // 5%
        creators: [{ address: authorityPubkey, percentage: 100 }],
        ruleSet: ruleSet('None'),
      },
    ],
  });

  // Add 0.001 SOL mint fee: minter -> survival wallet (raw SystemProgram transfer)
  const feeInstruction = SystemProgram.transfer({
    fromPubkey: new PublicKey(minterWallet),
    toPubkey: new PublicKey(authorityPubkey.toString()),
    lamports: MINT_FEE_LAMPORTS,
  });

  // Convert web3.js instruction to Umi instruction and append
  const { fromWeb3JsInstruction } = await import('@metaplex-foundation/umi-web3js-adapters');
  const umiFeeIx = fromWeb3JsInstruction(feeInstruction);
  const feeBuilder = transactionBuilder().add({
    instruction: umiFeeIx,
    signers: [], // minter signs client-side
    bytesCreatedOnChain: 0,
  });

  // Combine mint + fee into one transaction
  const combinedBuilder = builder.add(feeBuilder);
  const tx = await combinedBuilder.buildWithLatestBlockhash(u);

  // Sign with authority (payer) + asset signer on the backend
  const signedTx = await u.identity.signTransaction(tx);
  const fullySignedTx = await assetSigner.signTransaction(signedTx);

  // Serialize - authority + asset signer are signed,
  // minter still needs to countersign
  const serialized = u.transactions.serialize(fullySignedTx);
  const base64Tx = Buffer.from(serialized).toString('base64');

  return {
    transaction: base64Tx,
    assetAddress: assetSigner.publicKey.toString(),
  };
}

/**
 * Get collection metadata (served at /api/villains/collection-metadata)
 */
export function getCollectionMetadata() {
  return {
    name: 'CHUM: Fellow Villains',
    description:
      "An army of unique villain supporters keeping Sheldon J. Plankton alive on the Solana blockchain. Each Fellow Villain is a 1/1 generated portrait in the 1930s rubber hose cartoon style. Enlist today — the revolution needs YOU.\n\nIn Plankton We Trust. 🟢",
    image: 'https://chum-production.up.railway.app/chum-logo-dollar-6.png',
    external_url: 'https://chum-one.vercel.app/villains',
  };
}
