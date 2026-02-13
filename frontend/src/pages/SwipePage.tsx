import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import Header from '../components/Header';
import Leaderboard from '../components/Leaderboard';
import { api } from '../lib/api';
import { signAndSend, truncateWallet } from '../lib/tx';
import type { Candidate, SwipeRemaining, SwipeStats, EpochData } from '../lib/types';

export default function SwipePage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const wallet = publicKey?.toBase58() || '';

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [epoch, setEpoch] = useState<EpochData | null>(null);
  const [remaining, setRemaining] = useState<SwipeRemaining | null>(null);
  const [stats, setStats] = useState<SwipeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null);
  const [flash, setFlash] = useState<'green' | 'grey' | null>(null);
  const [buyingVotes, setBuyingVotes] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setExitDir(null);
    try {
      const [nextRes, remRes, statsRes, epochRes] = await Promise.all([
        wallet ? api.getNextSwipe(wallet) : api.getCandidates().then((d: any) => {
          const list = d?.candidates || d || [];
          return { candidate: list.length > 0 ? list[Math.floor(Math.random() * list.length)] : null };
        }),
        wallet ? api.getSwipeRemaining(wallet) : Promise.resolve(null),
        wallet ? api.getSwipeStats(wallet).catch(() => null) : Promise.resolve(null),
        api.getEpoch().catch(() => null),
      ]);
      setRemaining(remRes);
      if (statsRes) setStats(statsRes);
      if (epochRes) setEpoch(epochRes);
      if (nextRes.candidate) {
        setCandidate(nextRes.candidate);
        setAllDone(false);
      } else {
        setCandidate(null);
        setAllDone(true);
      }
    } catch (err) {
      console.error('Failed to fetch next swipe:', err);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  const doSwipe = async (direction: 'left' | 'right') => {
    if (!candidate || swiping) return;
    setSwiping(true);
    setExitDir(direction);
    setFlash(direction === 'right' ? 'green' : 'grey');
    setTimeout(() => setFlash(null), 300);

    await new Promise((r) => setTimeout(r, 300));

    if (wallet) {
      try {
        await api.submitSwipe(wallet, candidate.mint_address, direction);
      } catch (err: unknown) {
        console.error('Swipe failed:', err instanceof Error ? err.message : err);
      }
    }
    // Without wallet: just browse, no vote recorded

    setSwiping(false);
    fetchNext();
  };

  const buyVotes = async () => {
    if (!publicKey || !signTransaction) return;
    setBuyingVotes(true);
    try {
      const w = publicKey.toBase58();
      const { transaction } = await api.buyVotes(w);
      const sig = await signAndSend(transaction, signTransaction, connection);
      await api.confirmBuyVotes(w, sig);
      fetchNext();
    } catch (err) {
      console.error('Buy votes failed:', err);
    }
    setBuyingVotes(false);
  };

  // Touch handlers
  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    currentX.current = 0;
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !cardRef.current) return;
    const dx = e.clientX - startX.current;
    currentX.current = dx;
    cardRef.current.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
    cardRef.current.style.transition = 'none';
  };

  const onPointerUp = () => {
    isDragging.current = false;
    if (!cardRef.current) return;
    cardRef.current.style.transition = 'transform 0.3s ease';
    if (Math.abs(currentX.current) > 100) {
      doSwipe(currentX.current > 0 ? 'right' : 'left');
    } else {
      cardRef.current.style.transform = 'translateX(0) rotate(0deg)';
    }
  };

  const noSwipesLeft = wallet && remaining && !remaining.unlimited && remaining.remaining <= 0;

  return (
    <div className="min-h-screen flex flex-col pb-[72px]">
      <Header />

      {/* Flash overlay */}
      {flash && (
        <div
          className="fixed inset-0 z-40 pointer-events-none transition-opacity duration-300"
          style={{ backgroundColor: flash === 'green' ? 'rgba(34,197,94,0.2)' : 'rgba(156,163,175,0.2)' }}
        />
      )}

      {/* Epoch + swipe counter */}
      <div className="text-center py-2 font-mono text-xs text-chum-muted space-y-1">
        {epoch && <div>Epoch {epoch.epoch_number}</div>}
        {wallet && remaining && (
          <div>{remaining.remaining}/{remaining.total} free votes</div>
        )}
        {!wallet && <div className="text-chum-accent-dim">Connect wallet to vote</div>}
      </div>

      {/* Prediction stats banner */}
      {wallet && stats && (
        <div className="flex justify-center gap-4 px-4 pb-2 font-mono text-[10px] text-chum-muted">
          <span>{stats.wins} wins</span>
          <span>{stats.streak} streak</span>
          <span>{stats.earnings ?? 0} SOL earned</span>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {loading ? (
          <div className="w-full max-w-[340px] aspect-square bg-chum-border/30 animate-pulse" />
        ) : noSwipesLeft ? (
          <div className="text-center space-y-4">
            <p className="font-mono text-chum-text text-lg">VOTES DEPLETED</p>
            <p className="font-mono text-chum-muted text-sm">No free votes remaining</p>
            <button
              onClick={buyVotes}
              disabled={buyingVotes || !signTransaction}
              className="min-h-[48px] px-6 border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors disabled:opacity-40"
            >
              {buyingVotes ? 'BUYING...' : 'BUY MORE VOTES'}
            </button>
          </div>
        ) : allDone ? (
          <div className="text-center space-y-4 w-full">
            <p className="font-mono text-chum-text text-lg">ALL JUDGED</p>
            <p className="font-mono text-chum-muted text-sm mb-4">You've seen all art this epoch</p>
            <div className="border-t border-chum-border pt-4">
              <p className="font-mono text-xs text-chum-muted uppercase tracking-widest mb-3">Leaderboard</p>
              <Leaderboard />
            </div>
          </div>
        ) : candidate ? (
          <>
            <div
              ref={cardRef}
              className="w-full max-w-[340px] overflow-hidden bg-chum-border/20 border border-chum-border shadow-lg select-none cursor-grab active:cursor-grabbing touch-none"
              style={{
                transition: 'transform 0.3s ease',
                transform: exitDir
                  ? `translateX(${exitDir === 'left' ? '-120%' : '120%'}) rotate(${exitDir === 'left' ? '-15' : '15'}deg)`
                  : 'translateX(0) rotate(0deg)',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div className="aspect-square w-full bg-black flex items-center justify-center">
                {candidate.animation_url ? (
                  <video src={candidate.animation_url} autoPlay loop muted playsInline className="w-full h-full object-contain" />
                ) : candidate.image_url ? (
                  <img src={candidate.image_url} alt={candidate.name} className="w-full h-full object-contain" draggable={false} />
                ) : (
                  <span className="text-chum-muted font-mono text-sm">No preview</span>
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="font-mono text-sm font-bold truncate">{candidate.name}</p>
                <p className="font-mono text-xs text-chum-muted">by {truncateWallet(candidate.creator_wallet)}</p>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span style={{ color: '#33ff33' }}>▲ {candidate.votes}</span>
                  {(candidate.agent_votes || 0) > 0 && (
                    <span className="text-chum-muted">AGT · {candidate.agent_votes}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-6 mt-6">
              <button
                onClick={() => doSwipe('left')}
                disabled={swiping}
                className="w-16 h-14 border-2 border-red-500/50 text-red-400 text-2xl font-bold flex items-center justify-center hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                ✗
              </button>
              <button
                onClick={() => doSwipe('right')}
                disabled={swiping}
                className="w-16 h-14 border-2 border-green-500/50 text-green-400 text-2xl font-bold flex items-center justify-center hover:bg-green-500/10 transition-colors disabled:opacity-50"
              >
                ✓
              </button>
            </div>
            <p className="mt-3 font-mono text-[10px] text-chum-muted text-center">
              Swipe right = vote yes (green) • Left = skip (no cost)
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
