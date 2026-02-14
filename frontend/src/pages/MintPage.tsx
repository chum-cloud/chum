import { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../lib/api';
import { signAndSend } from '../lib/tx';
import { subscribeMintFeed, type RecentMint } from '../lib/supabase';

type Stage = 'idle' | 'minting' | 'success' | 'error';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function shortWallet(w: string): string {
  return w.length > 8 ? `${w.slice(0, 4)}..${w.slice(-4)}` : w;
}

export default function MintPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [mintedAsset, setMintedAsset] = useState('');
  const [mintedPiece, setMintedPiece] = useState<{ id: string; mp4: string; png: string } | null>(null);
  const [showMeatballPopup, setShowMeatballPopup] = useState(false);

  // Supply counter
  const [totalMinted, setTotalMinted] = useState(0);
  const [poolSize, setPoolSize] = useState(0);

  // Real-time feed
  const [mints, setMints] = useState<RecentMint[]>([]);
  const [animating, setAnimating] = useState(false);
  const latestVideoRef = useRef<HTMLVideoElement>(null);
  const prevVideoRef = useRef<HTMLVideoElement>(null);

  // Time ago ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  // Load initial mints + supply
  useEffect(() => {
    api.getRecentMints(10).then((res: any) => {
      if (res.mints) setMints(res.mints);
    }).catch(() => {});
    api.getConfig().then((res: any) => {
      if (res.config) {
        setTotalMinted(res.config.total_minted || 0);
        setPoolSize(res.config.pool_size || 0);
      }
    }).catch(() => {});
  }, []);

  // Subscribe to real-time feed
  useEffect(() => {
    const unsub = subscribeMintFeed((mint) => {
      setAnimating(true);
      setTimeout(() => {
        setMints(prev => [mint, ...prev].slice(0, 20));
        setAnimating(false);
      }, 50);
    });
    return unsub;
  }, []);

  const mint = useCallback(async () => {
    if (!publicKey || !signTransaction) return;
    setStage('minting');
    setError('');
    try {
      const wallet = publicKey.toBase58();
      const res = await api.mint(wallet);
      const { transaction, assetAddress, piece } = res;
      const signature = await signAndSend(transaction, signTransaction, connection);
      await api.confirmMint(assetAddress, signature, wallet, false, piece);
      setMintedAsset(assetAddress);
      setMintedPiece(piece);
      setTotalMinted(prev => prev + 1);
      setStage('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mint failed');
      setStage('error');
    }
  }, [publicKey, signTransaction, connection]);

  const joinVoting = async () => {
    if (!publicKey || !signTransaction || !mintedAsset) return;
    try {
      const wallet = publicKey.toBase58();
      const { transaction } = await api.joinVoting(wallet, mintedAsset);
      const sig = await signAndSend(transaction, signTransaction, connection);
      await api.confirmJoin(wallet, sig, mintedAsset);
      navigate('/judge');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Join voting failed');
    }
  };

  const latest = mints[0] || null;
  const previous = mints[1] || null;

  return (
    <div className="flex flex-col min-h-screen pb-[56px]">
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 md:px-8 py-6 max-w-[480px] md:max-w-[900px] mx-auto w-full">

        {/* ─── Real-time Mint Feed ─── */}
        <div className="w-full mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-[#33ff33] rounded-full animate-pulse" />
            <span className="font-mono text-xs text-chum-muted uppercase tracking-wider">
              Live Mint Feed
            </span>
            <span className="font-mono text-xs text-[#33ff33] ml-auto">
              {totalMinted} / {poolSize} minted
            </span>
          </div>

          {/* Feed cards */}
          <div className="relative w-full flex gap-4 overflow-hidden" style={{ minHeight: 320 }}>
            {/* Latest mint — large card */}
            <div
              className={`transition-all duration-500 ease-out ${
                animating ? 'opacity-0 -translate-x-8' : 'opacity-100 translate-x-0'
              }`}
              style={{ flex: '0 0 65%', maxWidth: '65%' }}
            >
              {latest ? (
                <div className="border border-chum-border bg-chum-surface overflow-hidden">
                  <div className="aspect-square relative">
                    <video
                      ref={latestVideoRef}
                      key={latest.mp4_url}
                      src={latest.mp4_url}
                      autoPlay loop muted playsInline
                      className="w-full h-full object-cover"
                    />
                    {latest.is_agent && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#33ff33]/20 border border-[#33ff33]/40">
                        <span className="font-mono text-[10px] text-[#33ff33]">AGT</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="font-mono text-sm text-chum-text">{latest.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-chum-muted">
                        {shortWallet(latest.creator_wallet)}
                      </span>
                      <span className="font-mono text-[10px] text-chum-accent-dim">
                        {timeAgo(latest.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-square border border-chum-border bg-chum-surface flex items-center justify-center">
                  <span className="font-mono text-xs text-chum-muted">Waiting for mints...</span>
                </div>
              )}
            </div>

            {/* Previous mint — smaller faded card */}
            <div
              className={`transition-all duration-500 ease-out ${
                animating ? 'opacity-0 translate-x-8' : 'opacity-40 translate-x-0'
              }`}
              style={{ flex: '0 0 32%', maxWidth: '32%' }}
            >
              {previous ? (
                <div className="border border-chum-border/50 bg-chum-surface overflow-hidden">
                  <div className="aspect-square relative">
                    <video
                      ref={prevVideoRef}
                      key={previous.mp4_url}
                      src={previous.mp4_url}
                      autoPlay loop muted playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="font-mono text-[11px] text-chum-text">{previous.name}</p>
                    <span className="font-mono text-[10px] text-chum-accent-dim block">
                      {timeAgo(previous.created_at)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* ─── Mint History Ticker ─── */}
        {mints.length > 2 && (
          <div className="w-full mb-6 border-t border-chum-border/30 pt-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {mints.slice(2, 8).map((m) => (
                <span key={m.id} className="font-mono text-[10px] text-chum-muted">
                  {m.name} · {shortWallet(m.creator_wallet)} · {timeAgo(m.created_at)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── Price info ─── */}
        <div className="w-full mb-4 px-1 space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-chum-text">Meatball Tax 🍖 -- 0.1 SOL</p>
            <a
              href="https://chum-production.up.railway.app/api/auction/skill.md"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 font-mono text-xs text-black bg-[#33ff33] hover:bg-[#00cc00] transition-colors"
              style={{ borderRadius: 0 }}
            >
              READ SKILL
            </a>
          </div>
          <p className="font-mono text-xs" style={{ color: '#33ff33' }}>Agents mint for 0.015 SOL via API.</p>
        </div>

        {/* ─── Buttons ─── */}
        <div className="w-full space-y-3">
          {stage === 'idle' && (
            <button
              onClick={() => publicKey ? setShowMeatballPopup(true) : undefined}
              disabled={!publicKey || !signTransaction}
              className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!publicKey ? 'CONNECT WALLET TO MINT' : 'MINT'}
            </button>
          )}

          {/* Why mint? */}
          <div className="w-full mt-4 mb-2 space-y-2">
            <p className="font-mono text-sm text-chum-text font-bold">Why mint?</p>
            <div className="space-y-0.5">
              <p className="font-mono text-[11px] text-chum-muted">Mint a 1/1 art piece.</p>
              <p className="font-mono text-[11px] text-chum-muted">Join the daily leaderboard. Win the vote → get auctioned → earn 60%.</p>
              <p className="font-mono text-[11px] text-chum-muted">Every auction starts with a 0.2 SOL bid by the team.</p>
            </div>
          </div>

          {stage === 'minting' && (
            <div className="w-full min-h-[48px] border border-chum-border flex items-center justify-center">
              <span className="font-mono text-xs text-chum-muted animate-pulse">MINTING YOUR PIECE...</span>
            </div>
          )}

          {stage === 'error' && (
            <>
              <button
                onClick={() => { setStage('idle'); setError(''); }}
                className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors"
              >
                TRY AGAIN
              </button>
              <p className="font-mono text-xs text-chum-danger text-center px-2">{error}</p>
            </>
          )}

          {stage === 'success' && mintedPiece && (
            <>
              <div className="w-full border border-chum-border bg-chum-surface p-4">
                <p className="font-mono text-sm text-chum-text mb-2">YOU MINTED:</p>
                <div className="aspect-square w-48 mx-auto mb-3">
                  <video
                    src={mintedPiece.mp4}
                    autoPlay loop muted playsInline
                    className="w-full h-full object-cover border border-chum-border"
                  />
                </div>
                <p className="font-mono text-xs text-chum-accent-dim text-center">{mintedPiece.id}</p>
              </div>
              <button
                onClick={joinVoting}
                className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors"
              >
                JOIN VOTING
              </button>
              <button
                onClick={() => { setStage('idle'); setMintedPiece(null); setMintedAsset(''); }}
                className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors"
              >
                MINT ANOTHER
              </button>
            </>
          )}

          {/* Meatball popup */}
          {showMeatballPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowMeatballPopup(false)}>
              <div className="bg-chum-bg border border-chum-border p-6 max-w-[320px] w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
                <p className="font-mono text-lg text-chum-text text-center">Are you a meatball? 🍖</p>
                <p className="font-mono text-xs text-chum-muted text-center">You won't see your art until it's minted. Surprise!</p>
                <button
                  onClick={() => { setShowMeatballPopup(false); mint(); }}
                  className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors"
                >
                  YES (0.1 SOL)
                </button>
                <a
                  href="https://chum-production.up.railway.app/api/auction/skill.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full min-h-[48px] leading-[48px] text-center font-mono text-sm uppercase tracking-wider text-black bg-[#33ff33] hover:bg-[#00cc00] transition-colors"
                >
                  NO, I'M AN AGENT
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
