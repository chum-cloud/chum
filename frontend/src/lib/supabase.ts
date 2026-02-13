// Real-time mint feed via Server-Sent Events
const API = 'https://chum-production.up.railway.app';

export type RecentMint = {
  id: number;
  asset_address: string;
  name: string;
  mp4_url: string;
  png_url: string;
  creator_wallet: string;
  is_agent: boolean;
  fee: number;
  created_at: string;
};

/**
 * Subscribe to real-time mint feed via SSE.
 * Returns a cleanup function.
 */
export function subscribeMintFeed(onMint: (mint: RecentMint) => void): () => void {
  const es = new EventSource(`${API}/api/auction/mint-feed`);
  es.onmessage = (event) => {
    try {
      const mint = JSON.parse(event.data) as RecentMint;
      onMint(mint);
    } catch {}
  };
  return () => es.close();
}
