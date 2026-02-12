/**
 * Create the "CHUM: ARTWORK" collection on Solana devnet using Metaplex Core.
 * Run: npx tsx scripts/create-art-collection.ts
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
  if (signingKey.startsWith('[')) {
    keyBytes = JSON.parse(signingKey);
  } else if (signingKey.includes(',')) {
    // Comma-separated array without brackets
    keyBytes = signingKey.split(',').map(Number);
  } else {
    const bs58 = require('bs58');
    keyBytes = Array.from(bs58.default ? bs58.default.decode(signingKey) : bs58.decode(signingKey));
  }

  const keypair = Keypair.fromSecretKey(Uint8Array.from(keyBytes));
  console.log('Authority:', keypair.publicKey.toString());

  // Use devnet Helius RPC
  const heliusKey = process.env.HELIUS_API_KEY!;
  const rpc = `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
  
  const umi = createUmi(rpc);
  const signer = fromWeb3JsKeypair(keypair) as any;
  umi.use(keypairIdentity(signer));

  const collectionSigner = generateSigner(umi);
  
  console.log('Creating collection:', collectionSigner.publicKey.toString());
  console.log('Payer:', umi.payer.publicKey.toString());
  console.log('Identity:', umi.identity.publicKey.toString());

  const builder = createCollection(umi, {
    collection: collectionSigner,
    name: 'CHUM: ARTWORK',
    uri: 'https://arweave.net/placeholder', // TODO: upload collection metadata
  });

  const result = await builder.sendAndConfirm(umi);
  console.log('✅ Collection created!');
  console.log('Collection address:', collectionSigner.publicKey.toString());
  console.log('Tx signature:', Buffer.from(result.signature).toString('base64'));
}

main().catch(console.error);
