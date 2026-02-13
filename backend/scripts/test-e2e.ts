/**
 * CHUM: Reanimation — End-to-End Test Script
 * Runs all auction system steps on devnet.
 */

import {
  Keypair,
  Connection,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Config ───
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const RPC_URL = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const API = process.env.E2E_API_URL || 'https://chum-production.up.railway.app/api';

const connection = new Connection(RPC_URL, 'confirmed');

// Load wallet
const walletPath = path.resolve(__dirname, '../../chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T.json');
const walletJson = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
const keypair = Keypair.fromSecretKey(Uint8Array.from(walletJson));
const WALLET = keypair.publicKey.toString();

console.log(`\n🧪 CHUM E2E Test — Wallet: ${WALLET}\n`);

const results: { step: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail?: string }[] = [];

function log(step: string, status: 'PASS' | 'FAIL' | 'SKIP', detail?: string) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} [${step}] ${status}${detail ? ' — ' + detail : ''}`);
  results.push({ step, status, detail });
}

async function api(method: string, path: string, body?: any): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const json = await res.json();
  if (!res.ok && !json.success) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

async function supabasePatch(table: string, filter: string, body: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function signAndSend(txBase64: string): Promise<string> {
  const txBytes = Buffer.from(txBase64, 'base64');
  const tx = VersionedTransaction.deserialize(txBytes);
  tx.sign([keypair]);
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

// Track minted assets for later steps
let mint1Address = '';
let mint2Address = '';

async function main() {
  // ═══ STEP 0: Shorten epoch + auction for testing ═══
  try {
    const result = await supabasePatch('auction_config', 'id=eq.1', {
      epoch_duration: 300,
      auction_duration: 120,
    });
    log('STEP 0: Shorten durations', 'PASS', `epoch=300s, auction=120s`);
  } catch (e: any) {
    log('STEP 0: Shorten durations', 'FAIL', e.message);
  }

  // Check wallet balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`💰 Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log('⚠️  Low balance! Some tests may fail. Airdrop with: solana airdrop 2 ' + WALLET);
  }

  // ═══ STEP 1: Mint (human path) ═══
  try {
    const mintRes = await api('POST', '/auction/mint', {
      creatorWallet: WALLET,
      name: 'E2E Test Piece #1',
      uri: 'https://arweave.net/test-uri-1',
    });
    if (!mintRes.transaction || !mintRes.assetAddress) throw new Error('No tx or asset');
    mint1Address = mintRes.assetAddress;
    console.log(`  Asset: ${mint1Address}, Fee: ${mintRes.fee / 1e9} SOL, Agent: ${mintRes.isAgent}`);

    const sig = await signAndSend(mintRes.transaction);
    console.log(`  TX: ${sig}`);

    // Wait for asset to be indexed
    let confirm: any;
    for (let retry = 0; retry < 10; retry++) {
      await sleep(3000);
      try {
        confirm = await api('POST', '/auction/mint/confirm', {
          assetAddress: mint1Address,
          signature: sig,
        });
        break;
      } catch (e: any) {
        if (retry === 9) throw e;
        console.log(`  Waiting for asset indexing... (${retry + 1}/10)`);
      }
    }
    log('STEP 1: Mint (human)', 'PASS', `${confirm.name} → ${mint1Address}`);
  } catch (e: any) {
    log('STEP 1: Mint (human)', 'FAIL', e.message);
  }

  // ═══ STEP 2: Mint (agent path with challenge) ═══
  try {
    // Get challenge
    const challenge = await api('POST', '/auction/challenge', { walletAddress: WALLET });
    if (!challenge.challengeId || !challenge.question) throw new Error('No challenge');
    console.log(`  Challenge: ${challenge.question}`);

    // Solve: parse "A + B" and compute
    const parts = challenge.question.split('+').map((s: string) => parseInt(s.trim()));
    const answer = parts[0] + parts[1];
    console.log(`  Answer: ${answer}`);

    // Mint with challenge
    const mintRes = await api('POST', '/auction/mint', {
      creatorWallet: WALLET,
      name: 'E2E Test Piece #2 (Agent)',
      uri: 'https://arweave.net/test-uri-2',
      challengeId: challenge.challengeId,
      answer,
    });
    mint2Address = mintRes.assetAddress;
    console.log(`  Asset: ${mint2Address}, Fee: ${mintRes.fee / 1e9} SOL, Agent: ${mintRes.isAgent}`);

    if (!mintRes.isAgent) throw new Error('Expected isAgent=true');

    const sig = await signAndSend(mintRes.transaction);
    let confirm: any;
    for (let retry = 0; retry < 10; retry++) {
      await sleep(3000);
      try {
        confirm = await api('POST', '/auction/mint/confirm', {
          assetAddress: mint2Address,
          signature: sig,
        });
        break;
      } catch (e: any) {
        if (retry === 9) throw e;
        console.log(`  Waiting for asset indexing... (${retry + 1}/10)`);
      }
    }
    log('STEP 2: Mint (agent)', 'PASS', `${confirm.name} → ${mint2Address}`);
  } catch (e: any) {
    log('STEP 2: Mint (agent)', 'FAIL', e.message);
  }

  // ═══ STEP 3: Join voting for both ═══
  for (const [i, mintAddr] of [mint1Address, mint2Address].entries()) {
    if (!mintAddr) {
      log(`STEP 3: Join voting #${i + 1}`, 'SKIP', 'No mint address');
      continue;
    }
    try {
      let joinRes: any;
      for (let retry = 0; retry < 5; retry++) {
        try {
          joinRes = await api('POST', '/auction/join', {
            creatorWallet: WALLET,
            mintAddress: mintAddr,
          });
          break;
        } catch (e: any) {
          if (retry === 4) throw e;
          console.log(`  Waiting for join availability... (${retry + 1}/5)`);
          await sleep(3000);
        }
      }
      const sig = await signAndSend(joinRes.transaction);
      let confirm: any;
      for (let retry = 0; retry < 10; retry++) {
        await sleep(3000);
        try {
          confirm = await api('POST', '/auction/join/confirm', {
            creatorWallet: WALLET,
            mintAddress: mintAddr,
            signature: sig,
          });
          break;
        } catch (e: any) {
          if (retry === 9) throw e;
          console.log(`  Waiting for join confirm... (${retry + 1}/10)`);
        }
      }
      log(`STEP 3: Join voting #${i + 1}`, 'PASS', `${confirm.name} joined`);
    } catch (e: any) {
      log(`STEP 3: Join voting #${i + 1}`, 'FAIL', e.message);
    }
  }

  // ═══ STEP 4: Cast votes ═══
  // 4a: Free vote
  if (mint1Address) {
    try {
      const voteRes = await api('POST', '/auction/vote', {
        voterWallet: WALLET,
        candidateMint: mint1Address,
      });
      log('STEP 4a: Free vote', 'PASS', `totalVotes=${voteRes.totalVotes}`);
    } catch (e: any) {
      log('STEP 4a: Free vote', 'FAIL', e.message);
    }
  }

  // 4b: Paid vote
  if (mint1Address) {
    try {
      const voteRes = await api('POST', '/auction/vote', {
        voterWallet: WALLET,
        candidateMint: mint1Address,
        numVotes: 1,
        paid: true,
      });
      console.log(`  Cost: ${voteRes.cost} lamports`);
      const sig = await signAndSend(voteRes.transaction);
      const epoch = voteRes.epochNumber;
      const confirm = await api('POST', '/auction/vote/confirm', {
        voterWallet: WALLET,
        candidateMint: mint1Address,
        numVotes: 1,
        epochNumber: epoch,
        signature: sig,
      });
      log('STEP 4b: Paid vote', 'PASS', `totalVotes=${confirm.totalVotes}, cost=${voteRes.cost}`);
    } catch (e: any) {
      log('STEP 4b: Paid vote', 'FAIL', e.message);
    }
  }

  // 4c: Agent vote
  if (mint2Address) {
    try {
      const voteRes = await api('POST', '/auction/vote-agent', {
        wallet: WALLET,
        candidateMint: mint2Address,
      });
      log('STEP 4c: Agent vote', 'PASS', `agentVotes=${voteRes.agentVotes}`);
    } catch (e: any) {
      log('STEP 4c: Agent vote', 'FAIL', e.message);
    }
  }

  // ═══ STEP 5: Check API responses ═══
  try {
    const candidates = await api('GET', '/auction/candidates');
    const hasMint1 = candidates.candidates?.some((c: any) => c.mint_address === mint1Address);
    const hasMint2 = candidates.candidates?.some((c: any) => c.mint_address === mint2Address);
    log('STEP 5a: Candidates', hasMint1 || hasMint2 ? 'PASS' : 'FAIL',
      `count=${candidates.count}, has1=${hasMint1}, has2=${hasMint2}`);
  } catch (e: any) {
    log('STEP 5a: Candidates', 'FAIL', e.message);
  }

  try {
    const lb = await api('GET', '/auction/leaderboard');
    const top = lb.leaderboard?.[0];
    log('STEP 5b: Leaderboard', 'PASS',
      `top=${top?.mint_address?.slice(0, 8)}... votes=${top?.votes}`);
  } catch (e: any) {
    log('STEP 5b: Leaderboard', 'FAIL', e.message);
  }

  try {
    const epochInfo = await api('GET', '/auction/epoch');
    log('STEP 5c: Epoch info', 'PASS',
      `epoch=${epochInfo.epoch?.epoch_number}, remaining=${epochInfo.epoch?.remaining_seconds}s`);
  } catch (e: any) {
    log('STEP 5c: Epoch info', 'FAIL', e.message);
  }

  // ═══ STEP 6: Force epoch end ═══
  // We'll set the epoch start_time to the past so endEpoch triggers
  try {
    // Get current epoch
    const epochInfo = await api('GET', '/auction/epoch');
    const epochId = epochInfo.epoch?.id;
    if (epochId) {
      // Set start_time to 10 minutes ago AND duration to 300s so endEpoch triggers
      const pastTime = new Date(Date.now() - 600_000).toISOString();
      await supabasePatch('auction_epochs', `id=eq.${epochId}`, {
        start_time: pastTime,
        duration_seconds: 300,
      });
      console.log('  Set epoch start_time to past, calling endEpoch via crank...');

      // Hit the backend's endEpoch via a direct call — we need to trigger it
      // The crank runs on the backend, but we can't call it directly via API
      // Instead, we wait a bit for the crank to pick it up (runs every 30s)
      console.log('  Waiting 35s for crank to end epoch...');
      await sleep(35_000);

      const newEpoch = await api('GET', '/auction/epoch');
      const auctionCheck = await api('GET', '/auction/auction');
      if (auctionCheck.auction) {
        log('STEP 6: End epoch', 'PASS', `Auction created for epoch ${auctionCheck.auction.epoch_number}`);
      } else {
        log('STEP 6: End epoch', 'FAIL', 'No auction created after epoch end');
      }
    }
  } catch (e: any) {
    log('STEP 6: End epoch', 'FAIL', e.message);
  }

  // ═══ STEP 7: Verify auction + bid ═══
  let auctionEpoch: number | null = null;
  try {
    const auctionRes = await api('GET', '/auction/auction');
    if (!auctionRes.auction) throw new Error('No active auction');
    auctionEpoch = auctionRes.auction.epoch_number;
    console.log(`  Auction: epoch=${auctionEpoch}, reserve=${auctionRes.auction.reserve_bid}, remaining=${auctionRes.auction.remaining_seconds}s`);
    log('STEP 7a: Auction exists', 'PASS', `art=${auctionRes.auction.art_mint?.slice(0, 8)}...`);
  } catch (e: any) {
    log('STEP 7a: Auction exists', 'FAIL', e.message);
  }

  // Place bid at reserve (0.2 SOL = 200_000_000 lamports)
  if (auctionEpoch) {
    try {
      const bidRes = await api('POST', '/auction/bid', {
        bidderWallet: WALLET,
        epochNumber: auctionEpoch,
        bidAmount: 200_000_000,
      });
      const sig = await signAndSend(bidRes.transaction);
      const confirm = await api('POST', '/auction/bid/confirm', {
        bidderWallet: WALLET,
        epochNumber: auctionEpoch,
        bidAmount: 200_000_000,
        signature: sig,
      });
      log('STEP 7b: Place bid (0.2 SOL)', 'PASS', `auctionId=${confirm.auctionId}`);
    } catch (e: any) {
      log('STEP 7b: Place bid (0.2 SOL)', 'FAIL', e.message);
    }

    // Second bid at 0.3 SOL (same wallet since we only have one — tests refund logic)
    try {
      const bidRes = await api('POST', '/auction/bid', {
        bidderWallet: WALLET,
        epochNumber: auctionEpoch,
        bidAmount: 300_000_000,
      });
      const sig = await signAndSend(bidRes.transaction);
      const confirm = await api('POST', '/auction/bid/confirm', {
        bidderWallet: WALLET,
        epochNumber: auctionEpoch,
        bidAmount: 300_000_000,
        signature: sig,
      });
      log('STEP 7c: Place bid (0.3 SOL) + refund', 'PASS', `auctionId=${confirm.auctionId}`);
    } catch (e: any) {
      log('STEP 7c: Place bid (0.3 SOL) + refund', 'FAIL', e.message);
    }
  }

  // ═══ STEP 8: Wait for auction to settle ═══
  if (auctionEpoch) {
    try {
      // Set auction end_time to past
      const auctionRes = await api('GET', '/auction/auction');
      if (auctionRes.auction) {
        const pastTime = new Date(Date.now() - 60_000).toISOString();
        await supabasePatch('art_auctions', `epoch_number=eq.${auctionEpoch}`, {
          end_time: pastTime,
        });
        console.log('  Set auction end_time to past, waiting 65s for crank to settle...');
        await sleep(65_000);

        const settled = await api('GET', '/auction/auction');
        if (settled.auction?.settled) {
          log('STEP 8: Auction settled', 'PASS');
        } else {
          // Check if a new auction was created (meaning settlement happened)
          const newEpoch = await api('GET', '/auction/epoch');
          if (newEpoch.epoch?.epoch_number > auctionEpoch) {
            log('STEP 8: Auction settled', 'PASS', 'New epoch created');
          } else {
            log('STEP 8: Auction settled', 'FAIL', 'Auction not yet settled');
          }
        }
      }
    } catch (e: any) {
      log('STEP 8: Auction settled', 'FAIL', e.message);
    }
  }

  // ═══ STEP 9: Voter rewards ═══
  try {
    const rewards = await api('GET', `/auction/voter-rewards?wallet=${WALLET}`);
    console.log(`  Pending: ${rewards.totalPending} lamports, Claimed: ${rewards.totalClaimed}`);
    log('STEP 9a: Voter rewards check', 'PASS',
      `pending=${rewards.totalPending}, claimed=${rewards.totalClaimed}`);

    if (rewards.totalPending > 0) {
      const claim = await api('POST', '/auction/claim-voter-rewards', { wallet: WALLET });
      log('STEP 9b: Claim rewards', claim.claimed ? 'PASS' : 'SKIP',
        `amount=${claim.amount}, sig=${claim.signature?.slice(0, 16)}...`);
    } else {
      log('STEP 9b: Claim rewards', 'SKIP', 'No pending rewards');
    }
  } catch (e: any) {
    log('STEP 9: Voter rewards', 'FAIL', e.message);
  }

  // ═══ STEP 10: Swipe ═══
  if (mint1Address) {
    try {
      const swipeRight = await api('POST', '/auction/swipe', {
        wallet: WALLET,
        candidateMint: mint1Address,
        direction: 'right',
      });
      log('STEP 10a: Swipe right', 'PASS', JSON.stringify(swipeRight).slice(0, 80));
    } catch (e: any) {
      log('STEP 10a: Swipe right', 'FAIL', e.message);
    }
  }

  if (mint2Address) {
    try {
      const swipeLeft = await api('POST', '/auction/swipe', {
        wallet: WALLET,
        candidateMint: mint2Address,
        direction: 'left',
      });
      log('STEP 10b: Swipe left', 'PASS', JSON.stringify(swipeLeft).slice(0, 80));
    } catch (e: any) {
      log('STEP 10b: Swipe left', 'FAIL', e.message);
    }
  }

  try {
    const remaining = await api('GET', `/auction/swipe/remaining?wallet=${WALLET}`);
    log('STEP 10c: Swipe remaining', 'PASS', JSON.stringify(remaining).slice(0, 80));
  } catch (e: any) {
    log('STEP 10c: Swipe remaining', 'FAIL', e.message);
  }

  try {
    const stats = await api('GET', `/auction/swipe/stats?wallet=${WALLET}`);
    log('STEP 10d: Swipe stats', 'PASS', JSON.stringify(stats).slice(0, 80));
  } catch (e: any) {
    log('STEP 10d: Swipe stats', 'FAIL', e.message);
  }

  // ═══ RESTORE: Reset durations ═══
  try {
    await supabasePatch('auction_config', 'id=eq.1', {
      epoch_duration: 86400,
      auction_duration: 14400,
    });
    log('RESTORE: Reset durations', 'PASS', 'epoch=86400, auction=14400');
  } catch (e: any) {
    log('RESTORE: Reset durations', 'FAIL', e.message);
  }

  // ═══ SUMMARY ═══
  console.log('\n═══════════════════════════════════════');
  console.log('           E2E TEST SUMMARY');
  console.log('═══════════════════════════════════════');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`  ✅ PASS: ${pass}  ❌ FAIL: ${fail}  ⏭️ SKIP: ${skip}`);
  console.log('═══════════════════════════════════════\n');

  for (const r of results) {
    if (r.status === 'FAIL') {
      console.log(`  ❌ ${r.step}: ${r.detail}`);
    }
  }

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
