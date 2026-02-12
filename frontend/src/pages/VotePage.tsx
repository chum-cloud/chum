import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import Header from '../components/Header';
import Countdown from '../components/Countdown';
import { api } from '../lib/api';
import { signAndSend, truncateWallet } from '../lib/tx';

interface Candidate {
  mint: string;
  name: string;
  uri: string;
  image_url?: string;
  mp4_url?: string;
  votes: number;
  creator: string;
}

interface EpochData {
  epoch_number: number;
  end_time: string;
  status: string;
}

export default function VotePage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [epoch, setEpoch] = useState<EpochData | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [voting, setVoting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [epochData, candidateData] = await Promise.all([
        api.getEpoch().catch(() => null),
        api.getCandidates().catch(() => ({ candidates: [] })),
      ]);
      if (epochData) setEpoch(epochData);
      if (candidateData?.candidates) setCandidates(candidateData.candidates);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const vote = async (candidate: Candidate, paid: boolean) => {
    if (!publicKey || !signTransaction) return;
    setVoting(true);
    setError('');
    try {
      const wallet = publicKey.toBase58();
      const result = await api.vote(wallet, candidate.mint, 1, paid);

      if (result.transaction) {
        const sig = await signAndSend(result.transaction, signTransaction, connection);
        await api.confirmVote(wallet, candidate.mint, 1, epoch?.epoch_number ?? 0, sig);
      }

      // Optimistic update
      setCandidates(prev =>
        prev.map(c => c.mint === candidate.mint ? { ...c, votes: c.votes + 1 } : c)
      );
      setSelected(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Vote failed');
    }
    setVoting(false);
  };

  return (
    <div className="flex flex-col min-h-screen pb-[56px]">
      <Header title="VOTE" />

      <main className="flex-1 px-4 py-6 max-w-[480px] mx-auto w-full">
        {/* Epoch timer */}
        {epoch?.end_time && (
          <div className="mb-6 text-center">
            <p className="font-mono text-[10px] text-chum-muted uppercase tracking-widest mb-2">
              Epoch {epoch.epoch_number} ends in
            </p>
            <Countdown targetTime={new Date(epoch.end_time).getTime()} />
          </div>
        )}

        {/* Selected candidate detail */}
        {selected && (
          <div className="mb-6 border border-chum-border p-4">
            <div className="aspect-square bg-chum-surface mb-4 overflow-hidden">
              <video
                src={selected.mp4_url || selected.uri}
                autoPlay loop muted playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-sm text-chum-text">{selected.name}</span>
              <span className="font-mono text-xs text-chum-accent-dim">{selected.votes} votes</span>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => vote(selected, false)}
                disabled={voting || !publicKey}
                className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors disabled:opacity-40"
              >
                {voting ? 'VOTING...' : 'VOTE FREE'}
              </button>
              <button
                onClick={() => vote(selected, true)}
                disabled={voting || !publicKey}
                className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors disabled:opacity-40"
              >
                {voting ? 'VOTING...' : 'VOTE — 0.002 SOL'}
              </button>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-full mt-2 font-mono text-xs text-chum-muted underline"
            >
              ← back to list
            </button>
            {error && <p className="font-mono text-xs text-chum-danger mt-2 text-center">{error}</p>}
          </div>
        )}

        {/* Candidates list */}
        {!selected && (
          loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-2 border-chum-border border-t-chum-text animate-spin" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-mono text-sm text-chum-muted">No candidates this epoch</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {candidates.map((c) => (
                <button
                  key={c.mint}
                  onClick={() => setSelected(c)}
                  className="border border-chum-border hover:border-chum-text transition-colors text-left"
                >
                  <div className="aspect-square bg-chum-surface overflow-hidden">
                    {(c.mp4_url || c.uri) ? (
                      <video
                        src={c.mp4_url || c.uri}
                        autoPlay loop muted playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-chum-muted text-2xl">◆</div>
                    )}
                  </div>
                  <div className="p-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-chum-text truncate">{c.name || truncateWallet(c.mint)}</span>
                    <span className="font-mono text-[10px] text-chum-accent-dim ml-1">{c.votes}</span>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
