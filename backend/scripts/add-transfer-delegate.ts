/**
 * Add PermanentTransferDelegate plugin to the CHUM: Reanimation collection.
 * This allows the collection authority to transfer any NFT in the collection.
 * Run: npx tsx scripts/add-transfer-delegate.ts
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { addCollectionPlugin, fetchCollectionV1 } from '@metaplex-foundation/mpl-core';
import { keypairIdentity, publicKey } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// TODO: Swap to mainnet collection address before launch
const COLLECTION = '4RRRzZ7zmLbL6fMNsAujGgz3XnZabUSSEPEWSCwmZxqz'; // devnet

async function main() {
  const signingKey = process.env.CHUM_SIGNING_KEY!;
  let keyBytes: number[];
  if (signingKey.startsWith('[')) keyBytes = JSON.parse(signingKey);
  else if (signingKey.includes(',')) keyBytes = signingKey.split(',').map(Number);
  else {
    const bs58 = require('bs58');
    keyBytes = Array.from(bs58.default ? bs58.default.decode(signingKey) : bs58.decode(signingKey));
  }

  const keypair = Keypair.fromSecretKey(Uint8Array.from(keyBytes));
  const heliusKey = process.env.HELIUS_API_KEY!;
  const rpc = `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;

  const umi = createUmi(rpc);
  const signer = fromWeb3JsKeypair(keypair) as any;
  umi.use(keypairIdentity(signer));

  console.log('Authority:', keypair.publicKey.toString());
  console.log('Collection:', COLLECTION);

  // Fetch current collection to verify
  const collection = await fetchCollectionV1(umi, publicKey(COLLECTION));
  console.log('Collection name:', collection.name);
  console.log('Update authority:', collection.updateAuthority.toString());

  // Add PermanentTransferDelegate plugin
  console.log('\nAdding PermanentTransferDelegate plugin...');
  const result = await addCollectionPlugin(umi, {
    collection: publicKey(COLLECTION),
    plugin: {
      type: 'PermanentTransferDelegate',
    },
  }).sendAndConfirm(umi);

  console.log('✅ PermanentTransferDelegate added!');
  console.log('Tx:', Buffer.from(result.signature).toString('base64'));
}

main().catch(console.error);
