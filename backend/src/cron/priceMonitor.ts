/**
 * PRICE MONITOR — Watches $CHUM price and emits market events
 *
 * Polls DexScreener every 5 minutes, emits events on significant moves:
 * - PRICE_PUMP: 1h change > +10%
 * - PRICE_DUMP: 1h change < -10%
 * - VOLUME_SPIKE: 1h volume > 2x 6h average hourly
 */

import { eventBus } from '../services/events';

const DEXSCREENER_URL = 'https://api.dexscreener.com/latest/dex/tokens/AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump';
const POLL_INTERVAL = 5 * 60_000; // 5 minutes

// Track last emitted events to avoid spam
let lastPumpTime = 0;
let lastDumpTime = 0;
let lastVolumeSpikeTime = 0;
const EVENT_COOLDOWN = 60 * 60_000; // 1 hour between same event type

interface DexScreenerPair {
  priceUsd: string;
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  marketCap: number;
  liquidity?: { usd: number } | null;
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[];
}

async function fetchPrice(): Promise<DexScreenerPair | null> {
  try {
    const res = await fetch(DEXSCREENER_URL);
    if (!res.ok) {
      console.error(`[PRICE] DexScreener returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as DexScreenerResponse;
    return data.pairs?.[0] ?? null;
  } catch (err) {
    console.error('[PRICE] Failed to fetch:', err);
    return null;
  }
}

async function checkPrice(): Promise<void> {
  const pair = await fetchPrice();
  if (!pair) return;

  const now = Date.now();
  const price = parseFloat(pair.priceUsd);
  const change1h = pair.priceChange.h1;
  const change6h = pair.priceChange.h6;
  const change24h = pair.priceChange.h24;
  const volume1h = pair.volume.h1;
  const volume6h = pair.volume.h6;
  const marketCap = pair.marketCap;

  console.log(`[PRICE] $CHUM: $${price.toFixed(9)} | 1h: ${change1h > 0 ? '+' : ''}${change1h.toFixed(1)}% | 24h: ${change24h > 0 ? '+' : ''}${change24h.toFixed(1)}% | vol1h: $${volume1h.toFixed(0)}`);

  // PRICE_PUMP: 1h change > +10%
  if (change1h > 10 && now - lastPumpTime > EVENT_COOLDOWN) {
    lastPumpTime = now;
    eventBus.emitEvent({
      type: 'PRICE_PUMP',
      timestamp: now,
      price,
      change1h,
      change6h,
      change24h,
      volume24h: pair.volume.h24,
      marketCap,
    });
  }

  // PRICE_DUMP: 1h change < -10%
  if (change1h < -10 && now - lastDumpTime > EVENT_COOLDOWN) {
    lastDumpTime = now;
    eventBus.emitEvent({
      type: 'PRICE_DUMP',
      timestamp: now,
      price,
      change1h,
      change6h,
      change24h,
      volume24h: pair.volume.h24,
      marketCap,
    });
  }

  // VOLUME_SPIKE: 1h volume > 2x average hourly (6h / 6)
  const avgHourlyVolume = volume6h / 6;
  if (volume1h > avgHourlyVolume * 2 && avgHourlyVolume > 100 && now - lastVolumeSpikeTime > EVENT_COOLDOWN) {
    lastVolumeSpikeTime = now;
    eventBus.emitEvent({
      type: 'VOLUME_SPIKE',
      timestamp: now,
      volume1h,
      volume6h,
      volume24h: pair.volume.h24,
      volumeMultiplier: volume1h / avgHourlyVolume,
      price,
      marketCap,
    });
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPriceMonitor(): void {
  console.log('[PRICE] Starting price monitor (5 min interval)');

  // Initial check after 30 seconds
  setTimeout(() => {
    checkPrice().catch((err) => console.error('[PRICE] Check failed:', err));
  }, 30_000);

  // Then every 5 minutes
  timer = setInterval(() => {
    checkPrice().catch((err) => console.error('[PRICE] Check failed:', err));
  }, POLL_INTERVAL);
}

export function stopPriceMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
