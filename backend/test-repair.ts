/**
 * Test repair: update 2 duplicate NFTs with unique pool art
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity } from '@metaplex-foundation/umi';
import { updateV1 } from '@metaplex-foundation/mpl-core';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import { publicKey } from '@metaplex-foundation/umi';
import { createClient } from '@supabase/supabase-js';

import 'dotenv/config';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const supabaseUrl = process.env.SUPABASE_URL!.startsWith('http') ? process.env.SUPABASE_URL! : `https://${process.env.SUPABASE_URL}.supabase.co`;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY!);

// Two test NFTs from the 17-count duplicate group
const TEST_NFTS = [
  'J7U6H846aoguFq5R6yZwikUydk9xZ9xkkNnE4uCNwUy8',
  'Hm6qcjm3uqHjFhkrDCgq1rRwXqBMUtoXi4o4bYHA26vv',
];

async function getAuthority(): Promise<Keypair> {
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  let keyBytes: number[];
  if (process.env.SURVIVAL_WALLET_SECRET) {
    keyBytes = JSON.parse(process.env.SURVIVAL_WALLET_SECRET);
  } else {
    const walletPath = join(__dirname, '../chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T.json');
    keyBytes = JSON.parse(readFileSync(walletPath, 'utf-8'));
  }
  return Keypair.fromSecretKey(Uint8Array.from(keyBytes));
}

async function claimPoolVillain() {
  // Get a random pool villain
  const { count } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true })
    .like('wallet_address', 'pool%');
  
  if (!count || count === 0) throw new Error('Pool empty');
  
  const offset = Math.floor(Math.random() * count);
  const { data, error } = await supabase
    .from('villains')
    .select('*')
    .like('wallet_address', 'pool%')
    .range(offset, offset);
  
  if (error || !data?.[0]) throw new Error('Failed to claim pool villain');
  return data[0];
}

async function main() {
  const authority = await getAuthority();
  const umi = createUmi(HELIUS_RPC).use(keypairIdentity(fromWeb3JsKeypair(authority)));

  console.log('Authority:', authority.publicKey.toBase58());

  for (const assetId of TEST_NFTS) {
    console.log(`\n--- Repairing ${assetId} ---`);
    
    // 1. Claim a pool villain
    const poolVillain = await claimPoolVillain();
    console.log(`Claimed pool villain #${poolVillain.id}, image: ${poolVillain.image_url?.slice(-40)}`);

    // 2. Create new metadata - use the pool villain's data but with unique name
    const newName = `Fellow Villain #${poolVillain.id}`;
    const newUri = `https://chum-production.up.railway.app/api/villain/${poolVillain.id}/metadata`;

    console.log(`New name: ${newName}`);
    console.log(`New URI: ${newUri}`);

    // 3. Update on-chain
    try {
      const COLLECTION = 'EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7';
      const tx = await updateV1(umi, {
        asset: publicKey(assetId),
        collection: publicKey(COLLECTION),
        newName: newName,
        newUri: newUri,
      }).sendAndConfirm(umi);
      
      console.log(`✅ Updated on-chain! Sig: ${Buffer.from(tx.signature).toString('base64').slice(0, 20)}...`);

      // 4. Mark pool villain as used (update wallet_address)
      await supabase
        .from('villains')
        .update({ wallet_address: `repair-${assetId.slice(0, 8)}`, is_minted: true })
        .eq('id', poolVillain.id);
      
      console.log(`✅ DB updated for villain #${poolVillain.id}`);
    } catch (err: any) {
      console.error(`❌ Failed: ${err.message}`);
    }
  }
}

main().catch(console.error);
