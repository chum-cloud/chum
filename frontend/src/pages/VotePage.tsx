import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import Header from '../components/Header';
import { api } from '../lib/api';
import { signAndSend, truncateWallet } from '../lib/tx';
import { useVoteBalance } from '../lib/VoteBalanceContext';
import type { Candidate, EpochData } from '../lib/types';

type Tab = 'hot' | 'trending' | 'new';

export default function VotePage() {
  const navigate = useNavigate();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const wallet = publicKey?.toBase58() || '';
  const [tab, setTab] = useState<Tab>('hot');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votedMints, setVotedMints] = useState<Set<string>>(new Set());
  const [votingMint, setVotingMint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [epoch, setEpoch] = useState<EpochData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [voteSelector, setVoteSelector] = useState<string | null>(null); // mint address of open selector
  const voteBalance = useVoteBalance();

  useEffect(() => {
    Promise.all([
      api.getCandidates(),
      api.getEpoch().catch(() => null),
    ]).then(([data, ep]) => {
      const list: Candidate[] = data?.candidates || data || [];
      setCandidates(list);
      if (ep) setEpoch(ep);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const sorted = (() => {
    const list = [...candidates];
    if (tab === 'hot') return list.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    if (tab === 'trending') return list.sort((a, b) => ((b as any).recent_votes || b.votes || 0) - ((a as any).recent_votes || a.votes || 0));
    return list.sort((a, b) => {
      const ta = new Date((a as any).created_at || 0).getTime();
      const tb = new Date((b as any).created_at || 0).getTime();
      return tb - ta;
    });
  })();

  const totalVotes = candidates.reduce((sum, c) => sum + (c.votes || 0), 0);

  const handleBulkVote = async (e: React.MouseEvent, mint: string, numVotes: number) => {
    e.stopPropagation();
    if (!wallet || !signTransaction || votingMint) return;
    setVotingMint(mint);
    setVoteSelector(null);
    try {
      // Use free votes first, then paid
      const freeToUse = Math.min(numVotes, voteBalance.freeRemaining);
      const paidToUse = numVotes - freeToUse;

      if (freeToUse > 0) {
        await api.voteFree(wallet, mint, freeToUse);
      }
      if (paidToUse > 0) {
        const result = await api.votePaid(wallet, mint, paidToUse);
        if (result.transaction) {
          const sig = await signAndSend(result.transaction, signTransaction, connection);
          await api.confirmVote(wallet, sig);
        }
      }

      setVotedMints((prev) => new Set(prev).add(mint));
      setCandidates((prev) =>
        prev.map((c) => c.mint_address === mint ? { ...c, votes: c.votes + numVotes } : c)
      );
      voteBalance.refresh();
    } catch (err) {
      console.error('Vote failed:', err);
    }
    setVotingMint(null);
  };

  const voteOptions = (mint: string) => {
    const remaining = voteBalance.total;
    const opts = [1, 3, 5].filter(n => n <= remaining);
    if (remaining > 5) opts.push(remaining);
    return opts;
  };

  const epochEndTime = epoch?.end_time ? new Date(epoch.end_time).getTime() : 0;
  const diff = Math.max(0, Math.floor((epochEndTime - now) / 1000));
  const eh = Math.floor(diff / 3600);
  const em = Math.floor((diff % 3600) / 60);
  const es = diff % 60;

  return (
    <div className="flex flex-col min-h-screen pb-[56px]">
      <Header />
      {/* Marquee ticker */}
      <div className="w-full overflow-hidden border-b border-chum-border/30 py-1.5">
        <div className="animate-marquee whitespace-nowrap">
          <span className="font-mono text-[10px] text-chum-accent-dim">
            Vote for your favorite art every day &rarr; Winners get auctioned &rarr; Voters who pick the winner split 20% &rarr; Hold a CHUM: Fellow Villains NFT? Your vote counts 2x &rarr;&nbsp;&nbsp;&nbsp;&nbsp;
            Vote for your favorite art every day &rarr; Winners get auctioned &rarr; Voters who pick the winner split 20% &rarr; Hold a CHUM: Fellow Villains NFT? Your vote counts 2x &rarr;&nbsp;&nbsp;&nbsp;&nbsp;
          </span>
        </div>
      </div>

      <main className="flex-1 px-4 md:px-8 py-4 max-w-[480px] md:max-w-5xl mx-auto w-full">
        {/* Tabs */}
        <div className="flex border border-chum-border mb-4">
          {(['hot', 'trending', 'new'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                tab === t ? 'bg-chum-text text-chum-bg' : 'text-chum-muted hover:text-chum-text'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-2 border-chum-border border-t-chum-text animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="font-mono text-xs text-chum-muted text-center py-16">No art this epoch yet.</p>
        ) : (
          <div className="md:flex md:gap-6">
            {/* Main grid */}
            <div className="flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sorted.map((c) => {
                  const voted = votedMints.has(c.mint_address);
                  const isVoting = votingMint === c.mint_address;
                  return (
                    <div
                      key={c.mint_address}
                      onClick={() => navigate(`/art/${c.mint_address}`)}
                      className="border border-chum-border bg-chum-surface cursor-pointer hover:border-chum-text transition-colors"
                    >
                      <div className="w-full aspect-square bg-black overflow-hidden">
                        {c.animation_url ? (
                          <video src={c.animation_url} muted playsInline autoPlay loop className="w-full h-full object-cover" />
                        ) : c.image_url ? (
                          <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-chum-surface" />
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="font-mono text-xs text-chum-text truncate">
                          {c.name || `CHUM #${c.mint_address.slice(-4)}`}
                        </p>
                        <div className="flex items-center gap-2 relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!wallet || voted || isVoting) return;
                              if (voteBalance.total <= 1) {
                                handleBulkVote(e, c.mint_address, 1);
                              } else {
                                setVoteSelector(voteSelector === c.mint_address ? null : c.mint_address);
                              }
                            }}
                            disabled={voted || isVoting || !wallet}
                            className={`font-mono text-xs px-1.5 py-0.5 transition-colors ${
                              voted
                                ? 'bg-[#33ff33] text-black'
                                : 'border border-[#33ff33] text-[#33ff33] hover:bg-[#33ff33] hover:text-black'
                            } ${isVoting ? 'opacity-50' : ''} ${!wallet ? 'opacity-30 cursor-default' : ''}`}
                            style={{ borderRadius: 0 }}
                          >
                            {isVoting ? '...' : `▲ ${c.votes || 0}`}
                          </button>
                          {/* Bulk vote selector */}
                          {voteSelector === c.mint_address && (
                            <div className="absolute left-0 top-full mt-1 z-40 bg-chum-bg border border-chum-border shadow-lg flex gap-0" onClick={e => e.stopPropagation()}>
                              {voteOptions(c.mint_address).map(n => (
                                <button
                                  key={n}
                                  onClick={(e) => handleBulkVote(e, c.mint_address, n)}
                                  className="px-2 py-1 font-mono text-[10px] text-[#33ff33] hover:bg-[#33ff33] hover:text-black border-r border-chum-border/30 last:border-r-0 transition-colors"
                                >
                                  {n === voteBalance.total && n > 5 ? `ALL (${n})` : `+${n}`}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/profile/${c.creator_wallet}`);
                          }}
                          className="font-mono text-[10px] text-chum-muted hover:text-chum-text transition-colors"
                        >
                          {truncateWallet(c.creator_wallet)}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop sidebar - epoch info */}
            <div className="hidden md:block w-[240px] shrink-0">
              <div className="border border-chum-border p-4 space-y-4 sticky top-4">
                <h3 className="font-mono text-xs text-chum-muted uppercase tracking-widest">Epoch Info</h3>
                {epoch && (
                  <div className="space-y-3">
                    <div>
                      <div className="font-mono text-[10px] text-chum-muted uppercase">Epoch</div>
                      <div className="font-mono text-lg text-chum-text">{epoch.epoch_number}</div>
                    </div>
                    {epochEndTime > 0 && (
                      <div>
                        <div className="font-mono text-[10px] text-chum-muted uppercase">Time Remaining</div>
                        <div className="font-mono text-sm text-chum-text">{eh}h {String(em).padStart(2, '0')}m {String(es).padStart(2, '0')}s</div>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <div className="font-mono text-[10px] text-chum-muted uppercase">Candidates</div>
                  <div className="font-mono text-sm text-chum-text">{candidates.length}</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] text-chum-muted uppercase">Total Votes</div>
                  <div className="font-mono text-sm text-chum-text">{totalVotes}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Why vote? */}
        <div className="mt-8 mb-4 space-y-2">
          <p className="font-mono text-sm text-chum-text font-bold">Why vote?</p>
          <div className="space-y-0.5">
            <p className="font-mono text-[11px] text-chum-muted">Vote for your favorite art every day.</p>
            <p className="font-mono text-[11px] text-chum-muted">The winning piece gets auctioned.</p>
            <p className="font-mono text-[11px] text-chum-muted">Voters who picked the winner split 20% of the auction.</p>
            <p className="font-mono text-[11px] text-chum-muted">Hold a CHUM: Fellow Villain NFT? Your vote counts 2x.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
