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

  mint: (wallet: string) =>
    postJSON('/api/auction/mint', { wallet }),
  confirmMint: (wallet: string, signature: string) =>
    postJSON('/api/auction/confirm-mint', { wallet, signature }),

  joinVoting: (wallet: string, mintAddress: string) =>
    postJSON('/api/auction/join-voting', { wallet, mintAddress }),
  confirmJoin: (wallet: string, signature: string, mintAddress: string) =>
    postJSON('/api/auction/confirm-join', { wallet, signature, mintAddress }),

  voteFree: (wallet: string, candidateMint: string) =>
    postJSON('/api/auction/vote-free', { wallet, candidateMint }),
  votePaid: (wallet: string, candidateMint: string) =>
    postJSON('/api/auction/vote-paid', { wallet, candidateMint }),
  confirmVote: (wallet: string, signature: string) =>
    postJSON('/api/auction/confirm-vote', { wallet, signature }),

  bid: (wallet: string, amount: number) =>
    postJSON('/api/auction/bid', { wallet, amount }),
  confirmBid: (wallet: string, signature: string) =>
    postJSON('/api/auction/confirm-bid', { wallet, signature }),

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
};
