import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { api } from '../lib/api';
import { truncateWallet } from '../lib/tx';
import { useVoteBalance } from '../lib/VoteBalanceContext';
import type { EpochData, AuctionData, SwipeStats, SwipeRemaining } from '../lib/types';

export default function Header() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() || '';
  const navigate = useNavigate();
  const [epoch, setEpoch] = useState<EpochData | null>(null);
  const [auction, setAuction] = useState<AuctionData | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [stats, setStats] = useState<SwipeStats | null>(null);
  const [remaining, setRemaining] = useState<SwipeRemaining | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const [ep, auc] = await Promise.all([
        api.getEpoch().catch(() => null),
        api.getAuction().catch(() => null),
      ]);
      if (ep) setEpoch(ep);
      if (auc && !auc.error) setAuction(auc);
      else setAuction(null);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!wallet || !showProfile) return;
    Promise.all([
      api.getSwipeStats(wallet).catch(() => null),
      api.getSwipeRemaining(wallet).catch(() => null),
    ]).then(([s, r]) => {
      if (s) setStats(s);
      if (r) setRemaining(r);
    });
  }, [wallet, showProfile]);

  const targetTime = auction?.end_time
    ? new Date(auction.end_time).getTime()
    : epoch?.end_time
    ? new Date(epoch.end_time).getTime()
    : 0;

  const diff = Math.max(0, Math.floor((targetTime - now) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const timeStr = `${h}h ${String(m).padStart(2, '0')}m left`;

  const claiming = false;
  const voteBalance = useVoteBalance();
  const [showVoteTooltip, setShowVoteTooltip] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b border-chum-border">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-sm uppercase tracking-widest text-chum-text">CHUM</h1>
          {epoch && targetTime > 0 && (
            <span className="font-mono text-[10px] text-chum-muted">
              {auction ? 'Auction' : `Epoch ${epoch.epoch_number}`} — {timeStr}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Vote balance badge */}
          {wallet && (
            <div className="relative">
              <button
                onClick={() => setShowVoteTooltip(!showVoteTooltip)}
                className={`px-2 py-1 border border-chum-border font-mono text-xs transition-colors ${
                  voteBalance.total > 0
                    ? 'text-[#33ff33] border-[#33ff33]/30 hover:bg-[#33ff33]/10'
                    : 'text-chum-muted hover:text-chum-text'
                }`}
              >
                ▲ {voteBalance.total}
              </button>
              {showVoteTooltip && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 bg-chum-bg border border-chum-border p-3 min-w-[200px] shadow-lg"
                  onClick={() => setShowVoteTooltip(false)}
                >
                  <p className="font-mono text-[10px] text-chum-muted uppercase tracking-widest mb-2">Vote Balance</p>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-chum-muted">Free</span>
                      <span className="text-chum-text">{voteBalance.freeRemaining}</span>
                    </div>
                    {voteBalance.hasSeeker && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-chum-muted ml-2">Seeker</span>
                        <span className="text-chum-muted">3</span>
                      </div>
                    )}
                    {voteBalance.nftCount > 0 && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-chum-muted ml-2">NFTs ({voteBalance.nftCount})</span>
                        <span className="text-chum-muted">{voteBalance.nftCount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-chum-muted">Paid packs</span>
                      <span className="text-chum-text">{voteBalance.paidRemaining}</span>
                    </div>
                    <div className="flex justify-between border-t border-chum-border/30 pt-1 mt-1">
                      <span className="text-chum-text font-bold">Total</span>
                      <span className="text-chum-text font-bold">{voteBalance.total}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {wallet && (
            <button
              onClick={() => navigate('/profile')}
              className="w-8 h-8 border border-chum-border flex items-center justify-center text-chum-muted hover:text-chum-text transition-colors font-mono text-xs"
            >
              ◉
            </button>
          )}
          <WalletMultiButton />
        </div>
      </header>

      {/* Profile panel */}
      {showProfile && wallet && (
        <div className="border-b border-chum-border bg-chum-surface px-4 py-4 max-w-[480px] md:max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { setShowProfile(false); navigate('/profile'); }} className="font-mono text-xs text-chum-text hover:underline">{truncateWallet(wallet)}</button>
            <button onClick={() => setShowProfile(false)} className="text-chum-muted text-xs">✕</button>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {stats && (
              <div className="grid grid-cols-3 gap-2">
                <div className="border border-chum-border p-2 text-center">
                  <div className="text-chum-text text-sm">{stats.wins}</div>
                  <div className="text-chum-muted text-[10px]">Wins</div>
                </div>
                <div className="border border-chum-border p-2 text-center">
                  <div className="text-chum-text text-sm">{stats.streak}</div>
                  <div className="text-chum-muted text-[10px]">Streak</div>
                </div>
                <div className="border border-chum-border p-2 text-center">
                  <div className="text-chum-text text-sm">{stats.earnings ?? 0}</div>
                  <div className="text-chum-muted text-[10px]">SOL earned</div>
                </div>
              </div>
            )}

            {remaining && (
              <div className="text-chum-muted">
                Vote packs: {remaining.unlimited ? '∞' : `${remaining.remaining}/${remaining.total}`}
              </div>
            )}

            <button
              onClick={async () => {
                try { await api.claimPrediction(wallet); } catch { /* */ }
              }}
              disabled={claiming}
              className="w-full min-h-[40px] border border-chum-border text-chum-text font-mono text-xs uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors"
            >
              Claim Prediction Rewards
            </button>
          </div>
        </div>
      )}
    </>
  );
}
