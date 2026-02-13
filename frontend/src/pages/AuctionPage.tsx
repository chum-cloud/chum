import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import Header from '../components/Header';
import Countdown from '../components/Countdown';
import { api } from '../lib/api';
import { signAndSend, truncateWallet } from '../lib/tx';
import type { AuctionData, EpochData } from '../lib/types';

export default function AuctionPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [epoch, setEpoch] = useState<EpochData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [showBidInput, setShowBidInput] = useState(false);
  const [bidding, setBidding] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [auc, ep] = await Promise.all([
        api.getAuction().catch(() => null),
        api.getEpoch().catch(() => null),
      ]);
      if (auc && !auc.error) setAuction(auc);
      else setAuction(null);
      if (ep) setEpoch(ep);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  const placeBid = async () => {
    if (!publicKey || !signTransaction || !auction) return;
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) { setError('Invalid bid amount'); return; }

    setBidding(true);
    setError('');
    try {
      const wallet = publicKey.toBase58();
      const { transaction } = await api.bid(wallet, amount);
      const sig = await signAndSend(transaction, signTransaction, connection);
      await api.confirmBid(wallet, sig);
      setAuction(prev => prev ? { ...prev, current_bid: amount, current_bidder: wallet } : prev);
      setShowBidInput(false);
      setBidAmount('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bid failed');
    }
    setBidding(false);
  };

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

  if (!auction) {
    return (
      <div className="flex flex-col min-h-screen pb-[56px]">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <span className="text-4xl mb-4">◉</span>
          <p className="font-mono text-sm text-chum-muted mb-2">No active auction</p>
          <p className="font-mono text-xs text-chum-muted text-center">
            Next auction after epoch ends
          </p>
          {epoch?.end_time && (
            <div className="mt-4">
              <Countdown targetTime={new Date(epoch.end_time).getTime()} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-[56px]">
      <Header />

      <main className="flex-1 px-4 md:px-8 py-6 max-w-[480px] md:max-w-5xl mx-auto w-full">
        {/* Countdown */}
        {auction.end_time && (
          <div className="mb-4 text-center">
            <p className="font-mono text-[10px] text-chum-muted uppercase tracking-widest mb-2">Auction ends in</p>
            <Countdown targetTime={new Date(auction.end_time).getTime()} />
          </div>
        )}

        {/* Anti-snipe indicator */}
        {auction.anti_snipe && (
          <div className="mb-4 text-center">
            <span className="font-mono text-xs text-chum-warning px-3 py-1 border border-chum-warning/30">
              ANTI-SNIPE ACTIVE -- Time extended
            </span>
          </div>
        )}

        {/* Desktop: side by side. Mobile: stacked */}
        <div className="md:flex md:gap-6">
          {/* Artwork */}
          <div className="md:flex-1">
            <div className="w-full aspect-square bg-chum-surface border border-chum-border overflow-hidden mb-4 md:mb-0">
              <video
                src={auction.mp4_url || auction.uri || ''}
                autoPlay loop muted playsInline
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Bid panel */}
          <div className="md:w-[360px] md:shrink-0">
            {/* Name */}
            {auction.name && (
              <p className="font-mono text-sm text-chum-text mb-4">{auction.name}</p>
            )}

            {/* Current bid info */}
            <div className="border border-chum-border p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-chum-muted uppercase">Current Bid</span>
                <span className="font-mono text-lg text-chum-text">{auction.current_bid ?? 0} SOL</span>
              </div>
              {auction.current_bidder && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-chum-muted uppercase">Bidder</span>
                  <span className="font-mono text-xs text-chum-accent-dim">{truncateWallet(auction.current_bidder)}</span>
                </div>
              )}
            </div>

            {/* Bid controls */}
            {showBidInput ? (
              <div className="space-y-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Bid amount (SOL)"
                  className="w-full min-h-[48px] bg-chum-surface border border-chum-border text-chum-text font-mono text-sm px-4 outline-none focus:border-chum-text transition-colors"
                />
                <button
                  onClick={placeBid}
                  disabled={bidding || !publicKey}
                  className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors disabled:opacity-40"
                >
                  {bidding ? 'PLACING BID...' : 'CONFIRM BID'}
                </button>
                <button
                  onClick={() => { setShowBidInput(false); setError(''); }}
                  className="w-full font-mono text-xs text-chum-muted underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowBidInput(true)}
                disabled={!publicKey}
                className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors disabled:opacity-40"
              >
                {!publicKey ? 'CONNECT WALLET TO BID' : 'PLACE BID'}
              </button>
            )}

            {error && <p className="font-mono text-xs text-chum-danger mt-3 text-center">{error}</p>}
          </div>
        </div>

        {/* Bid history - full width */}
        {auction.bids && auction.bids.length > 0 && (
          <div className="mt-6">
            <p className="font-mono text-[10px] text-chum-muted uppercase tracking-widest mb-3">Bid History</p>
            <div className="space-y-1">
              {auction.bids.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-chum-border/30 font-mono text-xs">
                  <span className="text-chum-accent-dim">{truncateWallet(b.bidder)}</span>
                  <span className="text-chum-text">{b.amount} SOL</span>
                </div>
              ))}
            </div>
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
