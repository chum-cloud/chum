/**
 * Fix metadata URIs for 3 mainnet NFTs: arweave.net → gateway.irys.xyz
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { updateV1, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import { keypairIdentity, publicKey } from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const HELIUS_KEY = process.env.HELIUS_API_KEY || '06cda3a9-32f3-4ad9-a203-9d7274299837';
const RPC = process.env.SOLANA_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const COLLECTION = '877BjfHehJF3zz3kWWbuYdFBGyVERdnKk7ycfKNJ15QW';

const MINTS = [
  'BYv5iH6ic6BUynXb445zV9cx7WUmXYGwx7FBi6pyGm2J',  // #0001
  '12yEJ26uVvipwj3S3zJCpyZXxVcQw61Qk7KTjVtpNjok',  // #0002
  '6TM4NwmMFbTdb9A4cyFP7HvATKvrL8QRkezCSCh3ZD9o',   // #0003
];

async function main() {
  const raw = process.env.CHUM_SIGNING_KEY!;
  const keyBytes = raw.includes(',') ? raw.split(',').map(Number) : JSON.parse(raw);
  const keypair = Keypair.fromSecretKey(Uint8Array.from(keyBytes));

  const umi = createUmi(RPC);
  const signer = fromWeb3JsKeypair(keypair) as any;
  umi.use(keypairIdentity(signer));

  for (const mint of MINTS) {
    console.log(`\n--- ${mint} ---`);
    const asset = await fetchAssetV1(umi, publicKey(mint));
    console.log('Current URI:', asset.uri);
    console.log('Current name:', asset.name);

    if (!asset.uri || !asset.uri.includes('arweave.net')) {
      // Check if it's a Supabase fallback or already fixed
      if (asset.uri.includes('gateway.irys.xyz')) {
        console.log('Already using gateway.irys.xyz, skipping');
        continue;
      }
    }

    // Fetch current metadata to get the Irys tx IDs
    let metadata: any;
    try {
      // Try fetching from current URI
      const resp = await fetch(asset.uri);
      metadata = await resp.json();
      console.log('Metadata image:', metadata.image);
      console.log('Metadata animation:', metadata.animation_url);
    } catch (e) {
      console.log('Cannot fetch current metadata, will re-upload');
      // If metadata URI is broken, we need to rebuild it
      // For now just fix the URI prefix
    }

    // Replace arweave.net with gateway.irys.xyz in the metadata
    if (metadata) {
      const newImage = metadata.image?.replace('arweave.net', 'gateway.irys.xyz');
      const newAnimation = metadata.animation_url?.replace('arweave.net', 'gateway.irys.xyz');
      
      // Upload new metadata JSON to Irys
      const { default: Irys } = await import('@irys/sdk');
      const irys = new Irys({
        url: 'https://node1.irys.xyz',
        token: 'solana',
        key: Buffer.from(new Uint8Array(keyBytes)),
        config: { providerUrl: RPC },
      });

      const newMetadata = {
        ...metadata,
        image: newImage,
        animation_url: newAnimation,
      };

      console.log('Uploading fixed metadata...');
      const receipt = await irys.upload(JSON.stringify(newMetadata), {
        tags: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'App-Name', value: 'CHUM-Reanimation' },
        ],
      });
      const newUri = `https://gateway.irys.xyz/${receipt.id}`;
      console.log('New metadata URI:', newUri);

      // Update on-chain
      console.log('Updating on-chain...');
      const result = await updateV1(umi, {
        asset: publicKey(mint),
        collection: publicKey(COLLECTION),
        newUri: newUri,
      }).sendAndConfirm(umi);
      console.log('✅ Updated! Tx:', Buffer.from(result.signature).toString('base64'));
    }
  }
}

main().catch(e => console.error('FAILED:', e));
