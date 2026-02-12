import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createCollection,
  create,
  transfer,
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
async function getConfig() {
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
): Promise<{ transaction: string; assetAddress: string; mintNumber: number }> {
  const cfg = await getConfig();
  if (cfg.paused) throw new Error('Auction system is paused');

  const u = getUmi();
  const assetSigner = generateSigner(u);
  const minterPubkey = publicKey(creatorWallet);

  const collection = await fetchCollectionV1(u, publicKey(cfg.collection_address));

  // Increment mint counter
  const mintNumber = cfg.total_minted + 1;
  const nftName = name || `CHUM: Reanimated #${String(mintNumber).padStart(4, '0')}`;

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

  // Add mint fee: user → team wallet
  const feeIx = SystemProgram.transfer({
    fromPubkey: new PublicKey(creatorWallet),
    toPubkey: new PublicKey(cfg.team_wallet),
    lamports: Number(cfg.mint_fee),
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

  const collection = await fetchCollectionV1(u, publicKey(cfg.collection_address));

  // Build transfer: user → vault
  const transferBuilder = transfer(u, {
    asset: publicKey(mintAddress) as any,
    collection: collection as any,
    newOwner: u.identity.publicKey, // vault
  });

  // Add join fee: user → treasury
  const feeIx = SystemProgram.transfer({
    fromPubkey: new PublicKey(creatorWallet),
    toPubkey: new PublicKey(cfg.treasury_wallet),
    lamports: Number(cfg.join_fee),
  });
  const umiFeeIx = fromWeb3JsInstruction(feeIx);
  const feeBuilder = transactionBuilder().add({
    instruction: umiFeeIx,
    signers: [],
    bytesCreatedOnChain: 0,
  });

  const combined = transferBuilder.add(feeBuilder);
  const tx = await combined.buildWithLatestBlockhash(u);

  // Vault doesn't need to sign the transfer (user is current owner)
  // But we sign anyway in case collection authority is needed
  const signedTx = await u.identity.signTransaction(tx);

  // Do NOT insert candidate here — wait for confirmJoin after user signs

  return {
    transaction: serializeUmiTx(signedTx, u),
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
): Promise<{ confirmed: boolean; name: string }> {
  const sig = await connection.confirmTransaction(signature, 'confirmed');
  if (sig.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(sig.value.err)}`);
  }

  const u = getUmi();
  const cfg = await getConfig();
  const asset = await fetchAssetV1(u, publicKey(mintAddress));

  // Verify NFT is now owned by our authority (vault)
  if (asset.owner.toString() !== u.identity.publicKey.toString()) {
    throw new Error('NFT was not transferred to vault — join not confirmed');
  }

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

  return { confirmed: true, name: asset.name };
}

/**
 * Free vote: 1 free vote per wallet per epoch per candidate.
 * Requires voter to hold a Fellow Villains NFT (verified via Helius DAS).
 */
export async function voteFree(
  voterWallet: string,
  candidateMint: string,
  epochNumber?: number,
): Promise<{ success: boolean; totalVotes: number }> {
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

  // Insert free vote (unique constraint will reject duplicates)
  const { error: voteErr } = await supabase.from('art_votes').insert({
    voter_wallet: voterWallet,
    candidate_mint: candidateMint,
    epoch_number: epNum,
    num_votes: 1,
    is_paid: false,
    cost_lamports: 0,
  });

  if (voteErr) {
    if (voteErr.message.includes('idx_free_vote_unique') || voteErr.message.includes('duplicate')) {
      throw new Error('Already used free vote for this candidate this epoch');
    }
    throw new Error(`Vote failed: ${voteErr.message}`);
  }

  // Increment vote count on candidate
  const newVotes = (candidate.votes || 0) + 1;
  await supabase
    .from('art_candidates')
    .update({ votes: newVotes })
    .eq('mint_address', candidateMint);

  return { success: true, totalVotes: newVotes };
}

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
    ? Math.floor(Number(auction.current_bid) * 1.05) // 5% minimum increment
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

  // Refund previous bidder if exists
  if (auction.current_bidder && Number(auction.current_bid) > 0) {
    try {
      await refundBidder(auction.current_bidder, Number(auction.current_bid), auction.id);
    } catch (err: any) {
      console.error(`[AUCTION] Failed to refund previous bidder: ${err.message}`);
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

  console.log(`[AUCTION] Epoch ${epoch.epoch_number} ended. Winner: ${winner.mint_address} (${winner.votes} votes)`);

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
    const collection = await fetchCollectionV1(u, publicKey(cfg.collection_address));
    const transferBack = transfer(u, {
      asset: publicKey(auction.art_mint),
      collection,
      newOwner: publicKey(auction.art_creator),
      authority: authoritySigner,
    });
    await transferBack.sendAndConfirm(u);

    await supabase
      .from('art_auctions')
      .update({ settled: true })
      .eq('id', auction.id);

    // Finalize epoch + create next
    await supabase
      .from('auction_epochs')
      .update({ finalized: true })
      .eq('epoch_number', auction.epoch_number);

    await createNextEpoch(auction.epoch_number + 1, Number(cfg.epoch_duration));

    console.log(`[AUCTION] Auction ${auction.id} settled with no bids — NFT returned to creator`);
    return { settled: true };
  }

  const winnerWallet = auction.current_bidder;
  const winAmount = Number(auction.current_bid);

  // 1. Transfer NFT from vault to winner
  const collection = await fetchCollectionV1(u, publicKey(cfg.collection_address));
  const transferToWinner = transfer(u, {
    asset: publicKey(auction.art_mint),
    collection,
    newOwner: publicKey(winnerWallet),
    authority: authoritySigner,
  });
  await transferToWinner.sendAndConfirm(u);

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

  // 3. Pay creator 60% of winning bid
  const creatorShare = Math.floor(winAmount * 0.6);
  if (creatorShare > 0) {
    try {
      const payIx = SystemProgram.transfer({
        fromPubkey: authorityKeypair.publicKey,
        toPubkey: new PublicKey(auction.art_creator),
        lamports: creatorShare,
      });
      const blockhash = await connection.getLatestBlockhash();
      const msg = new TransactionMessage({
        payerKey: authorityKeypair.publicKey,
        recentBlockhash: blockhash.blockhash,
        instructions: [payIx],
      }).compileToV0Message();
      const payTx = new VersionedTransaction(msg);
      payTx.sign([authorityKeypair]);
      const paySig = await connection.sendRawTransaction(payTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });
      console.log(`[AUCTION] Paid creator ${creatorShare} lamports: ${paySig}`);
    } catch (err: any) {
      console.error(`[AUCTION] Failed to pay creator: ${err.message}`);
    }
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

  // 7. Finalize epoch + create next
  await supabase
    .from('auction_epochs')
    .update({ finalized: true })
    .eq('epoch_number', auction.epoch_number);

  await createNextEpoch(auction.epoch_number + 1, Number(cfg.epoch_duration));

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
async function verifyHolder(wallet: string, collectionAddress: string): Promise<boolean> {
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
        limit: 1,
      },
    }),
  });
  const json = await resp.json() as any;
  return (json.result?.total || 0) > 0;
}

/**
 * Check if wallet holds a Fellow Villains NFT OR a Founder Key (art collection NFT).
 */
async function verifyVoteEligibility(wallet: string, cfg: any): Promise<boolean> {
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
