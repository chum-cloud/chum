import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import Header from '../components/Header';
import Countdown from '../components/Countdown';
import { api } from '../lib/api';
import { signAndSend, truncateWallet } from '../lib/tx';

interface AuctionItem {
  id: number;
  epoch_number: number;
  art_mint: string;
  art_creator: string;
  current_bid: number;
  current_bidder: string | null;
  reserve_bid: number;
  start_time: string;
  end_time: string;
  settled: boolean;
  remaining_seconds: number;
  name?: string;
  mp4_url?: string;
  uri?: string;
}

function AuctionCard({ auction, onBidPlaced }: { auction: AuctionItem; onBidPlaced: () => void }) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [showBid, setShowBid] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [error, setError] = useState('');

  const currentBid = (auction.current_bid || 0) / 1e9;
  const minBid = currentBid > 0
    ? Math.ceil(currentBid * 1.1 * 1000) / 1000 // 10% increment, round up
    : (auction.reserve_bid || 200_000_000) / 1e9;

  const placeBid = async () => {
    if (!publicKey || !signTransaction) return;
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < minBid) {
      setError(`Minimum bid: ${minBid} SOL`);
      return;
    }

    setBidding(true);
    setError('');
    try {
      const wallet = publicKey.toBase58();
      const lamports = Math.floor(amount * 1e9);
      const res = await api.bid(wallet, auction.epoch_number, lamports);
      const sig = await signAndSend(res.transaction, signTransaction, connection);
      await api.confirmBid(wallet, auction.epoch_number, lamports, sig);
      setShowBid(false);
      setBidAmount('');
      onBidPlaced();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bid failed');
    }
    setBidding(false);
  };

  const endTime = new Date(auction.end_time).getTime();
  const isAntiSnipe = auction.remaining_seconds <= 300 && auction.remaining_seconds > 0;

  return (
    <div className="border border-chum-border p-4">
      {/* Countdown */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] text-chum-muted uppercase tracking-widest">
          Epoch {auction.epoch_number}
        </span>
        <Countdown targetTime={endTime} />
      </div>

      {isAntiSnipe && (
        <div className="mb-3 text-center">
          <span className="font-mono text-[10px] text-chum-warning px-2 py-0.5 border border-chum-warning/30">
            ANTI-SNIPE -- Time extended
          </span>
        </div>
      )}

      {/* Art preview + bid info side by side on desktop */}
      <div className="md:flex md:gap-4">
        {/* Artwork */}
        <div className="md:w-[200px] md:shrink-0">
          <div className="w-full aspect-square bg-chum-surface border border-chum-border overflow-hidden mb-3 md:mb-0">
            <video
              src={auction.mp4_url || auction.uri || ''}
              autoPlay loop muted playsInline
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Bid info */}
        <div className="flex-1">
          {auction.name && (
            <p className="font-mono text-sm text-chum-text mb-2">{auction.name}</p>
          )}
          <p className="font-mono text-[10px] text-chum-muted mb-1">
            Creator: {truncateWallet(auction.art_creator)}
          </p>

          <div className="flex items-center justify-between py-2 border-b border-chum-border/30 mb-2">
            <span className="font-mono text-[10px] text-chum-muted uppercase">Current Bid</span>
            <span className="font-mono text-lg text-chum-text">{currentBid} SOL</span>
          </div>
          {auction.current_bidder && (
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] text-chum-muted uppercase">Bidder</span>
              <span className="font-mono text-xs text-chum-accent-dim">{truncateWallet(auction.current_bidder)}</span>
            </div>
          )}

          <p className="font-mono text-[10px] text-chum-muted mb-3">
            Min bid: {minBid} SOL (+10%)
          </p>

          {showBid ? (
            <div className="space-y-2">
              <input
                type="number"
                step="0.01"
                min={minBid}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`${minBid} SOL or more`}
                className="w-full min-h-[44px] bg-chum-surface border border-chum-border text-chum-text font-mono text-sm px-3 outline-none focus:border-chum-text transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={placeBid}
                  disabled={bidding || !publicKey}
                  className="flex-1 min-h-[44px] bg-chum-text text-chum-bg font-mono text-xs uppercase tracking-wider hover:bg-chum-accent-dim transition-colors disabled:opacity-40"
                >
                  {bidding ? 'BIDDING...' : 'CONFIRM'}
                </button>
                <button
                  onClick={() => { setShowBid(false); setError(''); }}
                  className="min-h-[44px] px-4 border border-chum-border font-mono text-xs text-chum-muted hover:text-chum-text transition-colors"
                >
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowBid(true); setBidAmount(String(minBid)); }}
              disabled={!publicKey}
              className="w-full min-h-[44px] border border-chum-border text-chum-text font-mono text-xs uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors disabled:opacity-40"
            >
              {!publicKey ? 'CONNECT TO BID' : 'PLACE BID'}
            </button>
          )}

          {error && <p className="font-mono text-[10px] text-chum-danger mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AuctionPage() {
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('https://chum-production.up.railway.app/api/auction/auctions');
      const data = await res.json();
      if (data.success && data.auctions) {
        setAuctions(data.auctions);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen pb-[56px]">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-chum-border border-t-chum-text animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-[56px]">
      <Header />

      <main className="flex-1 px-4 md:px-8 py-6 max-w-[480px] md:max-w-5xl mx-auto w-full">
        <h2 className="font-mono text-sm text-chum-text uppercase tracking-widest mb-6">
          Active Auctions {auctions.length > 0 && `(${auctions.length})`}
        </h2>

        {auctions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-4xl mb-4">--</span>
            <p className="font-mono text-sm text-chum-muted mb-2">No active auctions</p>
            <p className="font-mono text-xs text-chum-muted text-center">
              Next auction starts when the current epoch ends
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {auctions.map((auc) => (
              <AuctionCard key={auc.id} auction={auc} onBidPlaced={load} />
            ))}
          </div>
        )}

        {/* Why win? */}
        <div className="mt-8 mb-4 space-y-2">
          <p className="font-mono text-sm text-chum-text font-bold">Why win?</p>
          <div className="space-y-0.5">
            <p className="font-mono text-[11px] text-chum-muted">Own a 1/1 Founder Key NFT.</p>
            <p className="font-mono text-[11px] text-chum-muted">Your art upgrades from Artwork to Founder Key status.</p>
            <p className="font-mono text-[11px] text-chum-muted">Founder Key holders get free daily votes forever.</p>
            <p className="font-mono text-[11px] text-chum-muted">Platform revenue share for Founder Key holders -- coming soon.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
