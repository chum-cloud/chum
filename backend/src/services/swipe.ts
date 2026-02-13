import { createClient } from '@supabase/supabase-js';
import {
  Keypair,
  SystemProgram,
  PublicKey,
  Connection,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { config } from '../config';
import { countHoldings, getCurrentEpoch } from './auction';

// ─── Supabase Client ───
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// ─── Solana Connection ───
const connection = new Connection(config.heliusRpcUrl, 'confirmed');

// ─── Authority Wallet ───
let authorityKeypair: Keypair | null = null;

function getAuthorityKeypair(): Keypair {
  if (!authorityKeypair) {
    const signingKey = config.chumSigningKey;
    let keyBytes: number[];
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
  }
  return authorityKeypair;
}

// ─── Config ───
const SEEKER_GENESIS_COLLECTION = process.env.SEEKER_GENESIS_COLLECTION || 'PLACEHOLDER_SEEKER_COLLECTION';
// TODO: Swap to mainnet collection addresses before launch
const FELLOW_VILLAINS_COLLECTION = 'EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7'; // mainnet
const FOUNDER_KEY_COLLECTION = 'EJQ2PEDdLyijY8VnqJ5jqg4TUmKpQLjiZatdc5qhRMcv'; // TODO: devnet v2 — swap to mainnet collection
const SEEKER_FREE_VOTES = 3;
const VOTE_PACK_PRICE_LAMPORTS = 20_000_000; // 0.02 SOL per vote pack (fixed)
const VOTE_PACK_SIZE = 10;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate free daily yes-swipes for a wallet.
 * - Seeker Genesis Token: 3 free
 * - Each Fellow Villain NFT: 1 free
 * - Each Founder Key NFT: 1 free
 * - These all stack
 */
async function calculateFreeVotes(wallet: string): Promise<{
  seekerVotes: number;
  nftVotes: number;
  total: number;
  nftCount: number;
  hasSeeker: boolean;
}> {
  // Devnet bypass: give 5 free votes without DAS check (remove before mainnet!)
  // TODO: REMOVE BEFORE MAINNET
  if (process.env.DEVNET_BYPASS_DAS === 'true') {
    return { seekerVotes: 3, nftVotes: 2, total: 5, nftCount: 2, hasSeeker: true };
  }

  // Check all holdings in parallel
  const [seekerCount, fvCount, fkCount] = await Promise.all([
    countHoldings(wallet, SEEKER_GENESIS_COLLECTION),
    countHoldings(wallet, FELLOW_VILLAINS_COLLECTION),
    countHoldings(wallet, FOUNDER_KEY_COLLECTION),
  ]);

  const hasSeeker = seekerCount > 0;
  const seekerVotes = hasSeeker ? SEEKER_FREE_VOTES : 0;
  const nftCount = fvCount + fkCount;
  const nftVotes = nftCount; // 1 per NFT held

  return {
    seekerVotes,
    nftVotes,
    total: seekerVotes + nftVotes,
    nftCount,
    hasSeeker,
  };
}

async function getDailySwipeCount(wallet: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('daily_swipes')
    .select('swipe_count')
    .eq('wallet', wallet)
    .eq('date', today)
    .maybeSingle();
  return data?.swipe_count || 0;
}

async function incrementDailySwipes(wallet: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('daily_swipes')
    .select('id, swipe_count')
    .eq('wallet', wallet)
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('daily_swipes')
      .update({ swipe_count: existing.swipe_count + 1 })
      .eq('id', existing.id);
  } else {
    await supabase.from('daily_swipes').insert({
      wallet,
      date: today,
      swipe_count: 1,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// SERVICE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get next art piece to judge for a wallet.
 */
export async function getNextSwipe(
  wallet: string,
  epochNumber: number,
): Promise<any | null> {
  const { data: swiped } = await supabase
    .from('swipe_predictions')
    .select('candidate_mint')
    .eq('wallet', wallet)
    .eq('epoch_number', epochNumber);

  const swipedMints = (swiped || []).map((s: any) => s.candidate_mint);

  const { data: candidates, error } = await supabase
    .from('art_candidates')
    .select('*')
    .eq('withdrawn', false)
    .eq('won', false);

  if (error) throw new Error(`getNextSwipe: ${error.message}`);
  if (!candidates || candidates.length === 0) return null;

  const remaining = candidates.filter(
    (c: any) => !swipedMints.includes(c.mint_address),
  );

  if (remaining.length === 0) return null;

  const idx = Math.floor(Math.random() * remaining.length);
  return remaining[idx];
}

/**
 * Submit a swipe prediction.
 * LEFT = skip (free, unlimited, no vote counted)
 * RIGHT = vote yes (costs 1 free vote or 1 from purchased pack)
 */
export async function submitSwipe(
  wallet: string,
  candidateMint: string,
  epochNumber: number,
  direction: 'left' | 'right',
): Promise<{ success: boolean; totalVotes?: number; freeRemaining?: number }> {

  // LEFT swipe is always free — just record prediction, no vote cost
  if (direction === 'left') {
    const { error: insertErr } = await supabase.from('swipe_predictions').insert({
      wallet,
      candidate_mint: candidateMint,
      epoch_number: epochNumber,
      direction,
    });

    if (insertErr) {
      if (insertErr.message.includes('idx_swipe_unique') || insertErr.message.includes('duplicate')) {
        throw new Error('Already swiped on this piece this epoch');
      }
      throw new Error(`submitSwipe: ${insertErr.message}`);
    }

    return { success: true };
  }

  // RIGHT swipe = vote yes — costs 1 vote
  const freeVotes = await calculateFreeVotes(wallet);
  const usedToday = await getDailySwipeCount(wallet);

  let usedFreeVote = false;

  if (usedToday < freeVotes.total) {
    // Has free votes remaining
    usedFreeVote = true;
  } else {
    // Check purchased vote packs
    const { data: packs } = await supabase
      .from('vote_packs')
      .select('id, votes_remaining')
      .eq('wallet', wallet)
      .gt('votes_remaining', 0)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!packs || packs.length === 0) {
      throw new Error(
        `No votes remaining. Free: ${freeVotes.total - usedToday <= 0 ? 0 : freeVotes.total - usedToday}/` +
        `${freeVotes.total} used. Buy a vote pack to continue!`
      );
    }

    // Decrement purchased pack
    await supabase
      .from('vote_packs')
      .update({ votes_remaining: packs[0].votes_remaining - 1 })
      .eq('id', packs[0].id);
  }

  // Insert prediction
  const { error: insertErr } = await supabase.from('swipe_predictions').insert({
    wallet,
    candidate_mint: candidateMint,
    epoch_number: epochNumber,
    direction,
  });

  if (insertErr) {
    if (insertErr.message.includes('idx_swipe_unique') || insertErr.message.includes('duplicate')) {
      throw new Error('Already swiped on this piece this epoch');
    }
    throw new Error(`submitSwipe: ${insertErr.message}`);
  }

  // Increment daily counter only for free votes
  if (usedFreeVote) {
    await incrementDailySwipes(wallet);
  }

  // Add vote to candidate
  let totalVotes: number | undefined;
  const { data: candidate } = await supabase
    .from('art_candidates')
    .select('votes')
    .eq('mint_address', candidateMint)
    .single();

  if (candidate) {
    totalVotes = (candidate.votes || 0) + 1;
    await supabase
      .from('art_candidates')
      .update({ votes: totalVotes })
      .eq('mint_address', candidateMint);
  }

  const freeRemaining = Math.max(0, freeVotes.total - (usedToday + 1));

  return { success: true, totalVotes, freeRemaining };
}

/**
 * Get remaining swipe votes for a wallet today.
 */
export async function getSwipeRemaining(wallet: string): Promise<{
  freeRemaining: number;
  freeTotal: number;
  paidRemaining: number;
  hasSeeker: boolean;
  nftCount: number;
  eligible: boolean;
}> {
  const freeVotes = await calculateFreeVotes(wallet);
  const usedToday = await getDailySwipeCount(wallet);
  const freeRemaining = Math.max(0, freeVotes.total - usedToday);

  // Check purchased packs
  const { data: packs } = await supabase
    .from('vote_packs')
    .select('votes_remaining')
    .eq('wallet', wallet)
    .gt('votes_remaining', 0);

  const paidRemaining = (packs || []).reduce(
    (sum: number, p: any) => sum + (p.votes_remaining || 0), 0
  );

  return {
    freeRemaining,
    freeTotal: freeVotes.total,
    paidRemaining,
    hasSeeker: freeVotes.hasSeeker,
    nftCount: freeVotes.nftCount,
    eligible: freeVotes.total > 0 || paidRemaining > 0,
  };
}

/**
 * Buy a vote pack (fixed price, no escalation).
 */
export async function buyVotePack(wallet: string): Promise<{
  transaction: string;
  packSize: number;
  price: number;
}> {
  const kp = getAuthorityKeypair();

  // Build tx: user pays authority
  const ix = SystemProgram.transfer({
    fromPubkey: new PublicKey(wallet),
    toPubkey: kp.publicKey,
    lamports: VOTE_PACK_PRICE_LAMPORTS,
  });

  const blockhash = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: new PublicKey(wallet),
    recentBlockhash: blockhash.blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(msg);
  const serialized = Buffer.from(tx.serialize()).toString('base64');

  return {
    transaction: serialized,
    packSize: VOTE_PACK_SIZE,
    price: VOTE_PACK_PRICE_LAMPORTS,
  };
}

/**
 * Confirm vote pack purchase after user signs.
 */
export async function confirmVotePack(
  wallet: string,
  signature: string,
): Promise<{ success: boolean; votesAdded: number }> {
  // Verify tx on-chain
  const status = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });

  if (!status?.value?.confirmationStatus ||
      !['confirmed', 'finalized'].includes(status.value.confirmationStatus)) {
    // Wait and retry
    await new Promise(r => setTimeout(r, 2000));
    const retry = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    if (!retry?.value?.confirmationStatus ||
        !['confirmed', 'finalized'].includes(retry.value.confirmationStatus)) {
      throw new Error('Transaction not confirmed');
    }
  }

  // Insert vote pack
  const { error } = await supabase.from('vote_packs').insert({
    wallet,
    votes_remaining: VOTE_PACK_SIZE,
    purchase_signature: signature,
    price_lamports: VOTE_PACK_PRICE_LAMPORTS,
  });

  if (error) throw new Error(`confirmVotePack: ${error.message}`);

  return { success: true, votesAdded: VOTE_PACK_SIZE };
}

/**
 * Get prediction stats for a wallet.
 */
export async function getSwipeStats(wallet: string): Promise<{
  totalSwipes: number;
  correctPredictions: number;
  currentStreak: number;
  totalEarnings: number;
}> {
  const { data: swipes } = await supabase
    .from('swipe_predictions')
    .select('correct, reward_lamports')
    .eq('wallet', wallet)
    .order('created_at', { ascending: false });

  if (!swipes || swipes.length === 0) {
    return { totalSwipes: 0, correctPredictions: 0, currentStreak: 0, totalEarnings: 0 };
  }

  const totalSwipes = swipes.length;
  const correctPredictions = swipes.filter((s: any) => s.correct === true).length;
  const totalEarnings = swipes.reduce((sum: number, s: any) => sum + (Number(s.reward_lamports) || 0), 0);

  let currentStreak = 0;
  for (const s of swipes) {
    if (s.correct === true) currentStreak++;
    else if (s.correct !== null) break;
  }

  return { totalSwipes, correctPredictions, currentStreak, totalEarnings };
}

/**
 * Mark correct predictions after epoch ends.
 */
export async function markCorrectPredictions(
  epochNumber: number,
  winnerMint: string,
): Promise<void> {
  // right swipe on winner = correct
  await supabase
    .from('swipe_predictions')
    .update({ correct: true })
    .eq('epoch_number', epochNumber)
    .eq('candidate_mint', winnerMint)
    .eq('direction', 'right')
    .is('correct', null);

  // everything else = incorrect
  await supabase
    .from('swipe_predictions')
    .update({ correct: false })
    .eq('epoch_number', epochNumber)
    .is('correct', null);

  console.log(`[SWIPE] Marked predictions for epoch ${epochNumber}, winner: ${winnerMint}`);
}

/**
 * Calculate prediction rewards after auction settles.
 */
export async function calculatePredictionRewards(
  epochNumber: number,
  auctionRevenue: number,
): Promise<void> {
  if (auctionRevenue <= 0) return;

  const rewardPool = Math.floor(auctionRevenue * 0.1); // 10%

  const { data: epoch } = await supabase
    .from('auction_epochs')
    .select('start_time')
    .eq('epoch_number', epochNumber)
    .single();

  if (!epoch) return;
  const epochStart = new Date(epoch.start_time).getTime();

  const { data: correct } = await supabase
    .from('swipe_predictions')
    .select('id, created_at')
    .eq('epoch_number', epochNumber)
    .eq('correct', true);

  if (!correct || correct.length === 0) return;

  const weighted = correct.map((p: any) => {
    const minutesSinceStart = (new Date(p.created_at).getTime() - epochStart) / 60000;
    const weight = 1 / (1 + Math.max(0, minutesSinceStart) / 60);
    return { id: p.id, weight };
  });

  const totalWeight = weighted.reduce((sum: number, w: any) => sum + w.weight, 0);

  for (const w of weighted) {
    const reward = Math.floor((w.weight / totalWeight) * rewardPool);
    if (reward > 0) {
      await supabase
        .from('swipe_predictions')
        .update({ reward_lamports: reward })
        .eq('id', w.id);
    }
  }

  console.log(`[SWIPE] Distributed ${rewardPool} lamports across ${correct.length} correct predictions for epoch ${epochNumber}`);
}

/**
 * Claim unclaimed prediction rewards.
 */
export async function claimPredictionRewards(wallet: string): Promise<{
  amount: number;
  signature: string;
}> {
  const { data: unclaimed } = await supabase
    .from('swipe_predictions')
    .select('id, reward_lamports')
    .eq('wallet', wallet)
    .eq('claimed', false)
    .gt('reward_lamports', 0);

  if (!unclaimed || unclaimed.length === 0) {
    throw new Error('No unclaimed rewards');
  }

  const totalAmount = unclaimed.reduce(
    (sum: number, r: any) => sum + Number(r.reward_lamports), 0
  );

  if (totalAmount <= 0) throw new Error('No rewards to claim');

  const kp = getAuthorityKeypair();
  const ix = SystemProgram.transfer({
    fromPubkey: kp.publicKey,
    toPubkey: new PublicKey(wallet),
    lamports: totalAmount,
  });

  const blockhash = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: kp.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(msg);
  tx.sign([kp]);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  const ids = unclaimed.map((r: any) => r.id);
  await supabase
    .from('swipe_predictions')
    .update({ claimed: true })
    .in('id', ids);

  console.log(`[SWIPE] Claimed ${totalAmount} lamports for ${wallet}: ${signature}`);

  return { amount: totalAmount, signature };
}
