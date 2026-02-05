const DEXSCREENER_URL =
  'https://api.dexscreener.com/latest/dex/tokens/AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump';

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface MarketData {
  chumPriceUsd: number | null;
  chumChange24h: number | null;
  chumVolume24h: number | null;
  chumLiquidity: number | null;
  solPriceUsd: number;
  solChange24h: number | null;
  btcPriceUsd: number | null;
  btcChange24h: number | null;
  ethPriceUsd: number | null;
  ethChange24h: number | null;
}

const DEFAULT_MARKET: MarketData = {
  chumPriceUsd: null,
  chumChange24h: null,
  chumVolume24h: null,
  chumLiquidity: null,
  solPriceUsd: 150,
  solChange24h: null,
  btcPriceUsd: null,
  btcChange24h: null,
  ethPriceUsd: null,
  ethChange24h: null,
};

let cached: MarketData = { ...DEFAULT_MARKET };
let cachedAt = 0;

async function fetchChumPrice(): Promise<Partial<MarketData>> {
  try {
    const res = await fetch(DEXSCREENER_URL);
    if (!res.ok) throw new Error(`DexScreener ${res.status}`);
    const data = await res.json() as {
      pairs?: Array<{
        priceUsd?: string;
        priceChange?: { h24?: number };
        volume?: { h24?: number };
        liquidity?: { usd?: number };
      }>;
    };
    const pair = data?.pairs?.[0];
    if (!pair) return {};
    return {
      chumPriceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      chumChange24h: pair.priceChange?.h24 ?? null,
      chumVolume24h: pair.volume?.h24 ?? null,
      chumLiquidity: pair.liquidity?.usd ?? null,
    };
  } catch (err) {
    console.warn('[MARKET] DexScreener fetch failed:', err);
    return {};
  }
}

async function fetchMajorPrices(): Promise<Partial<MarketData>> {
  try {
    const res = await fetch(COINGECKO_URL);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json() as {
      solana?: { usd?: number; usd_24h_change?: number };
      bitcoin?: { usd?: number; usd_24h_change?: number };
      ethereum?: { usd?: number; usd_24h_change?: number };
    };
    return {
      solPriceUsd: data?.solana?.usd ?? cached.solPriceUsd,
      solChange24h: data?.solana?.usd_24h_change ?? null,
      btcPriceUsd: data?.bitcoin?.usd ?? null,
      btcChange24h: data?.bitcoin?.usd_24h_change ?? null,
      ethPriceUsd: data?.ethereum?.usd ?? null,
      ethChange24h: data?.ethereum?.usd_24h_change ?? null,
    };
  } catch (err) {
    console.warn('[MARKET] CoinGecko fetch failed:', err);
    return {};
  }
}

export async function getMarketData(): Promise<MarketData> {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) return cached;

  const [chum, majors] = await Promise.all([
    fetchChumPrice(),
    fetchMajorPrices(),
  ]);

  cached = {
    ...cached,
    ...chum,
    ...majors,
  };
  cachedAt = now;

  console.log(
    `[MARKET] $CHUM: $${cached.chumPriceUsd ?? '?'}, SOL: $${cached.solPriceUsd}, BTC: $${cached.btcPriceUsd ?? '?'}, ETH: $${cached.ethPriceUsd ?? '?'}`
  );

  return cached;
}
