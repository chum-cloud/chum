/**
 * Create CHUM: Reanimation collection v2 with PermanentTransferDelegate plugin.
 * Run: cd backend && npx tsx scripts/create-collection-v2.ts
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createCollection } from '@metaplex-foundation/mpl-core';
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

  const collectionSigner = generateSigner(umi);

  console.log('Authority:', keypair.publicKey.toString());
  console.log('New collection:', collectionSigner.publicKey.toString());

  const builder = createCollection(umi, {
    collection: collectionSigner,
    name: 'CHUM: Reanimation',
    uri: 'https://arweave.net/placeholder',
    plugins: [
      {
        type: 'PermanentTransferDelegate',
      },
    ],
  });

  const result = await builder.sendAndConfirm(umi);
  console.log('✅ Collection created with PermanentTransferDelegate!');
  console.log('Collection address:', collectionSigner.publicKey.toString());
  console.log('Tx:', Buffer.from(result.signature).toString('base64'));
  console.log('\n⚠️  Update auction_config.collection_address in Supabase to:', collectionSigner.publicKey.toString());
}

main().catch(console.error);
