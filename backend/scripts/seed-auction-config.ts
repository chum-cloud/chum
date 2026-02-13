/**
 * Seed the auction_config table with initial values.
 * Run: npx tsx scripts/seed-auction-config.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!, // Need service role key for writes with RLS
);

async function main() {
  // TODO: Swap to mainnet collection address before launch
  const collectionAddress = '4fycGHogpTBAV9ipRrdyNJxzf9zeiSsnkGTqsVcfHVso'; // devnet
  const vaultWallet = 'Ag6N1tdR6NLFfEhZ8CtxGYRAzdpkncQkBY25FXdfqYNM';
  const teamWallet = process.env.TEAM_WALLET || vaultWallet;
  const treasuryWallet = process.env.TREASURY_WALLET || vaultWallet;
  const fellowVillains = process.env.VILLAIN_COLLECTION_ADDRESS || 'EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7';

  const { data, error } = await supabase
    .from('auction_config')
    .upsert({
      id: 1,
      current_epoch: 1,
      mint_fee: 15000000,        // 0.015 SOL
      join_fee: 15000000,        // 0.015 SOL
      base_vote_price: 2000000,  // 0.002 SOL
      epoch_duration: 86400,     // 24h
      auction_duration: 14400,   // 4h
      reserve_bid: 200000000,    // 0.2 SOL
      paused: false,
      vault_wallet: vaultWallet,
      team_wallet: teamWallet,
      treasury_wallet: treasuryWallet,
      collection_address: collectionAddress,
      fellow_villains_collection: fellowVillains,
      total_minted: 0,
      total_founder_keys: 0,
    })
    .select();

  if (error) {
    console.error('Error:', error.message);
    // If RLS blocks, try direct SQL approach
    console.log('\nIf RLS is blocking, run this SQL in Supabase SQL editor:');
    console.log(`
INSERT INTO auction_config (id, current_epoch, mint_fee, join_fee, base_vote_price, epoch_duration, auction_duration, reserve_bid, paused, vault_wallet, team_wallet, treasury_wallet, collection_address, fellow_villains_collection, total_minted, total_founder_keys)
VALUES (1, 1, 15000000, 15000000, 2000000, 86400, 14400, 200000000, false, '${vaultWallet}', '${teamWallet}', '${treasuryWallet}', '${collectionAddress}', '${fellowVillains}', 0, 0)
ON CONFLICT (id) DO UPDATE SET
  collection_address = EXCLUDED.collection_address,
  vault_wallet = EXCLUDED.vault_wallet,
  team_wallet = EXCLUDED.team_wallet,
  treasury_wallet = EXCLUDED.treasury_wallet;
    `);
    return;
  }

  console.log('✅ Auction config seeded:', data);
}

main().catch(console.error);
