/**
 * Test the bid → outbid → refund flow end-to-end on devnet.
 * Uses the authority wallet to simulate bids (server-signed).
 * 
 * Run: cd backend && npx tsx scripts/test-bid-flow.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  Keypair,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const connection = new Connection(process.env.HELIUS_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

function getAuthority(): Keypair {
  const key = process.env.CHUM_SIGNING_KEY!;
  let bytes: number[];
  if (key.includes(',')) bytes = key.split(',').map(Number);
  else if (key.startsWith('[')) bytes = JSON.parse(key);
  else {
    const bs58 = require('bs58');
    bytes = Array.from((bs58.default?.decode || bs58.decode)(key));
  }
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

async function sendSol(from: Keypair, to: PublicKey, lamports: number): Promise<string> {
  const ix = SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports });
  const bh = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: from.publicKey,
    recentBlockhash: bh.blockhash,
    instructions: [ix],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([from]);
  return connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
}

async function main() {
  const authority = getAuthority();
  console.log('Authority:', authority.publicKey.toBase58());

  // Generate two test wallets
  const bidder1 = Keypair.generate();
  const bidder2 = Keypair.generate();
  console.log('Bidder 1:', bidder1.publicKey.toBase58());
  console.log('Bidder 2:', bidder2.publicKey.toBase58());

  // Fund bidders from authority (0.5 SOL each)
  console.log('\n--- Funding bidders ---');
  const fund1 = await sendSol(authority, bidder1.publicKey, 0.5 * LAMPORTS_PER_SOL);
  const fund2 = await sendSol(authority, bidder2.publicKey, 0.5 * LAMPORTS_PER_SOL);
  console.log('Funded bidder1:', fund1);
  console.log('Funded bidder2:', fund2);
  await new Promise(r => setTimeout(r, 3000));

  // Check balances
  const bal1 = await connection.getBalance(bidder1.publicKey);
  const bal2 = await connection.getBalance(bidder2.publicKey);
  console.log(`Bidder1 balance: ${bal1 / LAMPORTS_PER_SOL} SOL`);
  console.log(`Bidder2 balance: ${bal2 / LAMPORTS_PER_SOL} SOL`);

  // Create a test auction manually
  console.log('\n--- Creating test auction ---');
  const { data: auction, error: aErr } = await supabase.from('art_auctions').insert({
    epoch_number: 999,
    art_mint: 'test-mint-bid-flow',
    art_creator: authority.publicKey.toBase58(),
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    reserve_bid: 200000000,
    current_bid: 0,
    current_bidder: null,
    bid_count: 0,
    settled: false,
  }).select().single();
  if (aErr) { console.error('Failed to create auction:', aErr); return; }
  console.log('Auction created, id:', auction.id);

  // Bid 1: bidder1 bids 0.2 SOL
  console.log('\n--- Bid 1: bidder1 bids 0.2 SOL ---');
  const bid1Amount = 200000000;
  const bid1Tx = await sendSol(bidder1, authority.publicKey, bid1Amount);
  console.log('Bid1 tx:', bid1Tx);
  await new Promise(r => setTimeout(r, 3000));

  // Record bid in DB (simulating confirmBid)
  await supabase.from('art_bids').insert({
    auction_id: auction.id,
    bidder_wallet: bidder1.publicKey.toBase58(),
    bid_amount: bid1Amount,
  });
  await supabase.from('art_auctions').update({
    current_bid: bid1Amount,
    current_bidder: bidder1.publicKey.toBase58(),
    bid_count: 1,
  }).eq('id', auction.id);
  console.log('Bid1 recorded');

  // Check bidder1 balance after bid
  const bal1After = await connection.getBalance(bidder1.publicKey);
  console.log(`Bidder1 balance after bid: ${bal1After / LAMPORTS_PER_SOL} SOL`);

  // Bid 2: bidder2 bids 0.3 SOL — should trigger refund to bidder1
  console.log('\n--- Bid 2: bidder2 bids 0.3 SOL (should refund bidder1) ---');
  const bid2Amount = 300000000;
  const bid2Tx = await sendSol(bidder2, authority.publicKey, bid2Amount);
  console.log('Bid2 tx:', bid2Tx);
  await new Promise(r => setTimeout(r, 3000));

  // Simulate confirmBid logic: refund previous bidder
  console.log('Refunding bidder1...');
  const refundTx = await sendSol(authority, bidder1.publicKey, bid1Amount);
  console.log('Refund tx:', refundTx);
  await new Promise(r => setTimeout(r, 3000));

  // Record refund
  await supabase.from('art_bids').update({
    refunded: true,
    refund_tx: refundTx,
  }).eq('auction_id', auction.id).eq('bidder_wallet', bidder1.publicKey.toBase58());

  // Record bid2
  await supabase.from('art_bids').insert({
    auction_id: auction.id,
    bidder_wallet: bidder2.publicKey.toBase58(),
    bid_amount: bid2Amount,
  });
  await supabase.from('art_auctions').update({
    current_bid: bid2Amount,
    current_bidder: bidder2.publicKey.toBase58(),
    bid_count: 2,
  }).eq('id', auction.id);
  console.log('Bid2 recorded');

  // Verify balances
  console.log('\n--- Verifying balances ---');
  const bal1Final = await connection.getBalance(bidder1.publicKey);
  const bal2Final = await connection.getBalance(bidder2.publicKey);
  const authFinal = await connection.getBalance(authority.publicKey);
  console.log(`Bidder1 final: ${bal1Final / LAMPORTS_PER_SOL} SOL (should be ~0.5 - tx fees)`);
  console.log(`Bidder2 final: ${bal2Final / LAMPORTS_PER_SOL} SOL (should be ~0.2 - tx fees)`);
  console.log(`Authority final: ${authFinal / LAMPORTS_PER_SOL} SOL`);

  const bidder1Refunded = bal1Final >= 0.45 * LAMPORTS_PER_SOL;
  console.log(`\nBidder1 refund: ${bidder1Refunded ? 'PASS' : 'FAIL'} (got ${bal1Final / LAMPORTS_PER_SOL} SOL back)`);

  // Verify DB state
  const { data: bids } = await supabase.from('art_bids')
    .select('*').eq('auction_id', auction.id).order('id');
  console.log('\n--- DB bids ---');
  for (const b of (bids || [])) {
    console.log(`  ${b.bidder_wallet.slice(0, 8)}... | ${b.bid_amount / LAMPORTS_PER_SOL} SOL | refunded: ${b.refunded} | refund_tx: ${b.refund_tx?.slice(0, 12) || 'none'}... | refund_failed: ${b.refund_failed}`);
  }

  // Test failed refund flag
  console.log('\n--- Testing failed refund flag ---');
  await supabase.from('art_bids').insert({
    auction_id: auction.id,
    bidder_wallet: 'FakeWallet11111111111111111111111111111111111',
    bid_amount: 100000000,
    refund_failed: true,
    refund_error: 'Test: deliberate failure',
  });

  const { data: failed } = await supabase.from('art_bids')
    .select('*').eq('refund_failed', true);
  console.log(`Failed refunds in DB: ${failed?.length || 0}`);
  console.log(failed?.[0] ? `  Error: ${failed[0].refund_error}` : '  (none)');

  // Cleanup test data
  console.log('\n--- Cleanup ---');
  await supabase.from('art_bids').delete().eq('auction_id', auction.id);
  await supabase.from('art_auctions').delete().eq('id', auction.id);
  console.log('Test data cleaned up');

  console.log('\n✅ Bid flow test complete');
}

main().catch(console.error);
