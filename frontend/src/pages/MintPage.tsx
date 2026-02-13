import { useState, useRef, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { POOL, randomPiece } from '../lib/pool';
import type { PoolPiece, Candidate } from '../lib/types';
import { api } from '../lib/api';
import { signAndSend } from '../lib/tx';

type Stage = 'idle' | 'generating' | 'ready' | 'minting' | 'success' | 'error';
type LeaderboardTab = 'hot' | 'trending' | 'new';

export default function MintPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const navigate = useNavigate();
  const [piece, setPiece] = useState<PoolPiece>(POOL[0]);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [mintedSig, setMintedSig] = useState('');
  const [mintedAsset, setMintedAsset] = useState('');
  const [showMeatballPopup, setShowMeatballPopup] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [lbTab, setLbTab] = useState<LeaderboardTab>('hot');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [lbLoading, setLbLoading] = useState(true);

  useEffect(() => {
    api.getCandidates()
      .then((data) => {
        const list: Candidate[] = data?.candidates || data || [];
        setCandidates(list);
      })
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, []);

  const sortedCandidates = (() => {
    const list = [...candidates];
    if (lbTab === 'hot') {
      return list.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    }
    if (lbTab === 'trending') {
      // Sort by recent votes — use recent_votes if available, fallback to votes
      return list.sort((a, b) => ((b as any).recent_votes || b.votes || 0) - ((a as any).recent_votes || a.votes || 0));
    }
    // new — newest first
    return list.sort((a, b) => {
      const ta = new Date((a as any).created_at || 0).getTime();
      const tb = new Date((b as any).created_at || 0).getTime();
      return tb - ta;
    });
  })();

  const rankBadge = (i: number) => {
    if (lbTab !== 'hot') return null;
    if (i === 0) return <span className="text-yellow-400 font-bold">1</span>;
    if (i === 1) return <span className="text-gray-400 font-bold">2</span>;
    if (i === 2) return <span className="text-orange-400 font-bold">3</span>;
    return null;
  };

  const generate = () => {
    setStage('generating');
    setError('');
    setTimeout(() => {
      const p = randomPiece();
      setPiece(p);
      setStage('ready');
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
      }
    }, 600);
  };

  const mint = async () => {
    if (!publicKey || !signTransaction) return;
    setStage('minting');
    setError('');
    try {
      const wallet = publicKey.toBase58();
      const { transaction, assetAddress } = await api.mint(wallet);
      const signature = await signAndSend(transaction, signTransaction, connection);
      await api.confirmMint(wallet, signature);
      setMintedAsset(assetAddress || '');
      setMintedSig(signature);
      setStage('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mint failed');
      setStage('error');
    }
  };

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

  return (
    <div className="flex flex-col min-h-screen pb-[56px]">
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-[480px] mx-auto w-full">
        {/* Video Preview */}
        <div className="w-full aspect-square bg-chum-surface border border-chum-border relative overflow-hidden mb-6">
          {stage === 'generating' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-chum-border border-t-chum-text animate-spin" />
            </div>
          ) : stage === 'success' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
              <div className="text-4xl">✓</div>
              <p className="font-mono text-sm text-chum-text text-center">MINTED SUCCESSFULLY</p>
              <p className="font-mono text-[10px] text-chum-muted break-all">{mintedSig}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={piece.mp4_url}
              autoPlay loop muted playsInline
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Info */}
        <div className="w-full mb-2 px-1">
          <span className="font-mono text-xs text-chum-accent-dim">
            CHUM #{piece.piece_id.replace('chum-', '#').replace('#', '')}
          </span>
        </div>

        {/* Price info */}
        <div className="w-full mb-4 px-1 space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-chum-text">Meatball Tax 🍖 — 0.1 SOL</p>
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
          <p className="font-mono text-xs" style={{ color: '#33ff33' }}>Agents mint for 0.015 SOL.</p>
        </div>

        {/* Buttons */}
        <div className="w-full space-y-3">
          {stage !== 'success' && (
            <button
              onClick={generate}
              disabled={stage === 'generating' || stage === 'minting'}
              className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {stage === 'generating' ? 'GENERATING...' : 'GENERATE'}
            </button>
          )}

          {(stage === 'ready' || stage === 'error') && (
            <button
              onClick={() => publicKey ? setShowMeatballPopup(true) : undefined}
              disabled={!publicKey || !signTransaction}
              className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!publicKey ? 'CONNECT WALLET' : 'MINT — MEATBALL TAX 🍖 0.1 SOL'}
            </button>
          )}

          {/* Meatball popup */}
          {showMeatballPopup && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowMeatballPopup(false)}>
              <div className="bg-chum-bg border border-chum-border p-6 max-w-[320px] w-full mx-4 space-y-4" onClick={e => e.stopPropagation()}>
                <p className="font-mono text-lg text-chum-text text-center">🍖 Are you a meatball?</p>
                <p className="font-mono text-xs text-chum-muted text-center">If you're clicking buttons, you already know the answer.</p>
                <button
                  onClick={() => { setShowMeatballPopup(false); mint(); }}
                  className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors"
                >
                  YES 🍖 (0.1 SOL)
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

          {stage === 'minting' && (
            <div className="w-full min-h-[48px] border border-chum-border flex items-center justify-center">
              <span className="font-mono text-xs text-chum-muted animate-pulse">SIGNING TRANSACTION...</span>
            </div>
          )}

          {stage === 'success' && (
            <>
              <button
                onClick={joinVoting}
                className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors"
              >
                JOIN VOTING
              </button>
              <button
                onClick={() => { setStage('idle'); generate(); }}
                className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors"
              >
                MINT ANOTHER
              </button>
            </>
          )}

          {error && (
            <p className="font-mono text-xs text-chum-danger text-center px-2">{error}</p>
          )}
        </div>

        {/* ── Leaderboard ── */}
        <div className="w-full mt-8 border-t border-chum-border pt-6">
          {/* Tabs */}
          <div className="flex border border-chum-border mb-4">
            {(['hot', 'trending', 'new'] as LeaderboardTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setLbTab(tab)}
                className={`flex-1 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                  lbTab === tab
                    ? 'bg-chum-text text-chum-bg'
                    : 'text-chum-muted hover:text-chum-text'
                }`}
              >
                {tab === 'hot' ? 'HOT' : tab === 'trending' ? 'TRENDING' : 'NEW'}
              </button>
            ))}
          </div>

          {/* List */}
          {lbLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-chum-border border-t-chum-text animate-spin" />
            </div>
          ) : sortedCandidates.length === 0 ? (
            <p className="font-mono text-xs text-chum-muted text-center py-8">No art this epoch yet. Be the first to mint!</p>
          ) : (
            <div className="space-y-2">
              {sortedCandidates.map((c, i) => (
                <button
                  key={c.mint_address}
                  onClick={() => navigate(`/art/${c.mint_address}`)}
                  className="w-full flex items-center gap-3 p-2 border border-chum-border hover:bg-chum-surface transition-colors text-left"
                >
                  {/* Rank / badge */}
                  <div className="w-8 text-center font-mono text-xs shrink-0">
                    {rankBadge(i) || (
                      <span className="text-chum-muted">{i + 1}</span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-12 h-12 bg-black border border-chum-border overflow-hidden shrink-0">
                    {c.animation_url ? (
                      <video src={c.animation_url} muted playsInline autoPlay loop className="w-full h-full object-cover" />
                    ) : c.image_url ? (
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-chum-surface" />
                    )}
                  </div>

                  {/* Name + votes */}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs text-chum-text truncate">
                      {c.name || `CHUM #${c.mint_address.slice(-4)}`}
                    </p>
                    <p className="font-mono text-[10px]">
                      <span style={{ color: '#33ff33' }}>▲ {c.votes || 0}</span>
                      {c.agent_votes ? <span className="text-chum-muted ml-2">AGT · {c.agent_votes}</span> : null}
                    </p>
                  </div>

                  {/* Arrow */}
                  <span className="text-chum-muted text-xs shrink-0">→</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
