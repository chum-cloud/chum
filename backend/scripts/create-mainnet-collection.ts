/**
 * Create CHUM: Reanimation mainnet collection.
 * Run: cd backend && npx tsx scripts/create-mainnet-collection.ts
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createCollection } from '@metaplex-foundation/mpl-core';
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const HELIUS_KEY = process.env.HELIUS_API_KEY || '06cda3a9-32f3-4ad9-a203-9d7274299837';
const RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

async function main() {
  const raw = process.env.CHUM_SIGNING_KEY!;
  let keyBytes: number[];
  if (raw.startsWith('[')) keyBytes = JSON.parse(raw);
  else if (raw.includes(',')) keyBytes = raw.split(',').map(Number);
  else throw new Error('Unsupported key format');

  const keypair = Keypair.fromSecretKey(Uint8Array.from(keyBytes));
  console.log('Authority:', keypair.publicKey.toBase58());
  console.log('RPC:', RPC);
  console.log('Network: MAINNET');

  const umi = createUmi(RPC);
  const signer = fromWeb3JsKeypair(keypair) as any;
  umi.use(keypairIdentity(signer));

  const collectionSigner = generateSigner(umi);

  console.log('\nCreating collection:', collectionSigner.publicKey.toString());

  const result = await createCollection(umi, {
    collection: collectionSigner,
    name: 'CHUM: Reanimation',
    uri: '',
    plugins: [
      {
        type: 'PermanentTransferDelegate',
      },
    ],
  }).sendAndConfirm(umi);

  console.log('\n=== MAINNET COLLECTION CREATED ===');
  console.log('Address:', collectionSigner.publicKey.toString());
  console.log('Authority:', keypair.publicKey.toBase58());
  console.log('Plugin: PermanentTransferDelegate (UpdateAuthority)');
  console.log('Tx:', Buffer.from(result.signature).toString('base64'));
  console.log('\nRoyalties (10% to chumAA7...) are set per-NFT at mint time in auction.ts');
  console.log('\n⚠️  Update auction_config.collection_address in Supabase to:', collectionSigner.publicKey.toString());
}

main().catch(console.error);
