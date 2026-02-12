import { endEpoch, settleAuction, getCurrentEpoch } from './auction';

const CRANK_INTERVAL_MS = 30_000; // 30 seconds
let crankTimer: NodeJS.Timeout | null = null;
let running = false;

async function tick() {
  if (running) return; // Skip if previous tick still running
  running = true;

  try {
    // 1. Check if epoch needs ending
    const epochResult = await endEpoch();
    if (epochResult.winner) {
      console.log(`[CRANK] Epoch ended — winner: ${epochResult.winner}`);
    } else if (epochResult.skipped) {
      console.log(`[CRANK] Epoch skipped (no candidates/votes)`);
    }

    // 2. Check if any auction needs settling
    const settleResult = await settleAuction();
    if (settleResult.settled) {
      if (settleResult.winner) {
        console.log(`[CRANK] Auction settled — winner: ${settleResult.winner}, amount: ${settleResult.amount}`);
      } else {
        console.log(`[CRANK] Auction settled — no bids, NFT returned`);
      }
    }
  } catch (err: any) {
    console.error(`[CRANK] Error: ${err.message}`);
  } finally {
    running = false;
  }
}

/**
 * Start the auction crank (epoch/auction lifecycle).
 */
export function startAuctionCrank() {
  if (crankTimer) {
    console.warn('[CRANK] Already running');
    return;
  }

  console.log(`[CRANK] Started (interval: ${CRANK_INTERVAL_MS / 1000}s)`);

  // Run immediately, then on interval
  tick();
  crankTimer = setInterval(tick, CRANK_INTERVAL_MS);
}

/**
 * Stop the auction crank.
 */
export function stopAuctionCrank() {
  if (crankTimer) {
    clearInterval(crankTimer);
    crankTimer = null;
    console.log('[CRANK] Stopped');
  }
}
