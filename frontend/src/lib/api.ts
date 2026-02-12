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
  getEpoch: () => fetchJSON('/api/auction/epoch'),
  getCandidates: () => fetchJSON('/api/auction/candidates'),
  getLeaderboard: () => fetchJSON('/api/auction/leaderboard'),
  getAuction: () => fetchJSON('/api/auction/auction'),

  mint: (creatorWallet: string, name: string, uri: string) =>
    postJSON('/api/auction/mint', { creatorWallet, name, uri }),
  confirmMint: (assetAddress: string, signature: string) =>
    postJSON('/api/auction/mint/confirm', { assetAddress, signature }),

  join: (creatorWallet: string, mintAddress: string) =>
    postJSON('/api/auction/join', { creatorWallet, mintAddress }),
  confirmJoin: (creatorWallet: string, mintAddress: string, signature: string) =>
    postJSON('/api/auction/join/confirm', { creatorWallet, mintAddress, signature }),

  vote: (voterWallet: string, candidateMint: string, numVotes?: number, paid?: boolean) =>
    postJSON('/api/auction/vote', { voterWallet, candidateMint, numVotes, paid }),
  confirmVote: (voterWallet: string, candidateMint: string, numVotes: number, epochNumber: number, signature: string) =>
    postJSON('/api/auction/vote/confirm', { voterWallet, candidateMint, numVotes, epochNumber, signature }),

  bid: (bidderWallet: string, epochNumber: number, bidAmount: number) =>
    postJSON('/api/auction/bid', { bidderWallet, epochNumber, bidAmount }),
  confirmBid: (bidderWallet: string, epochNumber: number, bidAmount: number, signature: string) =>
    postJSON('/api/auction/bid/confirm', { bidderWallet, epochNumber, bidAmount, signature }),
};
