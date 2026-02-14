import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createCollection,
  create,
  transfer,
  transferV1,
  updatePlugin,
  addPlugin,
  fetchAssetV1,
  fetchCollectionV1,
  ruleSet,
} from '@metaplex-foundation/mpl-core';
import {
  generateSigner,
  keypairIdentity,
  publicKey,
  transactionBuilder,
  createNoopSigner,
  type Umi,
  type KeypairSigner,
} from '@metaplex-foundation/umi';
import { fromWeb3JsKeypair, fromWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import {
  Keypair,
  SystemProgram,
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// ─── Supabase Client ───
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// ─── Solana Connection ───
const connection = new Connection(config.heliusRpcUrl, 'confirmed');

// ─── Authority Wallet (collection authority + NFT transfers) ───
// Uses CHUM_SIGNING_KEY from Railway env (same key used for villain minting)
let umi: Umi;
let authoritySigner: KeypairSigner;
let authorityKeypair: Keypair;

function getUmi(): Umi {
  if (!umi) {
    umi = createUmi(config.heliusRpcUrl);

    const signingKey = config.chumSigningKey;
    let keyBytes: number[];

    // Support JSON array [1,2,3...], comma-separated, and base58 formats
    if (signingKey.startsWith('[')) {
      keyBytes = JSON.parse(signingKey);
    } else if (signingKey.includes(',')) {
      keyBytes = signingKey.split(',').map(Number);
    } else {
      const bs58 = require('bs58');
      const decode = bs58.default?.decode || bs58.decode;
      keyBytes = Array.from(decode(signingKey));
    }

    authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(keyBytes));
    authoritySigner = fromWeb3JsKeypair(authorityKeypair) as unknown as KeypairSigner;
    umi.use(keypairIdentity(authoritySigner));

    console.log('[AUCTION] Authority wallet:', authorityKeypair.publicKey.toString());
  }
  return umi;
}

// ─── Helper: get config singleton ───
export async function getConfig() {
  const { data, error } = await supabase
    .from('auction_config')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw new Error(`getConfig: ${error.message}`);
  return data;
}

// ─── Helper: serialize UMI tx to base64 ───
function serializeUmiTx(tx: any, u: Umi): string {
  const serialized = u.transactions.serialize(tx);
  return Buffer.from(serialized).toString('base64');
}

// ─── Helper: build web3.js versioned tx as base64 ───
async function buildTransferTx(
  fromWallet: string,
  toWallet: string,
  lamports: number,
): Promise<string> {
  const ix = SystemProgram.transfer({
    fromPubkey: new PublicKey(fromWallet),
    toPubkey: new PublicKey(toWallet),
    lamports,
  });
  const blockhash = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: new PublicKey(fromWallet),
    recentBlockhash: blockhash.blockhash,
    instructions: [ix],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  return Buffer.from(tx.serialize()).toString('base64');
}

// ─── Helper: calculate escalating vote price ───
function calculateVotePrice(basePrice: number, totalVotesOnPiece: number): number {
  const tier = Math.floor(totalVotesOnPiece / 10);
  if (tier === 0) return basePrice;
  return Math.floor(basePrice * Math.pow(3, tier) / Math.pow(2, tier));
}

// ═══════════════════════════════════════════════════════════════
// SERVICE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Mint a new art NFT. Returns serialized tx for user to countersign.
 * Vault wallet is update authority; user is owner.
 * Mint fee goes to team wallet.
 */
export async function mintArt(
  creatorWallet: string,
  name: string,
  uri: string,
  feeOverride?: number,
): Promise<{ transaction: string; assetAddress: string; mintNumber: number }> {
  const cfg = await getConfig();
  if (cfg.paused) throw new Error('Auction system is paused');

  const u = getUmi();
  const assetSigner = generateSigner(u);
  const minterPubkey = publicKey(creatorWallet);

  const collection = await fetchCollectionV1(u, publicKey(cfg.collection_address));

  // Increment mint counter
  const mintNumber = cfg.total_minted + 1;
  const nftName = name || `CHUM: Reanimation #${String(mintNumber).padStart(4, '0')}`;

  // Build create instruction — vault is authority/update authority, user is owner
  const createBuilder = create(u, {
    asset: assetSigner,
    collection,
    name: nftName,
    uri,
    owner: minterPubkey,
    plugins: [
      {
        type: 'Royalties',
        basisPoints: 500,
        creators: [{ address: u.identity.publicKey, percentage: 100 }],
        ruleSet: ruleSet('None'),
      },
      {
        type: 'Attributes',
        attributeList: [
          { key: 'Status', value: 'Artwork' },
          { key: 'Creator', value: creatorWallet },
        ],
      },
    ],
  });

  // Add mint fee: user → team wallet (feeOverride for agent pricing)
  const mintFee = feeOverride ?? Number(cfg.mint_fee);
  const feeIx = SystemProgram.transfer({
    fromPubkey: new PublicKey(creatorWallet),
    toPubkey: new PublicKey(cfg.team_wallet),
    lamports: mintFee,
  });
  const umiFeeIx = fromWeb3JsInstruction(feeIx);
  const feeBuilder = transactionBuilder().add({
    instruction: umiFeeIx,
    signers: [],
    bytesCreatedOnChain: 0,
  });

  const combined = createBuilder.add(feeBuilder);
  const tx = await combined.buildWithLatestBlockhash(u);

  // Sign with authority + asset signer on backend
  const signedTx = await u.identity.signTransaction(tx);
  const fullySignedTx = await assetSigner.signTransaction(signedTx);

  // Do NOT increment total_minted here — wait for confirmMint after user signs + submits

  return {
    transaction: serializeUmiTx(fullySignedTx, u),
    assetAddress: assetSigner.publicKey.toString(),
    mintNumber,
  };
}

/**
 * Confirm a mint after user has signed and submitted the transaction.
 * Verifies the asset exists on-chain, then increments total_minted.
 */
export async function confirmMint(
  assetAddress: string,
  signature: string,
): Promise<{ confirmed: boolean; name: string }> {
  // Wait for tx confirmation
  const sig = await connection.confirmTransaction(signature, 'confirmed');
  if (sig.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(sig.value.err)}`);
  }

  // Verify the asset exists on-chain and belongs to our collection
  const u = getUmi();
  const asset = await fetchAssetV1(u, publicKey(assetAddress));
  const cfg = await getConfig();

  if (
    !asset.updateAuthority ||
    asset.updateAuthority.type !== 'Collection' ||
    (asset.updateAuthority as any).address?.toString() !== cfg.collection_address
  ) {
    throw new Error('Asset is not from the CHUM art collection');
  }

  // Now safe to increment
  const newTotal = cfg.total_minted + 1;
  await supabase
    .from('auction_config')
    .update({ total_minted: newTotal, updated_at: new Date().toISOString() })
    .eq('id', 1);

  return { confirmed: true, name: asset.name };
}

/**
 * Join voting: transfer NFT from user to vault + pay join fee to treasury.
 * Returns serialized tx for user to sign.
 */
export async function joinVoting(
  creatorWallet: string,
  mintAddress: string,
  feeOverride?: number,
): Promise<{ transaction: string }> {
  const cfg = await getConfig();
  if (cfg.paused) throw new Error('Auction system is paused');

  const u = getUmi();
  const asset = await fetchAssetV1(u, publicKey(mintAddress));

  // Verify ownership
  if (asset.owner.toString() !== creatorWallet) {
    throw new Error('You do not own this NFT');
  }

  // Verify it's in our collection
  if (
    !asset.updateAuthority ||
    asset.updateAuthority.type !== 'Collection' ||
    (asset.updateAuthority as any).address?.toString() !== cfg.collection_address
  ) {
    throw new Error('NFT is not from the CHUM art collection');
  }

  // Step 1: Build fee payment tx (user signs this)
  const joinFee = feeOverride ?? Number(cfg.join_fee);
  const feeTx = await buildTransferTx(creatorWallet, cfg.treasury_wallet, joinFee);

  // Do NOT insert candidate or transfer NFT here — wait for confirmJoin

  return {
    transaction: feeTx,
  };
}

/**
 * Confirm join voting after user signed and submitted the tx.
 * Verifies the NFT is now owned by vault, then inserts candidate.
 */
export async function confirmJoin(
  creatorWallet: string,
  mintAddress: string,
  signature: string,
): Promise<{ confirmed: boolean; name: string; transferSignature: string }> {
  // Step 1: Verify the fee payment tx confirmed
  const sig = await connection.confirmTransaction(signature, 'confirmed');
  if (sig.value.err) {
    throw new Error(`Fee transaction failed: ${JSON.stringify(sig.value.err)}`);
  }

  const u = getUmi();
  const cfg = await getConfig();
  const asset = await fetchAssetV1(u, publicKey(mintAddress));

  // Verify user still owns the NFT
  if (asset.owner.toString() !== creatorWallet) {
    throw new Error('You do not own this NFT');
  }

  // Step 2: Server-side NFT transfer using PermanentTransferDelegate
  // Vault (update authority) can transfer any NFT in the collection without owner signature
  // Use transferV1 directly — the `transfer` helper has issues with collection object serialization
  const transferResult = await transferV1(u, {
    asset: publicKey(mintAddress),
    collection: publicKey(cfg.collection_address),
    newOwner: u.identity.publicKey, // vault
    authority: u.identity,
  }).sendAndConfirm(u);
  const transferSig = Buffer.from(transferResult.signature).toString('base64');
  console.log(`[AUCTION] NFT ${mintAddress} transferred to vault: ${transferSig}`);

  const epoch = await getCurrentEpoch();

  // Fetch metadata for image_url / animation_url
  let imageUrl: string | null = null;
  let animationUrl: string | null = null;
  try {
    const resp = await fetch(asset.uri);
    const metadata = await resp.json() as any;
    imageUrl = metadata.image || null;
    animationUrl = metadata.animation_url || null;
  } catch {}

  // Now safe to insert candidate
  await supabase.from('art_candidates').upsert({
    mint_address: mintAddress,
    creator_wallet: creatorWallet,
    name: asset.name,
    uri: asset.uri,
    image_url: imageUrl,
    animation_url: animationUrl,
    epoch_joined: epoch.epoch_number,
    votes: 0,
    won: false,
    withdrawn: false,
  }, { onConflict: 'mint_address' });

  return { confirmed: true, name: asset.name, transferSignature: transferSig };
}

/**
 * Free vote: 1 free vote per wallet per epoch per candidate.
 * Requires voter to hold a Fellow Villains NFT (verified via Helius DAS).
 */
export async function voteFree(
  voterWallet: string,
  candidateMint: string,
  epochNumber?: number,
  numVotes: number = 1,
): Promise<{ success: boolean; totalVotes: number; votesUsed: number }> {
  const cfg = await getConfig();
  if (cfg.paused) throw new Error('Auction system is paused');

  const epoch = await getCurrentEpoch();
  const epNum = epochNumber || epoch.epoch_number;

  // Verify candidate exists and is active
  const { data: candidate, error: candErr } = await supabase
    .from('art_candidates')
    .select('*')
    .eq('mint_address', candidateMint)
    .eq('withdrawn', false)
    .single();
  if (candErr || !candidate) throw new Error('Candidate not found or withdrawn');

  // Verify voter holds a Fellow Villains NFT or Founder Key
  const eligible = await verifyVoteEligibility(voterWallet, cfg);
  if (!eligible) {
    throw new Error('Must hold a Fellow Villains NFT or Founder Key to vote for free');
  }

  // Insert free votes (bulk)
  const votes = Array.from({ length: numVotes }, (_, i) => ({
    voter_wallet: voterWallet,
    candidate_mint: candidateMint,
    epoch_number: epNum,
    num_votes: 1,
    is_paid: false,
    cost_lamports: 0,
    vote_type: 'free',
  }));

  const { error: voteErr } = await supabase.from('art_votes').insert(votes);

  if (voteErr) {
    if (voteErr.message.includes('idx_free_vote_unique') || voteErr.message.includes('duplicate')) {
      throw new Error('Already used free vote for this candidate this epoch');
    }
    throw new Error(`Vote failed: ${voteErr.message}`);
  }

  // Increment vote count on candidate
  const newVotes = (candidate.votes || 0) + numVotes;
  await supabase
    .from('art_candidates')
    .update({ votes: newVotes })
    .eq('mint_address', candidateMint);

  return { success: true, totalVotes: newVotes, votesUsed: numVotes };
}

/**
 * Agent vote: free, unlimited, zero ranking weight. Social proof only.
 */
/**
 * Paid vote: costs escalating SOL. Returns tx for user to sign.
 */
export async function votePaid(
  voterWallet: string,
  candidateMint: string,
  numVotes: number = 1,
): Promise<{ transaction: string; cost: number; currentVotes: number; epochNumber: number }> {
  const cfg = await getConfig();
  if (cfg.paused) throw new Error('Auction system is paused');

  const epoch = await getCurrentEpoch();

  // Get candidate
  const { data: candidate, error: candErr } = await supabase
    .from('art_candidates')
    .select('*')
    .eq('mint_address', candidateMint)
    .eq('withdrawn', false)
    .single();
  if (candErr || !candidate) throw new Error('Candidate not found or withdrawn');

  // Calculate total cost for numVotes
  let totalCost = 0;
  let currentVotes = candidate.votes || 0;
  for (let i = 0; i < numVotes; i++) {
    totalCost += calculateVotePrice(Number(cfg.base_vote_price), currentVotes + i);
  }

  // Build SOL transfer: voter → treasury
  const transaction = await buildTransferTx(voterWallet, cfg.treasury_wallet, totalCost);

  // Do NOT insert vote here — wait for confirmVotePaid after user signs

  return { transaction, cost: totalCost, currentVotes, epochNumber: epoch.epoch_number };
}

/**
 * Confirm a paid vote after user signed and submitted the tx.
 */
export async function confirmVotePaid(
  voterWallet: string,
  candidateMint: string,
  numVotes: number,
  epochNumber: number,
  signature: string,
): Promise<{ confirmed: boolean; totalVotes: number }> {
  const sig = await connection.confirmTransaction(signature, 'confirmed');
  if (sig.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(sig.value.err)}`);
  }

  const cfg = await getConfig();

  // Get candidate fresh
  const { data: candidate, error: candErr } = await supabase
    .from('art_candidates')
    .select('*')
    .eq('mint_address', candidateMint)
    .eq('withdrawn', false)
    .single();
  if (candErr || !candidate) throw new Error('Candidate not found or withdrawn');

  // Calculate cost for verification
  let totalCost = 0;
  const currentVotes = candidate.votes || 0;
  for (let i = 0; i < numVotes; i++) {
    totalCost += calculateVotePrice(Number(cfg.base_vote_price), currentVotes + i);
  }

  // Insert vote record
  await supabase.from('art_votes').insert({
    voter_wallet: voterWallet,
    candidate_mint: candidateMint,
    epoch_number: epochNumber,
    num_votes: numVotes,
    is_paid: true,
    cost_lamports: totalCost,
    vote_type: 'paid',
  });

  // Update candidate votes
  const newVotes = currentVotes + numVotes;
  await supabase
    .from('art_candidates')
    .update({ votes: newVotes })
    .eq('mint_address', candidateMint);

  return { confirmed: true, totalVotes: newVotes };
}

/**
 * Place a bid on the current auction.
 * Returns tx for user to sign. Refunds previous bidder.
 */
export async function placeBid(
  bidderWallet: string,
  epochNumber: number,
  bidAmount: number,
): Promise<{ transaction: string; auctionId: number; minBid: number }> {
  const cfg = await getConfig();
  if (cfg.paused) throw new Error('Auction system is paused');

  // Get auction
  const { data: auction, error: aErr } = await supabase
    .from('art_auctions')
    .select('*')
    .eq('epoch_number', epochNumber)
    .eq('settled', false)
    .single();
  if (aErr || !auction) throw new Error('No active auction for this epoch');

  // Verify auction hasn't ended
  if (new Date(auction.end_time) < new Date()) {
    throw new Error('Auction has ended');
  }

  // Verify bid meets minimum
  const minBid = auction.current_bid > 0
    ? Math.floor(Number(auction.current_bid) * 1.10) // 10% minimum increment
    : Number(auction.reserve_bid);
  if (bidAmount < minBid) {
    throw new Error(`Bid must be at least ${minBid} lamports (${minBid / LAMPORTS_PER_SOL} SOL)`);
  }

  // Build bid tx: bidder → treasury
  const transaction = await buildTransferTx(bidderWallet, cfg.treasury_wallet, bidAmount);

  // Do NOT record bid or refund here — wait for confirmBid after user signs

  return { transaction, auctionId: auction.id, minBid };
}

/**
 * Confirm a bid after user signed and submitted the tx.
 * Refunds previous bidder, records bid, updates auction.
 */
export async function confirmBid(
  bidderWallet: string,
  epochNumber: number,
  bidAmount: number,
  signature: string,
): Promise<{ confirmed: boolean; auctionId: number }> {
  const sig = await connection.confirmTransaction(signature, 'confirmed');
  if (sig.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(sig.value.err)}`);
  }

  // Get auction fresh
  const { data: auction, error: aErr } = await supabase
    .from('art_auctions')
    .select('*')
    .eq('epoch_number', epochNumber)
    .eq('settled', false)
    .single();
  if (aErr || !auction) throw new Error('No active auction for this epoch');

  // Refund previous bidder if exists — NEVER lose a bidder's SOL
  if (auction.current_bidder && Number(auction.current_bid) > 0) {
    try {
      await refundBidder(auction.current_bidder, Number(auction.current_bid), auction.id);
    } catch (err: any) {
      console.error(`[AUCTION] CRITICAL: Failed to refund previous bidder ${auction.current_bidder}: ${err.message}`);
      // Flag failed refund in database for retry
      await supabase.from('art_bids').update({
        refund_failed: true,
        refund_error: err.message,
        refund_failed_at: new Date().toISOString(),
      })
        .eq('auction_id', auction.id)
        .eq('bidder_wallet', auction.current_bidder)
        .eq('refunded', false);
      // Do NOT proceed without refund — throw to prevent accepting new bid
      throw new Error(`Cannot accept bid: refund to previous bidder failed. Their SOL is safe and will be retried.`);
    }
  }

  // Record bid
  await supabase.from('art_bids').insert({
    auction_id: auction.id,
    bidder_wallet: bidderWallet,
    bid_amount: bidAmount,
  });

  // Update auction
  await supabase
    .from('art_auctions')
    .update({
      current_bid: bidAmount,
      current_bidder: bidderWallet,
      bid_count: (auction.bid_count || 0) + 1,
    })
    .eq('id', auction.id);

  return { confirmed: true, auctionId: auction.id };
}

/**
 * Refund a previous bidder from treasury using vault wallet.
 */
async function refundBidder(
  bidderWallet: string,
  amount: number,
  auctionId: number,
): Promise<void> {
  const ix = SystemProgram.transfer({
    fromPubkey: authorityKeypair.publicKey, // vault sends refund
    toPubkey: new PublicKey(bidderWallet),
    lamports: amount,
  });

  const blockhash = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: authorityKeypair.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(msg);
  tx.sign([authorityKeypair]);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  console.log(`[AUCTION] Refunded ${amount} lamports to ${bidderWallet}: ${sig}`);

  // Mark previous bid as refunded
  await supabase
    .from('art_bids')
    .update({ refunded: true, refund_tx: sig })
    .eq('auction_id', auctionId)
    .eq('bidder_wallet', bidderWallet)
    .eq('refunded', false);
}

/**
 * Retry failed refunds — called by crank every 30s.
 */
export async function retryFailedRefunds(): Promise<void> {
  const { data: failed } = await supabase
    .from('art_bids')
    .select('id, auction_id, bidder_wallet, bid_amount')
    .eq('refund_failed', true)
    .eq('refunded', false)
    .limit(5);

  if (!failed || failed.length === 0) return;

  for (const bid of failed) {
    try {
      await refundBidder(bid.bidder_wallet, Number(bid.bid_amount), bid.auction_id);
      // Clear failed flag on success
      await supabase
        .from('art_bids')
        .update({ refund_failed: false, refund_error: null })
        .eq('id', bid.id);
      console.log(`[REFUND-RETRY] Successfully refunded ${bid.bidder_wallet} for ${bid.bid_amount} lamports`);
    } catch (err: any) {
      console.error(`[REFUND-RETRY] Still failing for ${bid.bidder_wallet}: ${err.message}`);
      // Update error message, keep refund_failed = true for next retry
      await supabase
        .from('art_bids')
        .update({ refund_error: err.message, refund_failed_at: new Date().toISOString() })
        .eq('id', bid.id);
    }
  }
}

/**
 * End the current epoch: pick the winner (most votes), create auction or skip.
 */
export async function endEpoch(): Promise<{
  winner: string | null;
  auctionCreated: boolean;
  skipped: boolean;
}> {
  const epoch = await getCurrentEpoch();
  if (!epoch || epoch.finalized) {
    return { winner: null, auctionCreated: false, skipped: false };
  }

  // Check if epoch duration has passed
  const elapsed = (Date.now() - new Date(epoch.start_time).getTime()) / 1000;
  if (elapsed < epoch.duration_seconds) {
    return { winner: null, auctionCreated: false, skipped: false };
  }

  // Get top candidate by votes for this epoch
  const { data: candidates } = await supabase
    .from('art_candidates')
    .select('*')
    .eq('withdrawn', false)
    .eq('won', false)
    .order('votes', { ascending: false })
    .limit(1);

  if (!candidates || candidates.length === 0 || candidates[0].votes === 0) {
    // No candidates or no votes — skip epoch
    await supabase
      .from('auction_epochs')
      .update({
        finalized: true,
        auction_skipped: true,
        end_time: new Date().toISOString(),
      })
      .eq('id', epoch.id);

    // Create next epoch
    await createNextEpoch(epoch.epoch_number + 1, epoch.duration_seconds);

    return { winner: null, auctionCreated: false, skipped: true };
  }

  const winner = candidates[0];
  const cfg = await getConfig();

  // Mark winner
  await supabase
    .from('art_candidates')
    .update({ won: true })
    .eq('mint_address', winner.mint_address);

  // Create auction
  const auctionEnd = new Date(Date.now() + Number(cfg.auction_duration) * 1000);
  await supabase.from('art_auctions').insert({
    epoch_number: epoch.epoch_number,
    art_mint: winner.mint_address,
    art_creator: winner.creator_wallet,
    reserve_bid: Number(cfg.reserve_bid),
    start_time: new Date().toISOString(),
    end_time: auctionEnd.toISOString(),
  });

  // Update epoch
  await supabase
    .from('auction_epochs')
    .update({
      winner_mint: winner.mint_address,
      winner_creator: winner.creator_wallet,
      auction_started: true,
      end_time: new Date().toISOString(),
    })
    .eq('id', epoch.id);

  // Create next epoch immediately — voting never stops
  await createNextEpoch(epoch.epoch_number + 1, epoch.duration_seconds);

  console.log(`[AUCTION] Epoch ${epoch.epoch_number} ended. Winner: ${winner.mint_address} (${winner.votes} votes). Next epoch started.`);

  return { winner: winner.mint_address, auctionCreated: true, skipped: false };
}

/**
 * Settle an auction: transfer NFT to winner, update Status to "Founder Key",
 * pay creator 60% of winning bid.
 */
export async function settleAuction(): Promise<{
  settled: boolean;
  winner?: string;
  amount?: number;
}> {
  // Find unsettled auction that has ended
  const { data: auction, error: aErr } = await supabase
    .from('art_auctions')
    .select('*')
    .eq('settled', false)
    .lte('end_time', new Date().toISOString())
    .order('epoch_number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!auction) return { settled: false };

  const cfg = await getConfig();
  const u = getUmi();

  // No bids — return NFT to creator, skip
  if (!auction.current_bidder || Number(auction.current_bid) === 0) {
    // Transfer NFT back to creator
    await transferV1(u, {
      asset: publicKey(auction.art_mint),
      collection: publicKey(cfg.collection_address),
      newOwner: publicKey(auction.art_creator),
      authority: u.identity,
    }).sendAndConfirm(u);

    await supabase
      .from('art_auctions')
      .update({ settled: true })
      .eq('id', auction.id);

    // Finalize epoch (next epoch already created by endEpoch)
    await supabase
      .from('auction_epochs')
      .update({ finalized: true })
      .eq('epoch_number', auction.epoch_number);

    console.log(`[AUCTION] Auction ${auction.id} settled with no bids — NFT returned to creator`);
    return { settled: true };
  }

  const winnerWallet = auction.current_bidder;
  const winAmount = Number(auction.current_bid);

  // 1. Transfer NFT from vault to winner
  await transferV1(u, {
    asset: publicKey(auction.art_mint),
    collection: publicKey(cfg.collection_address),
    newOwner: publicKey(winnerWallet),
    authority: u.identity,
  }).sendAndConfirm(u);

  // 2. Update Status attribute to "Founder Key"
  try {
    const updateAttr = updatePlugin(u, {
      asset: publicKey(auction.art_mint),
      collection: publicKey(cfg.collection_address),
      authority: authoritySigner,
      plugin: {
        type: 'Attributes',
        attributeList: [
          { key: 'Status', value: 'Founder Key' },
          { key: 'Creator', value: auction.art_creator },
          { key: 'Epoch', value: String(auction.epoch_number) },
        ],
      },
    });
    await updateAttr.sendAndConfirm(u);
  } catch (err: any) {
    console.error(`[AUCTION] Failed to update attributes: ${err.message}`);
    // Non-fatal — NFT transferred successfully
  }

  // 3. Revenue split: 60% creator, 20% voter rewards, 10% team, 10% growth
  const creatorShare = Math.floor(winAmount * 0.6);
  const voterRewardsPool = Math.floor(winAmount * 0.2);
  const teamShare = Math.floor(winAmount * 0.1);
  const growthShare = Math.floor(winAmount * 0.1);

  const teamWallet = process.env.TEAM_WALLET || authorityKeypair.publicKey.toString();
  const growthWallet = process.env.GROWTH_WALLET || authorityKeypair.publicKey.toString();

  // Helper to send SOL from authority
  const sendSol = async (to: string, lamports: number, label: string) => {
    if (lamports <= 0) return;
    try {
      const ix = SystemProgram.transfer({
        fromPubkey: authorityKeypair.publicKey,
        toPubkey: new PublicKey(to),
        lamports,
      });
      const blockhash = await connection.getLatestBlockhash();
      const msg = new TransactionMessage({
        payerKey: authorityKeypair.publicKey,
        recentBlockhash: blockhash.blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(msg);
      tx.sign([authorityKeypair]);
      const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });
      console.log(`[AUCTION] Paid ${label} ${lamports} lamports: ${sig}`);
    } catch (err: any) {
      console.error(`[AUCTION] Failed to pay ${label}: ${err.message}`);
    }
  };

  await sendSol(auction.art_creator, creatorShare, 'creator');
  await sendSol(teamWallet, teamShare, 'team');
  await sendSol(growthWallet, growthShare, 'growth');

  // Calculate and store voter rewards (20% pool)
  try {
    await calculateVoterRewards(auction.epoch_number, voterRewardsPool, auction.art_mint);
  } catch (err: any) {
    console.error(`[AUCTION] Failed to calculate voter rewards: ${err.message}`);
  }

  // 4. Record founder key entry
  await supabase.from('art_entries').upsert({
    mint_address: auction.art_mint,
    creator_wallet: auction.art_creator,
    owner_wallet: winnerWallet,
    is_founder_key: true,
    epoch_won: auction.epoch_number,
  }, { onConflict: 'mint_address' });

  // 5. Update config
  await supabase
    .from('auction_config')
    .update({
      total_founder_keys: cfg.total_founder_keys + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  // 6. Mark auction settled
  await supabase
    .from('art_auctions')
    .update({ settled: true })
    .eq('id', auction.id);

  // 7. Mark epoch finalized (next epoch already created by endEpoch)
  await supabase
    .from('auction_epochs')
    .update({ finalized: true })
    .eq('epoch_number', auction.epoch_number);

  console.log(`[AUCTION] Auction ${auction.id} settled! Winner: ${winnerWallet}, Amount: ${winAmount}`);

  return { settled: true, winner: winnerWallet, amount: winAmount };
}

/**
 * Get the current epoch (latest non-finalized, or create first).
 */
export async function getCurrentEpoch() {
  const { data, error } = await supabase
    .from('auction_epochs')
    .select('*')
    .eq('finalized', false)
    .order('epoch_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) return data;

  // No active epoch — check if any exist
  const { data: latest } = await supabase
    .from('auction_epochs')
    .select('*')
    .order('epoch_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    // First ever epoch
    return createNextEpoch(1, 86400);
  }

  // All finalized — create next
  return createNextEpoch(latest.epoch_number + 1, latest.duration_seconds);
}

async function createNextEpoch(epochNumber: number, durationSeconds: number) {
  const { data, error } = await supabase
    .from('auction_epochs')
    .insert({
      epoch_number: epochNumber,
      duration_seconds: durationSeconds,
      start_time: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`createNextEpoch: ${error.message}`);

  // Update config
  await supabase
    .from('auction_config')
    .update({
      current_epoch: epochNumber,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  console.log(`[AUCTION] Created epoch ${epochNumber}`);
  return data;
}

/**
 * Get leaderboard for an epoch (or current).
 */
export async function getLeaderboard(epochNumber?: number) {
  const epoch = epochNumber || (await getCurrentEpoch()).epoch_number;

  const { data, error } = await supabase
    .from('art_candidates')
    .select('*')
    .eq('withdrawn', false)
    .eq('won', false)
    .order('votes', { ascending: false });

  if (error) throw new Error(`getLeaderboard: ${error.message}`);
  return data || [];
}

/**
 * Get the current/latest auction.
 */
export async function getAuction(epochNumber?: number) {
  let query = supabase.from('art_auctions').select('*');

  if (epochNumber) {
    query = query.eq('epoch_number', epochNumber);
  } else {
    query = query.order('epoch_number', { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`getAuction: ${error.message}`);
  return data;
}

/**
 * Get all active (unsettled) auctions, ordered by end time.
 */
export async function getActiveAuctions() {
  const { data, error } = await supabase
    .from('art_auctions')
    .select('*')
    .eq('settled', false)
    .order('end_time', { ascending: true });

  if (error) throw new Error(`getActiveAuctions: ${error.message}`);
  return data || [];
}

/**
 * Get all active (non-withdrawn, non-won) candidates.
 */
export async function getCandidates() {
  const { data, error } = await supabase
    .from('art_candidates')
    .select('*')
    .eq('withdrawn', false)
    .order('votes', { ascending: false });

  if (error) throw new Error(`getCandidates: ${error.message}`);
  return data || [];
}

/**
 * Verify wallet holds an NFT from a given collection via Helius DAS API.
 */
/**
 * Check if wallet holds an NFT from a specific collection via Helius DAS.
 * Fails RESTRICTIVE — if DAS errors, returns false (no free vote).
 */
export async function verifyHolder(wallet: string, collectionAddress: string): Promise<boolean> {
  return (await countHoldings(wallet, collectionAddress)) > 0;
}

/**
 * Count how many NFTs a wallet holds from a specific collection via Helius DAS.
 * Fails RESTRICTIVE — if DAS errors, returns 0.
 */
export async function countHoldings(wallet: string, collectionAddress: string): Promise<number> {
  const resp = await fetch(config.heliusRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'holder-check',
      method: 'searchAssets',
      params: {
        ownerAddress: wallet,
        grouping: ['collection', collectionAddress],
        page: 1,
        limit: 1000,
      },
    }),
  });
  const json = await resp.json() as any;
  return json.result?.total || 0;
}

/**
 * Check if wallet holds a Fellow Villains NFT OR a Founder Key (art collection NFT).
 */
export async function verifyVoteEligibility(wallet: string, cfg: any): Promise<boolean> {
  // ⚠️ DEVNET ONLY — bypass DAS holder check for testing
  // TODO(MAINNET): REMOVE this block before mainnet launch!
  if (process.env.DEVNET_BYPASS_DAS === 'true') return true;

  // Check Fellow Villains collection
  if (cfg.fellow_villains_collection) {
    const holdsFV = await verifyHolder(wallet, cfg.fellow_villains_collection);
    if (holdsFV) return true;
  }

  // Check art collection (Founder Key holders)
  if (cfg.collection_address) {
    const holdsArt = await verifyHolder(wallet, cfg.collection_address);
    if (holdsArt) return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// VOTER REWARDS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate and store voter rewards for an epoch.
 * Only voters who voted FOR the winning art get rewards.
 * Free votes (holder) = 2x weight, paid votes = 1x weight.
 */
export async function calculateVoterRewards(
  epochNumber: number,
  rewardsPoolLamports: number,
  winnerMint: string,
): Promise<void> {
  if (rewardsPoolLamports <= 0) return;

  // Get all votes for the winning candidate in this epoch
  const { data: votes, error } = await supabase
    .from('art_votes')
    .select('*')
    .eq('epoch_number', epochNumber)
    .eq('candidate_mint', winnerMint);

  if (error) throw new Error(`calculateVoterRewards: ${error.message}`);
  if (!votes || votes.length === 0) {
    console.log(`[AUCTION] No votes for winner in epoch ${epochNumber}, voter rewards pool returned to protocol`);
    return;
  }

  // Calculate weighted shares
  // vote_type 'free' = 2x weight per vote, 'paid' = 1x weight per vote
  const voterWeights: Record<string, number> = {};
  let totalWeight = 0;

  for (const vote of votes) {
    const weight = vote.vote_type === 'free' ? 2 * (vote.num_votes || 1) : 1 * (vote.num_votes || 1);
    voterWeights[vote.voter_wallet] = (voterWeights[vote.voter_wallet] || 0) + weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return;

  // Insert reward records
  const rewards = Object.entries(voterWeights).map(([wallet, weight]) => ({
    voter_wallet: wallet,
    epoch_number: epochNumber,
    weight,
    total_weight: totalWeight,
    reward_lamports: Math.floor((weight / totalWeight) * rewardsPoolLamports),
    claimed: false,
  }));

  const { error: insertErr } = await supabase.from('voter_rewards').insert(rewards);
  if (insertErr) throw new Error(`calculateVoterRewards insert: ${insertErr.message}`);

  console.log(`[AUCTION] Voter rewards calculated for epoch ${epochNumber}: ${rewards.length} voters, ${rewardsPoolLamports} lamports pool`);
}

/**
 * Get voter rewards for a wallet (pending + claimed).
 */
export async function getVoterRewards(wallet: string): Promise<{
  pending: Array<{ epoch_number: number; reward_lamports: number; weight: number; total_weight: number }>;
  claimed: Array<{ epoch_number: number; reward_lamports: number; claim_tx: string }>;
  totalPending: number;
  totalClaimed: number;
}> {
  const { data: all, error } = await supabase
    .from('voter_rewards')
    .select('*')
    .eq('voter_wallet', wallet)
    .order('epoch_number', { ascending: false });

  if (error) throw new Error(`getVoterRewards: ${error.message}`);

  const pending = (all || []).filter((r: any) => !r.claimed).map((r: any) => ({
    epoch_number: r.epoch_number,
    reward_lamports: r.reward_lamports,
    weight: r.weight,
    total_weight: r.total_weight,
  }));

  const claimed = (all || []).filter((r: any) => r.claimed).map((r: any) => ({
    epoch_number: r.epoch_number,
    reward_lamports: r.reward_lamports,
    claim_tx: r.claim_tx,
  }));

  return {
    pending,
    claimed,
    totalPending: pending.reduce((sum: number, r: any) => sum + r.reward_lamports, 0),
    totalClaimed: claimed.reduce((sum: number, r: any) => sum + r.reward_lamports, 0),
  };
}

/**
 * Claim all pending voter rewards for a wallet.
 * Server-signed SOL transfer from authority to voter.
 */
export async function claimVoterRewards(wallet: string): Promise<{
  claimed: boolean;
  amount: number;
  signature?: string;
}> {
  getUmi(); // ensure authority is initialized

  const { data: pending, error } = await supabase
    .from('voter_rewards')
    .select('*')
    .eq('voter_wallet', wallet)
    .eq('claimed', false);

  if (error) throw new Error(`claimVoterRewards: ${error.message}`);
  if (!pending || pending.length === 0) {
    return { claimed: false, amount: 0 };
  }

  const totalAmount = pending.reduce((sum: number, r: any) => sum + Number(r.reward_lamports), 0);
  if (totalAmount <= 0) return { claimed: false, amount: 0 };

  // Send SOL from authority to voter
  const ix = SystemProgram.transfer({
    fromPubkey: authorityKeypair.publicKey,
    toPubkey: new PublicKey(wallet),
    lamports: totalAmount,
  });

  const blockhash = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: authorityKeypair.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(msg);
  tx.sign([authorityKeypair]);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  // Wait for confirmation
  await connection.confirmTransaction(sig, 'confirmed');

  // Mark all as claimed
  const ids = pending.map((r: any) => r.id);
  await supabase
    .from('voter_rewards')
    .update({ claimed: true, claim_tx: sig, claimed_at: new Date().toISOString() })
    .in('id', ids);

  console.log(`[AUCTION] Voter rewards claimed: ${wallet} received ${totalAmount} lamports (${sig})`);

  return { claimed: true, amount: totalAmount, signature: sig };
}
