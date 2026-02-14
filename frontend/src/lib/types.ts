export interface Candidate {
  mint_address: string;
  name: string;
  image_url?: string;
  animation_url?: string;
  creator_wallet: string;
  votes: number;
  status?: 'voting' | 'auction' | 'founder_key';
}

export interface EpochData {
  epoch_number: number;
  end_time: string;
  status: string;
}

export interface AuctionData {
  epoch_number: number;
  end_time: string;
  current_bid: number;
  current_bidder: string;
  mint_address: string;
  mp4_url?: string;
  uri?: string;
  name?: string;
  anti_snipe?: boolean;
  bids?: Array<{ bidder: string; amount: number; timestamp: string }>;
}

export interface SwipeRemaining {
  unlimited?: boolean;
  remaining: number;
  total: number;
  eligible: boolean;
}

export interface SwipeStats {
  wins: number;
  streak: number;
  earnings: number;
  totalPredictions: number;
}

export interface PoolPiece {
  piece_id: string;
  mp4_url: string;
  png_url: string;
}
