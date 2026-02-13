import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import Header from '../components/Header';
import { api } from '../lib/api';
import { signAndSend, truncateWallet } from '../lib/tx';
import type { Candidate } from '../lib/types';

export default function ArtDetailPage() {
  const { mint } = useParams<{ mint: string }>();
  const navigate = useNavigate();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const wallet = publicKey?.toBase58() || '';

  const [art, setArt] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<'free' | 'paid' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!mint) return;
    api.getCandidates()
      .then((data) => {
        const candidates: Candidate[] = data?.candidates || data || [];
        const found = candidates.find((c) => c.mint_address === mint);
        if (found) setArt(found);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mint]);

  const voteFree = async () => {
    if (!wallet || !signTransaction || !art) return;
    setVoting('free');
    setError('');
    setSuccess('');
    try {
      const result = await api.voteFree(wallet, art.mint_address);
      if (result.transaction) {
        const sig = await signAndSend(result.transaction, signTransaction, connection);
        await api.confirmVote(wallet, sig);
      }
      setArt((prev) => prev ? { ...prev, votes: prev.votes + 1 } : prev);
      setSuccess('Vote cast! 🗳️');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Vote failed');
    }
    setVoting(null);
  };

  const votePaid = async () => {
    if (!wallet || !signTransaction || !art) return;
    setVoting('paid');
    setError('');
    setSuccess('');
    try {
      const result = await api.votePaid(wallet, art.mint_address);
      if (result.transaction) {
        const sig = await signAndSend(result.transaction, signTransaction, connection);
        await api.confirmVote(wallet, sig);
      }
      setArt((prev) => prev ? { ...prev, votes: prev.votes + 1 } : prev);
      setSuccess('Paid vote cast! 💰');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Vote failed');
    }
    setVoting(null);
  };

  const shareToTwitter = () => {
    if (!art) return;
    const text = encodeURIComponent(`Check out ${art.name || 'this CHUM art'} on CHUM: Reanimation! 🎨`);
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
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

  if (!art) {
    return (
      <div className="flex flex-col min-h-screen pb-[56px]">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-sm text-chum-muted">Art not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-[56px]">
      <Header />

      <main className="flex-1 px-4 py-6 max-w-[480px] mx-auto w-full">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="font-mono text-xs text-chum-muted hover:text-chum-text mb-3"
        >
          ← BACK
        </button>

        {/* Full screen MP4 */}
        <div className="w-full aspect-square bg-black border border-chum-border overflow-hidden mb-4">
          {art.animation_url ? (
            <video src={art.animation_url} autoPlay loop muted playsInline className="w-full h-full object-contain" />
          ) : art.image_url ? (
            <img src={art.image_url} alt={art.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-chum-muted">No preview</div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-3 mb-6">
          <h2 className="font-mono text-sm text-chum-text">{art.name || `CHUM: Reanimation #${mint?.slice(-4)}`}</h2>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-chum-muted">Votes</span>
            <span className="text-base font-bold" style={{ color: '#33ff33' }}>▲ {art.votes}</span>
          </div>
          {art.agent_votes ? (
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-chum-muted">Agent Votes</span>
              <span className="text-chum-muted">AGT · {art.agent_votes}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-chum-muted">Creator</span>
            <span className="text-chum-accent-dim">{truncateWallet(art.creator_wallet)}</span>
          </div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-chum-muted">Status</span>
            <span className="text-chum-text uppercase">{art.status || 'Voting'}</span>
          </div>
        </div>

        {/* Vote Actions */}
        <div className="space-y-3">
          <p className="font-mono text-xs text-chum-muted text-center">Vote for this piece</p>

          {/* Free vote (holders only) */}
          <button
            onClick={voteFree}
            disabled={voting !== null || !publicKey}
            className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors disabled:opacity-40"
          >
            {voting === 'free' ? 'VOTING...' : !publicKey ? 'CONNECT WALLET TO VOTE' : 'FREE VOTE (HOLDERS)'}
          </button>

          {/* Paid vote (escalating price) */}
          <button
            onClick={votePaid}
            disabled={voting !== null || !publicKey}
            className="w-full min-h-[48px] bg-chum-surface border border-chum-border font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors disabled:opacity-40"
            style={{ color: '#33ff33' }}
          >
            {voting === 'paid' ? 'SIGNING...' : 'PAID VOTE (0.002+ SOL)'}
          </button>

          <p className="font-mono text-[10px] text-chum-muted text-center">
            Paid votes use escalating pricing. Voter rewards go to winning art's voters.
          </p>
        </div>

        {success && <p className="font-mono text-xs text-center mt-3" style={{ color: '#33ff33' }}>{success}</p>}
        {error && <p className="font-mono text-xs text-chum-danger mt-3 text-center">{error}</p>}

        {/* Share */}
        <div className="mt-6">
          <button
            onClick={shareToTwitter}
            className="w-full min-h-[48px] bg-chum-surface border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors"
          >
            SHARE TO 𝕏
          </button>
        </div>
      </main>
    </div>
  );
}
