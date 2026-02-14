import type { Candidate, EpochData, AuctionData } from './types';

const SUPABASE = 'https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool';

const MOCK_CANDIDATES: Candidate[] = [
  { mint_address: 'mock001', name: 'CHUM #0001', votes: 42, creator_wallet: '7xKX..mock1', animation_url: `${SUPABASE}/madlads-D6R2bm5P-1770950009.mp4`, image_url: `${SUPABASE}/madlads-D6R2bm5P-1770950009.png`, status: 'voting' },
  { mint_address: 'mock002', name: 'CHUM #0002', votes: 38, creator_wallet: '9pQR..mock2', animation_url: `${SUPABASE}/madlads-D3jCqRFY-1770950022.mp4`, image_url: `${SUPABASE}/madlads-D3jCqRFY-1770950022.png`, status: 'voting' },
  { mint_address: 'mock003', name: 'CHUM #0003', votes: 31, creator_wallet: '3kLM..mock3', animation_url: `${SUPABASE}/madlads-D5HjjwtL-1770950032.mp4`, image_url: `${SUPABASE}/madlads-D5HjjwtL-1770950032.png`, status: 'voting' },
  { mint_address: 'mock004', name: 'CHUM #0004', votes: 27, creator_wallet: '5nOP..mock4', animation_url: `${SUPABASE}/madlads-D9HyA9C5-1770950043.mp4`, image_url: `${SUPABASE}/madlads-D9HyA9C5-1770950043.png`, status: 'voting' },
  { mint_address: 'mock005', name: 'CHUM #0005', votes: 19, creator_wallet: '2jGH..mock5', animation_url: `${SUPABASE}/madlads-D7YjzjGJ-1770950053.mp4`, image_url: `${SUPABASE}/madlads-D7YjzjGJ-1770950053.png`, status: 'voting' },
  { mint_address: 'mock006', name: 'CHUM #0006', votes: 14, creator_wallet: '8mNO..mock6', animation_url: `${SUPABASE}/madlads-D3mtWBtD-1770950064.mp4`, image_url: `${SUPABASE}/madlads-D3mtWBtD-1770950064.png`, status: 'voting' },
  { mint_address: 'mock007', name: 'CHUM #0007', votes: 11, creator_wallet: '4pQR..mock7', animation_url: `${SUPABASE}/critters-FXZZ4eqS-1770950076.mp4`, image_url: `${SUPABASE}/critters-FXZZ4eqS-1770950076.png`, status: 'voting' },
  { mint_address: 'mock008', name: 'CHUM #0008', votes: 7, creator_wallet: '6sUV..mock8', animation_url: `${SUPABASE}/critters-FVRp1fZP-1770950089.mp4`, image_url: `${SUPABASE}/critters-FVRp1fZP-1770950089.png`, status: 'voting' },
  { mint_address: 'mock009', name: 'CHUM #0009', votes: 3, creator_wallet: '1aBC..mock9', animation_url: `${SUPABASE}/critters-FWMVJYWQ-1770950099.mp4`, image_url: `${SUPABASE}/critters-FWMVJYWQ-1770950099.png`, status: 'voting' },
  { mint_address: 'mock010', name: 'CHUM #0010', votes: 1, creator_wallet: '0xYZ..mockA', animation_url: `${SUPABASE}/critters-FUYH4cLN-1770950110.mp4`, image_url: `${SUPABASE}/critters-FUYH4cLN-1770950110.png`, status: 'voting' },
];

const MOCK_EPOCH: EpochData = {
  epoch_number: 3,
  end_time: new Date(Date.now() + 14 * 3600 * 1000).toISOString(), // 14h from now
  status: 'voting',
};

const MOCK_AUCTION: AuctionData = {
  epoch_number: 2,
  end_time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), // 2h from now
  current_bid: 450000000, // 0.45 SOL
  current_bidder: '7xKX..bidder1',
  mint_address: 'mock001',
  mp4_url: `${SUPABASE}/madlads-D6R2bm5P-1770950009.mp4`,
  name: 'CHUM #0001',
  anti_snipe: false,
  bids: [
    { bidder: '7xKX..bidder1', amount: 450000000, timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
    { bidder: '9pQR..bidder2', amount: 350000000, timestamp: new Date(Date.now() - 90 * 60000).toISOString() },
    { bidder: '3kLM..bidder3', amount: 200000000, timestamp: new Date(Date.now() - 150 * 60000).toISOString() },
  ],
};

let swipeIndex = 0;

export const mockApi = {
  getEpoch: async () => MOCK_EPOCH,
  getCandidates: async () => MOCK_CANDIDATES,
  getLeaderboard: async () => MOCK_CANDIDATES,
  getAuction: async () => MOCK_AUCTION,

  getNextSwipe: async (_wallet: string) => {
    const c = MOCK_CANDIDATES[swipeIndex % MOCK_CANDIDATES.length];
    swipeIndex++;
    return { candidate: c, epochNumber: MOCK_EPOCH.epoch_number };
  },
  submitSwipe: async () => ({ success: true }),
  getSwipeRemaining: async () => ({
    freeRemaining: 4,
    freeTotal: 6,
    paidRemaining: 0,
    hasSeeker: true,
    nftCount: 3,
    eligible: true,
    // legacy compat
    remaining: 4,
    total: 6,
  }),
  getMyBids: async (_wallet: string) => MOCK_BIDS,

  getSwipeStats: async () => ({
    wins: 3,
    streak: 2,
    earnings: 0.04,
    totalPredictions: 12,
  }),
};

const MOCK_BIDS = [
  { mint_address: 'mock001', name: 'CHUM #0001', amount: 450000000, status: 'winning' as const, timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
  { mint_address: 'mock002', name: 'CHUM #0002', amount: 200000000, status: 'outbid' as const, timestamp: new Date(Date.now() - 120 * 60000).toISOString() },
];

export { MOCK_BIDS };
export const USE_MOCK = true;
