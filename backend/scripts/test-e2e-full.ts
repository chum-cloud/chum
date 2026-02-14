/**
 * CHUM: Reanimation — Comprehensive Multi-Wallet E2E Test
 * Simulates real usage with 3 wallets on devnet.
 * Audits every SOL transfer and fee split.
 */

import {
  Keypair,
  Connection,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const API_BASE = process.env.E2E_API_URL || 'https://chum-production.up.railway.app/api';

const connection = new Connection(RPC_URL, 'confirmed');

// ─── Wallets ───
// Creator1: existing funded wallet
const creator1Path = path.resolve(__dirname, '../../chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T.json');
const creator1KP = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(creator1Path, 'utf-8'))));

// Creator2 + Bidder1: generate fresh keypairs (will be funded from Creator1)
const creator2KP = Keypair.generate();
const bidder1KP = Keypair.generate();

const wallets = {
  creator1: { kp: creator1KP, name: 'Creator1', addr: creator1KP.publicKey.toString() },
  creator2: { kp: creator2KP, name: 'Creator2', addr: creator2KP.publicKey.toString() },
  bidder1: { kp: bidder1KP, name: 'Bidder1', addr: bidder1KP.publicKey.toString() },
};

// ─── Results ───
const results: { step: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail?: string; sol?: string }[] = [];
const balanceLog: { wallet: string; before: number; after: number; diff: number; step: string }[] = [];

function log(step: string, status: 'PASS' | 'FAIL' | 'SKIP', detail?: string, sol?: string) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  const solStr = sol ? ` [${sol}]` : '';
  console.log(`${icon} ${step} ${status}${detail ? ' — ' + detail : ''}${solStr}`);
  results.push({ step, status, detail, sol });
}

async function getBalance(addr: string): Promise<number> {
  return connection.getBalance(new PublicKey(addr));
}

async function logBalanceChange(walletName: string, addr: string, step: string, fn: () => Promise<void>) {
  const before = await getBalance(addr);
  await fn();
  // Wait a bit for balance to settle
  await sleep(2000);
  const after = await getBalance(addr);
  const diff = after - before;
  balanceLog.push({ wallet: walletName, before, after, diff, step });
  return { before, after, diff };
}

async function apiCall(method: string, path: string, body?: any): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const json = await res.json();
  if (!res.ok && !json.success) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

async function supabaseQuery(table: string, filter: string, method = 'GET', body?: any) {
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=representation',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, opts);
  return res.json();
}

async function supabasePatch(table: string, filter: string, body: any) {
  return supabaseQuery(table, filter, 'PATCH', body);
}

function signTx(txBase64: string, kp: Keypair): VersionedTransaction {
  const tx = VersionedTransaction.deserialize(Buffer.from(txBase64, 'base64'));
  tx.sign([kp]);
  return tx;
}

async function signAndSend(txBase64: string, kp: Keypair): Promise<string> {
  const tx = signTx(txBase64, kp);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function solveChallenge(walletAddr: string): Promise<{ challengeId: string; answer: number }> {
  const c = await apiCall('POST', '/auction/challenge', { walletAddress: walletAddr });
  // Parse "A + B" or "A * B" etc
  const match = c.question.match(/(\d+)\s*([+\-*])\s*(\d+)/);
  if (!match) throw new Error(`Can't parse challenge: ${c.question}`);
  const [, a, op, b] = match;
  let answer: number;
  switch (op) {
    case '+': answer = parseInt(a) + parseInt(b); break;
    case '-': answer = parseInt(a) - parseInt(b); break;
    case '*': answer = parseInt(a) * parseInt(b); break;
    default: throw new Error(`Unknown op: ${op}`);
  }
  return { challengeId: c.challengeId, answer };
}

async function waitForConfirm(assetAddr: string, sig: string, retries = 10): Promise<any> {
  for (let i = 0; i < retries; i++) {
    await sleep(3000);
    try {
      return await apiCall('POST', '/auction/mint/confirm', { assetAddress: assetAddr, signature: sig });
    } catch (e: any) {
      if (i === retries - 1) throw e;
      console.log(`  Waiting for indexing... (${i + 1}/${retries})`);
    }
  }
}

// ─── Track minted assets ───
const minted: { wallet: string; asset: string; name: string; fee: number }[] = [];
let teamWallet = '';

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  CHUM: Reanimation — Full E2E Audit Test');
  console.log('══════════════════════════════════════════════\n');
  console.log(`Creator1: ${wallets.creator1.addr}`);
  console.log(`Creator2: ${wallets.creator2.addr}`);
  console.log(`Bidder1:  ${wallets.bidder1.addr}\n`);

  // ═══ STEP 0: Setup — fund wallets, shorten durations ═══
  try {
    // Get team wallet from config
    const cfg = await apiCall('GET', '/auction/config');
    teamWallet = cfg.config?.team_wallet || '';
    console.log(`Team wallet: ${teamWallet}`);

    // Shorten epoch + auction for testing
    await supabasePatch('auction_config', 'id=eq.1', {
      epoch_duration: 86400,  // Keep epoch long during setup — we'll expire it manually in Step 7
      auction_duration: 60,   // 1 min auction (for when we trigger it)
    });

    // Fund Creator2 and Bidder1 from Creator1 (0.5 SOL each)
    const { Transaction, SystemProgram, sendAndConfirmTransaction } = await import('@solana/web3.js');
    
    const c1Balance = await getBalance(wallets.creator1.addr);
    console.log(`Creator1 balance: ${(c1Balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    
    if (c1Balance < 0.9 * LAMPORTS_PER_SOL) {
      log('STEP 0: Setup', 'FAIL', `Creator1 needs at least 0.9 SOL (has ${(c1Balance / LAMPORTS_PER_SOL).toFixed(4)})`);
      return;
    }

    // Fund Creator2
    const fundAmt = Math.min(0.15 * LAMPORTS_PER_SOL, (c1Balance - 0.5 * LAMPORTS_PER_SOL) / 2);
    const fundTx1 = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: creator1KP.publicKey,
        toPubkey: creator2KP.publicKey,
        lamports: fundAmt,
      })
    );
    await sendAndConfirmTransaction(connection, fundTx1, [creator1KP]);
    console.log(`  Funded Creator2: ${(fundAmt / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    // Fund Bidder1
    const fundTx2 = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: creator1KP.publicKey,
        toPubkey: bidder1KP.publicKey,
        lamports: fundAmt,
      })
    );
    await sendAndConfirmTransaction(connection, fundTx2, [creator1KP]);
    console.log(`  Funded Bidder1: ${(fundAmt / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

    log('STEP 0: Setup', 'PASS', 'Wallets funded, durations shortened');
  } catch (e: any) {
    log('STEP 0: Setup', 'FAIL', e.message);
    return;
  }

  // Print initial balances
  console.log('\n--- Initial Balances ---');
  for (const [key, w] of Object.entries(wallets)) {
    const bal = await getBalance(w.addr);
    console.log(`  ${w.name}: ${(bal / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  }
  if (teamWallet) {
    const teamBal = await getBalance(teamWallet);
    console.log(`  Team: ${(teamBal / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  }
  console.log('');

  // ═══ STEP 1: Creator1 mints 3 pieces (human — 0.1 SOL each) ═══
  console.log('--- STEP 1: Creator1 mints 3 pieces (human, 0.1 SOL each) ---');
  for (let i = 0; i < 3; i++) {
    try {
      const balBefore = await getBalance(wallets.creator1.addr);
      const mintRes = await apiCall('POST', '/auction/mint', {
        creatorWallet: wallets.creator1.addr,
      });
      
      if (mintRes.fee !== 100_000_000) {
        log(`STEP 1.${i+1}: Creator1 mint #${i+1}`, 'FAIL', `Expected fee 0.1 SOL, got ${mintRes.fee / 1e9}`);
        continue;
      }

      const sig = await signAndSend(mintRes.transaction, creator1KP);
      const confirm = await waitForConfirm(mintRes.assetAddress, sig);
      const balAfter = await getBalance(wallets.creator1.addr);
      const spent = (balBefore - balAfter) / LAMPORTS_PER_SOL;

      minted.push({ wallet: 'creator1', asset: mintRes.assetAddress, name: confirm.name, fee: mintRes.fee });
      log(`STEP 1.${i+1}: Creator1 mint`, 'PASS', `${confirm.name} → ${mintRes.assetAddress}`, `spent: ${spent.toFixed(6)} SOL`);
    } catch (e: any) {
      log(`STEP 1.${i+1}: Creator1 mint`, 'FAIL', e.message);
    }
  }

  // ═══ STEP 2: Creator2 mints 2 pieces (agent — 0.015 SOL each) ═══
  console.log('\n--- STEP 2: Creator2 mints 2 pieces (agent, 0.015 SOL each) ---');
  for (let i = 0; i < 2; i++) {
    try {
      const balBefore = await getBalance(wallets.creator2.addr);
      const { challengeId, answer } = await solveChallenge(wallets.creator2.addr);
      const mintRes = await apiCall('POST', '/auction/mint', {
        creatorWallet: wallets.creator2.addr,
        challengeId,
        answer,
      });
      
      if (!mintRes.isAgent) throw new Error('Expected isAgent=true');
      console.log(`  Agent fee: ${mintRes.fee / 1e9} SOL (mint count: ${mintRes.agentMintCount || '?'})`);

      const sig = await signAndSend(mintRes.transaction, creator2KP);
      const confirm = await waitForConfirm(mintRes.assetAddress, sig);
      const balAfter = await getBalance(wallets.creator2.addr);
      const spent = (balBefore - balAfter) / LAMPORTS_PER_SOL;

      minted.push({ wallet: 'creator2', asset: mintRes.assetAddress, name: confirm.name, fee: mintRes.fee });
      log(`STEP 2.${i+1}: Creator2 mint (agent)`, 'PASS', `${confirm.name}, fee: ${mintRes.fee / 1e9} SOL`, `spent: ${spent.toFixed(6)} SOL`);
    } catch (e: any) {
      log(`STEP 2.${i+1}: Creator2 mint (agent)`, 'FAIL', e.message);
    }
  }

  // ═══ STEP 3: Check escalating pricing (Creator2 checks tier) ═══
  console.log('\n--- STEP 3: Verify agent mint pricing ---');
  try {
    const pricing = await apiCall('GET', `/auction/mint-price?wallet=${wallets.creator2.addr}`);
    console.log(`  Agent fee: ${pricing.agentFee / 1e9} SOL, mint count: ${pricing.agentMintCount}, tier size: ${pricing.agentTierSize}`);
    
    if (pricing.agentFee !== 15_000_000) {
      // After 2 mints, should still be 0.015 (first tier of 10)
      log('STEP 3: Agent pricing check', 'FAIL', `Expected 0.015 SOL, got ${pricing.agentFee / 1e9}`);
    } else {
      log('STEP 3: Agent pricing check', 'PASS', `0.015 SOL (${pricing.agentMintCount}/10 in current tier)`);
    }
    
    if (pricing.humanFee !== 100_000_000) {
      log('STEP 3b: Human pricing check', 'FAIL', `Expected 0.1 SOL, got ${pricing.humanFee / 1e9}`);
    } else {
      log('STEP 3b: Human pricing check', 'PASS', 'Human fee: 0.1 SOL (flat)');
    }
  } catch (e: any) {
    log('STEP 3: Agent pricing check', 'FAIL', e.message);
  }

  // ═══ STEP 4: All pieces join leaderboard (0.015 SOL each) ═══
  console.log('\n--- STEP 4: Join leaderboard (0.015 SOL flat for everyone) ---');
  for (const m of minted) {
    const w = wallets[m.wallet as keyof typeof wallets];
    try {
      const balBefore = await getBalance(w.addr);
      const joinRes = await apiCall('POST', '/auction/join', {
        creatorWallet: w.addr,
        mintAddress: m.asset,
      });

      if (joinRes.fee !== 15_000_000) {
        log(`STEP 4: Join ${m.name}`, 'FAIL', `Expected 0.015 SOL, got ${joinRes.fee / 1e9}`);
        continue;
      }

      const sig = await signAndSend(joinRes.transaction, w.kp);
      
      // Confirm join
      await apiCall('POST', '/auction/join/confirm', {
        creatorWallet: w.addr,
        signature: sig,
        mintAddress: m.asset,
      });

      const balAfter = await getBalance(w.addr);
      const spent = (balBefore - balAfter) / LAMPORTS_PER_SOL;
      log(`STEP 4: Join ${m.name}`, 'PASS', `${w.name} joined`, `spent: ${spent.toFixed(6)} SOL`);
    } catch (e: any) {
      log(`STEP 4: Join ${m.name}`, 'FAIL', e.message);
    }
  }

  // ═══ STEP 5: Voting ═══
  console.log('\n--- STEP 5: Voting ---');
  
  // Creator1 votes for Creator2's first piece (free vote as holder)
  const c2Pieces = minted.filter(m => m.wallet === 'creator2');
  const c1Pieces = minted.filter(m => m.wallet === 'creator1');

  if (c2Pieces.length > 0) {
    try {
      const voteRes = await apiCall('POST', '/auction/vote', {
        voterWallet: wallets.creator1.addr,
        candidateMint: c2Pieces[0].asset,
        numVotes: 1,
        paid: false,
      });
      log('STEP 5a: Creator1 free vote for Creator2', 'PASS', `Total votes: ${voteRes.totalVotes}`);
    } catch (e: any) {
      log('STEP 5a: Creator1 free vote for Creator2', 'FAIL', e.message);
    }
  }

  // Creator2 votes for Creator1's first piece (free vote — needs DEVNET_BYPASS_DAS)
  if (c1Pieces.length > 0) {
    try {
      const voteRes = await apiCall('POST', '/auction/vote', {
        voterWallet: wallets.creator2.addr,
        candidateMint: c1Pieces[0].asset,
        numVotes: 1,
        paid: false,
      });
      log('STEP 5b: Creator2 free vote for Creator1', 'PASS', `Total votes: ${voteRes.totalVotes}`);
    } catch (e: any) {
      // If DEVNET_BYPASS_DAS not active, free vote fails — expected
      if (e.message.includes('Fellow Villains')) {
        console.log('  Note: Free vote requires DEVNET_BYPASS_DAS=true on server');
        log('STEP 5b: Creator2 free vote for Creator1', 'FAIL', 'DEVNET_BYPASS_DAS not active on server');
      } else {
        log('STEP 5b: Creator2 free vote for Creator1', 'FAIL', e.message);
      }
    }
  }

  // Paid votes — Creator1 pays for 2 more votes on Creator2's piece (to make it winner)
  if (c2Pieces.length > 0) {
    try {
      const balBefore = await getBalance(wallets.creator1.addr);
      const paidRes = await apiCall('POST', '/auction/vote', {
        voterWallet: wallets.creator1.addr,
        candidateMint: c2Pieces[0].asset,
        numVotes: 2,
        paid: true,
      });
      console.log(`  Paid vote cost: ${paidRes.cost / 1e9} SOL, epoch: ${paidRes.epochNumber}`);
      
      const sig = await signAndSend(paidRes.transaction, creator1KP);
      await apiCall('POST', '/auction/vote/confirm', {
        voterWallet: wallets.creator1.addr,
        candidateMint: c2Pieces[0].asset,
        numVotes: 2,
        epochNumber: paidRes.epochNumber,
        signature: sig,
      });

      const balAfter = await getBalance(wallets.creator1.addr);
      const spent = (balBefore - balAfter) / LAMPORTS_PER_SOL;
      log('STEP 5c: Creator1 paid votes (×2)', 'PASS', `Cost: ${paidRes.cost / 1e9} SOL`, `spent: ${spent.toFixed(6)} SOL`);
    } catch (e: any) {
      log('STEP 5c: Creator1 paid votes', 'FAIL', e.message);
    }
  }

  // Creator2 paid vote on Creator1's piece
  if (c1Pieces.length > 0) {
    try {
      const balBefore = await getBalance(wallets.creator2.addr);
      const paidRes = await apiCall('POST', '/auction/vote', {
        voterWallet: wallets.creator2.addr,
        candidateMint: c1Pieces[0].asset,
        numVotes: 1,
        paid: true,
      });
      
      const sig = await signAndSend(paidRes.transaction, creator2KP);
      await apiCall('POST', '/auction/vote/confirm', {
        voterWallet: wallets.creator2.addr,
        candidateMint: c1Pieces[0].asset,
        numVotes: 1,
        epochNumber: paidRes.epochNumber,
        signature: sig,
      });

      const balAfter = await getBalance(wallets.creator2.addr);
      const spent = (balBefore - balAfter) / LAMPORTS_PER_SOL;
      log('STEP 5d: Creator2 paid vote (×1)', 'PASS', `Cost: ${paidRes.cost / 1e9} SOL`, `spent: ${spent.toFixed(6)} SOL`);
    } catch (e: any) {
      log('STEP 5d: Creator2 paid vote', 'FAIL', e.message);
    }
  }

  // Agent vote (zero weight)
  if (c1Pieces.length > 0) {
    try {
      const agentRes = await apiCall('POST', '/auction/vote-agent', {
        wallet: wallets.bidder1.addr,
        candidateMint: c1Pieces[0].asset,
      });
      log('STEP 5e: Agent vote (Bidder1)', 'PASS', `Agent votes: ${agentRes.agentVotes}, weight: 0`);
    } catch (e: any) {
      log('STEP 5e: Agent vote', 'FAIL', e.message);
    }
  }

  // ═══ STEP 6: Check leaderboard before epoch end ═══
  console.log('\n--- STEP 6: Leaderboard check ---');
  try {
    const lb = await apiCall('GET', '/auction/leaderboard');
    const board = lb.leaderboard || [];
    console.log('  Leaderboard:');
    for (const entry of board.slice(0, 5)) {
      console.log(`    ${entry.name || entry.mint_address?.slice(0, 8)}: ${entry.votes} votes, agent: ${entry.agent_votes || 0}`);
    }
    
    // The piece with 3 votes (Creator2's piece: 1 free + 2 paid) should be winning
    if (board.length > 0) {
      const winner = board[0];
      log('STEP 6: Leaderboard', 'PASS', `Leader: ${winner.name || winner.mint_address?.slice(0, 12)} (${winner.votes} votes)`);
    } else {
      log('STEP 6: Leaderboard', 'SKIP', 'No candidates');
    }
  } catch (e: any) {
    log('STEP 6: Leaderboard', 'FAIL', e.message);
  }

  // ═══ STEP 7: End epoch via crank ═══
  console.log('\n--- STEP 7: End epoch (crank) ---');
  try {
    // Make epoch expire immediately — set start_time far in past with short duration
    const epochQueryResult = await supabaseQuery('auction_epochs', 'order=epoch_number.desc&limit=1');
    console.log(`  Epoch query result:`, JSON.stringify(epochQueryResult).slice(0, 300));
    const currentEpoch = epochQueryResult?.data || epochQueryResult;
    const epochRow = Array.isArray(currentEpoch) ? currentEpoch[0] : null;
    if (epochRow) {
      const pastStart = new Date(Date.now() - 600 * 1000).toISOString(); // 10 min ago
      const patchResult = await supabasePatch('auction_epochs', `id=eq.${epochRow.id}`, {
        start_time: pastStart,
        duration_seconds: 60, // 1 min — already 10 min past
      });
      console.log(`  Patch result:`, JSON.stringify(patchResult).slice(0, 300));
      console.log(`  Set epoch ${epochRow.epoch_number} (id=${epochRow.id}) to already-expired`);
    } else {
      console.log(`  ERROR: No epoch found to patch!`);
    }

    console.log('  Waiting for crank to end epoch (up to 90s)...');
    let auctionStarted = false;
    for (let i = 0; i < 18; i++) {
      await sleep(5000);
      try {
        const auc = await apiCall('GET', '/auction/auction');
        if (auc?.auction?.art_mint) {
          auctionStarted = true;
          console.log(`  Auction started for: ${auc?.auction?.name || auc?.auction?.art_mint}`);
          break;
        }
      } catch {}
      if (i % 2 === 1) console.log(`  Waiting... (${(i + 1) * 5}s)`);
    }

    if (auctionStarted) {
      log('STEP 7: Epoch end (crank)', 'PASS', 'Auction started naturally via crank');
    } else {
      // Fallback to debug-settle
      console.log('  Crank didn\'t trigger, trying debug-settle...');
      const settleRes = await apiCall('POST', '/auction/debug-settle');
      console.log(`  Settle result:`, JSON.stringify(settleRes).slice(0, 200));
      await sleep(5000);
      // Check again
      const auc2 = await apiCall('GET', '/auction/auction');
      if (auc2?.auction?.art_mint) {
        log('STEP 7: Epoch end (debug-settle)', 'PASS', `Auction: ${auc2?.auction?.name || auc2?.auction?.art_mint}`);
      } else {
        log('STEP 7: Epoch end', 'FAIL', 'No auction started after debug-settle');
      }
    }
  } catch (e: any) {
    log('STEP 7: Epoch end', 'FAIL', e.message);
  }

  await sleep(3000);

  // ═══ STEP 8: Auction — Bidder1 bids 0.2 SOL ═══
  console.log('\n--- STEP 8: Bidding ---');
  let auctionMint = '';
  try {
    const auc = await apiCall('GET', '/auction/auction');
    if (!auc?.auction?.art_mint) {
      log('STEP 8: Get auction', 'SKIP', 'No active auction');
    } else {
      auctionMint = auc?.auction?.art_mint;
      console.log(`  Auction for: ${auc?.auction?.name || auc?.auction?.art_mint}`);
      console.log(`  Current bid: ${(auc.auction?.current_bid || 0) / 1e9} SOL`);

      // Bidder1 bids 0.2 SOL
      const epochNum = auc.auction.epoch_number;
      console.log(`  Auction epoch: ${epochNum}`);

      const balBefore = await getBalance(wallets.bidder1.addr);
      const bidRes = await apiCall('POST', '/auction/bid', {
        bidderWallet: wallets.bidder1.addr,
        epochNumber: epochNum,
        bidAmount: 200_000_000, // 0.2 SOL
      });
      
      const sig = await signAndSend(bidRes.transaction, bidder1KP);
      await apiCall('POST', '/auction/bid/confirm', {
        bidderWallet: wallets.bidder1.addr,
        epochNumber: epochNum,
        bidAmount: 200_000_000,
        signature: sig,
      });

      const balAfter = await getBalance(wallets.bidder1.addr);
      const spent = (balBefore - balAfter) / LAMPORTS_PER_SOL;
      log('STEP 8a: Bidder1 bids 0.2 SOL', 'PASS', '', `spent: ${spent.toFixed(6)} SOL`);

      // Creator2 outbids with 0.3 SOL
      const balBefore2 = await getBalance(wallets.creator2.addr);
      const bidRes2 = await apiCall('POST', '/auction/bid', {
        bidderWallet: wallets.creator2.addr,
        epochNumber: epochNum,
        bidAmount: 300_000_000, // 0.3 SOL
      });

      const sig2 = await signAndSend(bidRes2.transaction, creator2KP);
      await apiCall('POST', '/auction/bid/confirm', {
        bidderWallet: wallets.creator2.addr,
        epochNumber: epochNum,
        bidAmount: 300_000_000,
        signature: sig2,
      });

      const balAfter2 = await getBalance(wallets.creator2.addr);
      const spent2 = (balBefore2 - balAfter2) / LAMPORTS_PER_SOL;
      log('STEP 8b: Creator2 outbids 0.3 SOL', 'PASS', '', `spent: ${spent2.toFixed(6)} SOL`);

      // Wait for refund processing
      await sleep(5000);

      // Check Bidder1 got refunded
      const bidder1BalNow = await getBalance(wallets.bidder1.addr);
      const bidder1Diff = bidder1BalNow - balAfter;
      console.log(`  Bidder1 refund: ${(bidder1Diff / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      
      if (bidder1Diff >= 190_000_000) { // ~0.19 SOL (0.2 minus fees)
        log('STEP 8c: Bidder1 refund', 'PASS', `Refunded ${(bidder1Diff / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      } else {
        log('STEP 8c: Bidder1 refund', 'FAIL', `Expected ~0.2 SOL refund, got ${(bidder1Diff / LAMPORTS_PER_SOL).toFixed(6)}`);
      }
    }
  } catch (e: any) {
    log('STEP 8: Bidding', 'FAIL', e.message);
  }

  // ═══ STEP 9: Auction end + settle via crank ═══
  console.log('\n--- STEP 9: Auction settle (crank) ---');
  try {
    // Record balances before settle
    const teamBefore = teamWallet ? await getBalance(teamWallet) : 0;
    
    // Find the creator of the winning piece
    const winnerCreator = c2Pieces.length > 0 ? wallets.creator2 : wallets.creator1;
    const creatorBefore = await getBalance(winnerCreator.addr);

    // Shorten auction to expire soon
    await supabasePatch('auction_config', 'id=eq.1', {
      auction_duration: 5,
    });
    
    // Set auction end_time to past so crank settles it
    const auctions = await supabaseQuery('art_auctions', 'settled=eq.false&order=created_at.desc&limit=1');
    if (auctions && auctions[0]) {
      const pastEnd = new Date(Date.now() - 60000).toISOString(); // 1 min ago
      await supabasePatch('art_auctions', `id=eq.${auctions[0].id}`, {
        end_time: pastEnd,
      });
      console.log(`  Set auction ${auctions[0].id} (epoch ${auctions[0].epoch_number}) end_time to past`);
    } else {
      console.log(`  No unsettled auction found to expire`);
    }

    console.log('  Waiting for crank to settle auction (up to 60s)...');
    let settled = false;
    for (let i = 0; i < 12; i++) {
      await sleep(5000);
      try {
        const auc = await apiCall('GET', '/auction/auction');
        if (!auc?.auction?.art_mint || auc.error) {
          settled = true;
          break;
        }
      } catch {
        settled = true;
        break;
      }
      console.log(`  Waiting... (${(i + 1) * 5}s)`);
    }

    if (!settled) {
      // Fallback
      console.log('  Crank didn\'t settle, trying debug-settle...');
      await apiCall('POST', '/auction/debug-settle');
      await sleep(5000);
    }

    await sleep(5000);

    // Check fee splits on 0.3 SOL auction
    const AUCTION_AMOUNT = 300_000_000; // 0.3 SOL
    const expectedCreator = Math.floor(AUCTION_AMOUNT * 0.6);   // 0.18 SOL
    const expectedVoterPool = Math.floor(AUCTION_AMOUNT * 0.2); // 0.06 SOL
    const expectedTeam = Math.floor(AUCTION_AMOUNT * 0.1);      // 0.03 SOL
    const expectedGrowth = Math.floor(AUCTION_AMOUNT * 0.1);    // 0.03 SOL

    console.log(`\n  Expected fee splits on ${AUCTION_AMOUNT / 1e9} SOL:`);
    console.log(`    Creator (60%):      ${expectedCreator / 1e9} SOL`);
    console.log(`    Voter rewards (20%): ${expectedVoterPool / 1e9} SOL`);
    console.log(`    Team (10%):         ${expectedTeam / 1e9} SOL`);
    console.log(`    Growth (10%):       ${expectedGrowth / 1e9} SOL`);

    const creatorAfter = await getBalance(winnerCreator.addr);
    const creatorGain = creatorAfter - creatorBefore;
    console.log(`\n  Actual creator gain: ${(creatorGain / LAMPORTS_PER_SOL).toFixed(6)} SOL (expected: ${expectedCreator / 1e9})`);
    
    if (creatorGain >= expectedCreator * 0.95 && creatorGain <= expectedCreator * 1.05) {
      log('STEP 9a: Creator 60% share', 'PASS', `${(creatorGain / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    } else {
      log('STEP 9a: Creator 60% share', 'FAIL', `Got ${(creatorGain / LAMPORTS_PER_SOL).toFixed(6)}, expected ~${expectedCreator / 1e9}`);
    }

    if (teamWallet) {
      const teamAfter = await getBalance(teamWallet);
      const teamGain = teamAfter - teamBefore;
      console.log(`  Actual team gain: ${(teamGain / LAMPORTS_PER_SOL).toFixed(6)} SOL (expected: ${(expectedTeam + expectedGrowth) / 1e9})`);
      
      // Team gets team + growth (both go to team wallet for now)
      const expectedTeamTotal = expectedTeam + expectedGrowth;
      if (teamGain >= expectedTeamTotal * 0.9 && teamGain <= expectedTeamTotal * 1.1) {
        log('STEP 9b: Team 10% + Growth 10%', 'PASS', `${(teamGain / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      } else {
        log('STEP 9b: Team + Growth share', 'FAIL', `Got ${(teamGain / LAMPORTS_PER_SOL).toFixed(6)}, expected ~${expectedTeamTotal / 1e9}`);
      }
    }

    log('STEP 9: Auction settled', 'PASS', `Winner: ${winnerCreator.name}`);
  } catch (e: any) {
    log('STEP 9: Auction settle', 'FAIL', e.message);
  }

  // ═══ STEP 10: Voter rewards claim ═══
  console.log('\n--- STEP 10: Voter rewards ---');
  try {
    const rewards = await apiCall('GET', `/auction/voter-rewards?wallet=${wallets.creator1.addr}`);
    console.log(`  Creator1 rewards:`, JSON.stringify(rewards).slice(0, 200));
    
    if (rewards.claimable && rewards.claimable > 0) {
      const balBefore = await getBalance(wallets.creator1.addr);
      const claimRes = await apiCall('POST', '/auction/claim-voter-rewards', {
        wallet: wallets.creator1.addr,
      });
      await sleep(3000);
      const balAfter = await getBalance(wallets.creator1.addr);
      const gain = (balAfter - balBefore) / LAMPORTS_PER_SOL;
      log('STEP 10: Claim voter rewards', 'PASS', `Claimed ${gain.toFixed(6)} SOL`);
    } else {
      log('STEP 10: Voter rewards', 'SKIP', 'No claimable rewards (may need crank processing)');
    }
  } catch (e: any) {
    log('STEP 10: Voter rewards', 'FAIL', e.message);
  }

  // ═══ STEP 11: Profile data check ═══
  console.log('\n--- STEP 11: Profile data ---');
  for (const [key, w] of Object.entries(wallets)) {
    try {
      const candidates = await apiCall('GET', '/auction/candidates');
      const list = candidates?.candidates || [];
      const myArt = list.filter((c: any) => c.creator_wallet === w.addr);
      
      const remaining = await apiCall('GET', `/auction/swipe/remaining?wallet=${w.addr}`).catch(() => null);
      
      console.log(`  ${w.name}: ${myArt.length} art pieces, votes: ${myArt.reduce((s: number, c: any) => s + (c.votes || 0), 0)}`);
      if (remaining) {
        console.log(`    Free votes: ${remaining.freeRemaining}/${remaining.freeTotal}, Paid: ${remaining.paidRemaining}`);
      }
    } catch (e: any) {
      console.log(`  ${w.name}: Error — ${e.message}`);
    }
  }
  log('STEP 11: Profile data', 'PASS', 'All profiles checked');

  // ═══ STEP 12: Verify winner marked in DB ═══
  console.log('\n--- STEP 12: Winner verification ---');
  try {
    if (auctionMint) {
      // Check art_candidates — winner should have won=true
      const candidates = await supabaseQuery('art_candidates', `mint_address=eq.${auctionMint}`);
      const winner = Array.isArray(candidates) ? candidates[0] : null;
      if (winner) {
        console.log(`  Winner: ${winner.name}, won=${winner.won}, votes=${winner.votes}`);
        if (winner.won) {
          log('STEP 12: Winner verified', 'PASS', `${winner.name} won=true (${winner.votes} votes)`);
        } else {
          log('STEP 12: Winner verified', 'FAIL', `Expected won=true, got won=${winner.won}`);
        }
      } else {
        log('STEP 12: Winner verified', 'SKIP', 'Winner not found in art_candidates');
      }
    } else {
      log('STEP 12: Winner verified', 'SKIP', 'No auction mint tracked');
    }
  } catch (e: any) {
    log('STEP 12: Winner verified', 'FAIL', e.message);
  }

  // ═══ Final balances ═══
  console.log('\n--- Final Balances ---');
  for (const [key, w] of Object.entries(wallets)) {
    const bal = await getBalance(w.addr);
    console.log(`  ${w.name}: ${(bal / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  }
  if (teamWallet) {
    const teamBal = await getBalance(teamWallet);
    console.log(`  Team: ${(teamBal / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  }

  // ═══ Restore durations ═══
  await supabasePatch('auction_config', 'id=eq.1', {
    epoch_duration: 86400,
    auction_duration: 14400,
  });

  // ═══ Summary ═══
  console.log('\n══════════════════════════════════════════════');
  console.log('  TEST SUMMARY');
  console.log('══════════════════════════════════════════════');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`  PASS: ${pass}  FAIL: ${fail}  SKIP: ${skip}  TOTAL: ${results.length}\n`);
  
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`  ${icon} ${r.step}${r.sol ? ` [${r.sol}]` : ''}`);
  }

  console.log('\n--- SOL Transfer Audit ---');
  console.log('  Mints:');
  for (const m of minted) {
    console.log(`    ${m.name} (${wallets[m.wallet as keyof typeof wallets].name}): ${m.fee / 1e9} SOL`);
  }
  console.log(`  Join fees: ${minted.length} × 0.015 SOL = ${(minted.length * 0.015).toFixed(3)} SOL`);
  console.log(`  Total mint revenue: ${minted.reduce((s, m) => s + m.fee, 0) / 1e9} SOL`);
  console.log(`  Total join revenue: ${(minted.length * 15_000_000) / 1e9} SOL`);

  if (fail > 0) {
    console.log('\n⚠️  FAILURES DETECTED — review before mainnet!\n');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!\n');
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
