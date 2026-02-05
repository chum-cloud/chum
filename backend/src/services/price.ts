const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_SOL_PRICE = 150;

let cachedPrice: number = DEFAULT_SOL_PRICE;
let cachedAt: number = 0;

export async function getSolPrice(): Promise<number> {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) return cachedPrice;

  try {
    const res = await fetch(COINGECKO_URL);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = (await res.json()) as { solana?: { usd?: number } };
    const price = data?.solana?.usd;
    if (price && price > 0) {
      cachedPrice = price;
      cachedAt = now;
    }
  } catch (err) {
    console.warn('[PRICE] CoinGecko fetch failed, using cached:', cachedPrice, err);
  }

  return cachedPrice;
}

export function usdToSol(usd: number, solPrice: number): number {
  return solPrice > 0 ? usd / solPrice : 0;
}
