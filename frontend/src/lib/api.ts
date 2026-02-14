import { mockApi, USE_MOCK } from './mock';

const API = 'https://chum-production.up.railway.app';

async function fetchJSON(path: string) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postJSON(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getConfig: () => fetchJSON('/api/auction/config'),
  getEpoch: () => USE_MOCK ? mockApi.getEpoch() : fetchJSON('/api/auction/epoch'),
  getCandidates: () => USE_MOCK ? mockApi.getCandidates() : fetchJSON('/api/auction/candidates'),
  getLeaderboard: () => USE_MOCK ? mockApi.getLeaderboard() : fetchJSON('/api/auction/leaderboard'),
  getAuction: () => USE_MOCK ? mockApi.getAuction() : fetchJSON('/api/auction/auction'),

  mint: (creatorWallet: string) =>
    postJSON('/api/auction/mint', { creatorWallet }),
  confirmMint: (assetAddress: string, signature: string, creatorWallet?: string, isAgent?: boolean, piece?: { id: string; mp4: string; png: string }) =>
    postJSON('/api/auction/mint/confirm', { assetAddress, signature, creatorWallet, isAgent, piece }),
  getRecentMints: (limit = 10) =>
    fetchJSON(`/api/auction/recent-mints?limit=${limit}`),

  joinVoting: (wallet: string, mintAddress: string) =>
    postJSON('/api/auction/join', { creatorWallet: wallet, mintAddress }),
  confirmJoin: (wallet: string, signature: string, mintAddress: string) =>
    postJSON('/api/auction/join/confirm', { creatorWallet: wallet, signature, mintAddress }),
  withdraw: (wallet: string, mintAddress: string) =>
    postJSON('/api/auction/withdraw', { creatorWallet: wallet, mintAddress }),

  voteFree: (wallet: string, candidateMint: string, numVotes = 1) =>
    postJSON('/api/auction/vote', { voterWallet: wallet, candidateMint, numVotes, paid: false }),
  votePaid: (wallet: string, candidateMint: string, numVotes = 1) =>
    postJSON('/api/auction/vote', { voterWallet: wallet, candidateMint, numVotes, paid: true }),
  confirmVote: (wallet: string, signature: string) =>
    postJSON('/api/auction/confirm-vote', { wallet, signature }),

  bid: (wallet: string, epochNumber: number, bidAmount: number) =>
    postJSON('/api/auction/bid', { bidderWallet: wallet, epochNumber, bidAmount }),
  confirmBid: (wallet: string, epochNumber: number, bidAmount: number, signature: string) =>
    postJSON('/api/auction/bid/confirm', { bidderWallet: wallet, epochNumber, bidAmount, signature }),

  // Swipe / Judge
  getNextSwipe: (wallet: string) => USE_MOCK ? mockApi.getNextSwipe(wallet) : fetchJSON(`/api/auction/swipe/next?wallet=${wallet}`),
  submitSwipe: (wallet: string, candidateMint: string, direction: string) =>
    USE_MOCK ? mockApi.submitSwipe() : postJSON('/api/auction/swipe', { wallet, candidateMint, direction }),
  getSwipeRemaining: (wallet: string) => USE_MOCK ? mockApi.getSwipeRemaining() : fetchJSON(`/api/auction/swipe/remaining?wallet=${wallet}`),
  getSwipeStats: (wallet: string) => USE_MOCK ? mockApi.getSwipeStats() : fetchJSON(`/api/auction/swipe/stats?wallet=${wallet}`),
  buyVotes: (wallet: string) => postJSON('/api/auction/swipe/buy-votes', { wallet }),
  confirmBuyVotes: (wallet: string, signature: string) =>
    postJSON('/api/auction/swipe/confirm-buy', { wallet, signature }),
  claimPrediction: (wallet: string) => postJSON('/api/auction/claim-prediction', { wallet }),

  getMyArt: (wallet: string) => fetchJSON(`/api/auction/my-art?wallet=${wallet}`),
  getMyBids: (wallet: string) => USE_MOCK ? mockApi.getMyBids(wallet) : fetchJSON(`/api/auction/bids?wallet=${wallet}`),
};
