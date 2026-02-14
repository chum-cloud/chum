import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { api } from '../lib/api';
import { signAndSend, truncateWallet } from '../lib/tx';
import Header from '../components/Header';
import ConfirmModal from '../components/ConfirmModal';
import type { Candidate } from '../lib/types';

interface MyArtPiece {
  mint_address: string;
  name: string;
  image_url: string;
  animation_url: string;
  joined: boolean;
}

interface BidData {
  mint_address: string;
  name: string;
  amount: number;
  status: 'winning' | 'outbid' | 'won' | 'refunded';
  timestamp: string;
}

interface SwipeRemainingFull {
  freeRemaining: number;
  freeTotal: number;
  paidRemaining: number;
  nftCount: number;
  eligible: boolean;
  remaining: number;
  total: number;
  hasSeeker?: boolean;
  unlimited?: boolean;
}

interface SwipeStatsFull {
  wins: number;
  streak: number;
  earnings: number;
  totalPredictions: number;
  claimable?: number;
}

function shareToX(text: string, url: string) {
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(intent, '_blank');
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    voting: 'border-chum-text text-chum-text',
    auction: 'border-yellow-400 text-yellow-400',
    won: 'border-green-400 text-green-400',
    founder_key: 'border-purple-400 text-purple-400',
  };
  const labels: Record<string, string> = {
    voting: 'VOTING',
    auction: 'IN AUCTION',
    won: 'WON',
    founder_key: 'FOUNDER KEY',
  };
  return (
    <span className={`border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${colors[status] || 'border-chum-border text-chum-muted'}`}>
      {labels[status] || status.toUpperCase()}
    </span>
  );
}

function BidStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    winning: 'text-green-400',
    outbid: 'text-red-400',
    won: 'text-green-400',
    refunded: 'text-chum-muted',
  };
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider ${colors[status] || 'text-chum-muted'}`}>
      {status.toUpperCase()}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-chum-border pb-4 mb-4">
      <h2 className="font-mono text-xs uppercase tracking-widest text-chum-muted mb-3">{title}</h2>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const { wallet: paramWallet } = useParams<{ wallet: string }>();
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const connectedWallet = publicKey?.toBase58() || '';
  const navigate = useNavigate();

  const profileWallet = paramWallet || connectedWallet;
  const isOwnProfile = profileWallet === connectedWallet && !!connectedWallet;

  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<SwipeStatsFull | null>(null);
  const [remaining, setRemaining] = useState<SwipeRemainingFull | null>(null);
  const [bids, setBids] = useState<BidData[]>([]);
  // removed: prediction claiming state
  const [ownedArt, setOwnedArt] = useState<MyArtPiece[]>([]);
  const [joiningMint, setJoiningMint] = useState<string | null>(null);
  const [withdrawingMint, setWithdrawingMint] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<Candidate | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [voterRewards, setVoterRewards] = useState<{ totalEarned: number; pending: number; rewards: any[] } | null>(null);
  const [claimingRewards, setClaimingRewards] = useState(false);

  const myArt = allCandidates.filter((c) => c.creator_wallet === profileWallet);
  const totalVotesReceived = myArt.reduce((sum, c) => sum + (c.votes || 0), 0);

  const load = useCallback(async () => {
    if (!profileWallet) return;
    try {
      const candidates = await api.getCandidates().catch(() => []);
      const list: Candidate[] = (candidates as any)?.candidates || candidates as Candidate[] || [];
      setAllCandidates(list);

      if (isOwnProfile) {
        const [s, r, b, owned, vr] = await Promise.all([
          api.getSwipeStats(connectedWallet).catch(() => null),
          api.getSwipeRemaining(connectedWallet).catch(() => null),
          api.getMyBids(connectedWallet).catch(() => []),
          api.getMyArt(connectedWallet).catch(() => ({ art: [] })),
          api.getVoterRewards(connectedWallet).catch(() => null),
        ]);
        if (s) setStats(s as SwipeStatsFull);
        if (r) setRemaining(r as SwipeRemainingFull);
        setBids(b as BidData[]);
        setOwnedArt((owned as any)?.art || []);
        if (vr) setVoterRewards(vr as any);
      }
    } catch { /* ignore */ }
  }, [profileWallet, isOwnProfile, connectedWallet]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!paramWallet && connectedWallet) {
      navigate(`/profile/${connectedWallet}`, { replace: true });
    }
  }, [paramWallet, connectedWallet, navigate]);

  if (!profileWallet) {
    return (
      <>
        <Header />
        <div className="max-w-[480px] md:max-w-5xl mx-auto px-4 md:px-8 py-12 text-center">
          <p className="font-mono text-sm text-chum-muted mb-6">Connect wallet to view profile</p>
          <WalletMultiButton />
        </div>
      </>
    );
  }

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // removed: prediction claim handler

  return (
    <>
      <Header />
      <div className="max-w-[480px] md:max-w-5xl mx-auto px-4 md:px-8 py-4 pb-24 overflow-y-auto">
        {/* Wallet + share */}
        <div className="flex items-center justify-between mb-6">
          <span className="font-mono text-sm text-chum-text">{truncateWallet(profileWallet)}</span>
          <button
            onClick={() => shareToX('CHUM profile', `${siteUrl}/profile/${profileWallet}`)}
            className="border border-chum-border px-3 min-h-[32px] font-mono text-[10px] uppercase tracking-wider text-chum-muted hover:text-chum-text transition-colors"
          >
            Share to X
          </button>
        </div>

        {/* Desktop: stats sidebar + art. Mobile: stacked */}
        <div className="md:flex md:gap-6">
          {/* Stats sidebar on desktop */}
          <div className="md:w-[280px] md:shrink-0">
            <Section title="Stats">
              <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
                <div className="border border-chum-border p-2 text-center">
                  <div className="font-mono text-sm text-chum-text">{myArt.length}</div>
                  <div className="font-mono text-[10px] text-chum-muted">ART MINTED</div>
                </div>
                <div className="border border-chum-border p-2 text-center">
                  <div className="font-mono text-sm" style={{ color: '#33ff33' }}>{totalVotesReceived}</div>
                  <div className="font-mono text-[10px] text-chum-muted">TOTAL VOTES</div>
                </div>
                <div className="border border-chum-border p-2 text-center">
                  <div className="font-mono text-sm text-chum-text">{remaining?.nftCount ?? '--'}</div>
                  <div className="font-mono text-[10px] text-chum-muted">NFTS HELD</div>
                </div>
              </div>
            </Section>
          </div>

          {/* Art grid */}
          <div className="flex-1">
            <Section title="Art">
              {myArt.length === 0 ? (
                <p className="font-mono text-xs text-chum-muted">No art submitted</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {myArt.map((art) => (
                    <div
                      key={art.mint_address}
                      className="border border-chum-border cursor-pointer hover:border-chum-text transition-colors"
                      onClick={() => navigate(`/art/${art.mint_address}`)}
                    >
                      <div className="w-full aspect-square bg-black overflow-hidden">
                        {art.animation_url ? (
                          <video
                            src={art.animation_url}
                            className="w-full h-full object-cover"
                            muted loop autoPlay playsInline
                          />
                        ) : art.image_url ? (
                          <img src={art.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-chum-surface" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="font-mono text-xs text-chum-text truncate">{art.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs" style={{ color: '#33ff33' }}>▲ {art.votes || 0}</span>
                        </div>
                        <StatusBadge status={art.status || 'voting'} />
                        {isOwnProfile && (art.status === 'voting' || !art.status) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (withdrawingMint) return;
                              setWithdrawTarget(art);
                            }}
                            disabled={withdrawingMint === art.mint_address}
                            className="w-full mt-1 py-1 font-mono text-[10px] text-chum-muted border border-chum-border hover:text-chum-text hover:border-chum-text transition-colors uppercase tracking-wider disabled:opacity-50"
                            style={{ borderRadius: 0 }}
                          >
                            {withdrawingMint === art.mint_address ? 'WITHDRAWING...' : 'WITHDRAW'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Unjoined art - Join Leaderboard */}
            {isOwnProfile && ownedArt.filter(a => !a.joined).length > 0 && (
              <Section title="Join Leaderboard">
                <p className="font-mono text-[10px] text-chum-muted mb-2">
                  These NFTs haven't joined the leaderboard yet. Join to compete for votes and auctions (0.015 SOL).
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {ownedArt.filter(a => !a.joined).map((art) => (
                    <div key={art.mint_address} className="border border-[#33ff33]/30 bg-chum-surface">
                      <div className="w-full aspect-square bg-black overflow-hidden">
                        {art.animation_url ? (
                          <video src={art.animation_url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                        ) : art.image_url ? (
                          <img src={art.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-chum-surface" />
                        )}
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="font-mono text-xs text-chum-text truncate">{art.name}</p>
                        <button
                          onClick={async () => {
                            if (!signTransaction || joiningMint) return;
                            setJoiningMint(art.mint_address);
                            try {
                              const res = await api.joinVoting(connectedWallet, art.mint_address);
                              const sig = await signAndSend(res.transaction, signTransaction, connection);
                              await api.confirmJoin(connectedWallet, sig, art.mint_address);
                              setOwnedArt(prev => prev.map(a =>
                                a.mint_address === art.mint_address ? { ...a, joined: true } : a
                              ));
                              load();
                            } catch (e: any) {
                              console.error('Join failed:', e);
                              setErrorMessage(`Join failed: ${e?.message || e}`);
                            }
                            setJoiningMint(null);
                          }}
                          disabled={joiningMint === art.mint_address}
                          className="w-full py-1.5 font-mono text-[10px] text-black bg-[#33ff33] hover:bg-[#00cc00] transition-colors uppercase tracking-wider disabled:opacity-50"
                          style={{ borderRadius: 0 }}
                        >
                          {joiningMint === art.mint_address ? 'JOINING...' : 'JOIN LEADERBOARD (0.015 SOL)'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>

        {/* Private sections -- only for own profile */}
        {isOwnProfile && (
          <>
            <Section title="My Auction Rewards">
              {voterRewards && ((voterRewards as any).pending?.length > 0 || (voterRewards as any).claimed?.length > 0) ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border border-chum-border p-2 text-center">
                      <div className="font-mono text-sm text-[#33ff33]">{(((voterRewards as any).totalPending + (voterRewards as any).totalClaimed) / 1e9).toFixed(4)}</div>
                      <div className="font-mono text-[10px] text-chum-muted">TOTAL SOL EARNED</div>
                    </div>
                    <div className="border border-chum-border p-2 text-center">
                      <div className="font-mono text-sm text-chum-text">{((voterRewards as any).pending?.length || 0) + ((voterRewards as any).claimed?.length || 0)}</div>
                      <div className="font-mono text-[10px] text-chum-muted">WINNING VOTES</div>
                    </div>
                  </div>
                  {(voterRewards as any).totalPending > 0 && (
                    <>
                      <div className="font-mono text-xs text-chum-text">
                        Pending: {((voterRewards as any).totalPending / 1e9).toFixed(4)} SOL
                      </div>
                      <button
                        onClick={async () => {
                          setClaimingRewards(true);
                          try {
                            await api.claimVoterRewards(connectedWallet);
                            load();
                          } catch (e: any) {
                            setErrorMessage(e?.message || 'Claim failed');
                          }
                          setClaimingRewards(false);
                        }}
                        disabled={claimingRewards}
                        className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-xs uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors disabled:opacity-50"
                      >
                        {claimingRewards ? 'Claiming...' : 'Claim Voter Rewards'}
                      </button>
                    </>
                  )}
                  <div className="space-y-1">
                    {[...((voterRewards as any).pending || []), ...((voterRewards as any).claimed || [])].map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-chum-muted">Epoch {r.epoch_number}</span>
                        <span className="text-chum-text">{(r.reward_lamports / 1e9).toFixed(4)} SOL</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="font-mono text-xs text-chum-muted">No voter rewards yet. Vote for winning art to earn 20% of auction revenue.</p>
              )}
            </Section>

            <Section title="My Bids">
              {bids.length === 0 ? (
                <p className="font-mono text-xs text-chum-muted">No bids</p>
              ) : (
                <div className="space-y-2">
                  {bids.map((b, i) => (
                    <div key={i} className="flex items-center justify-between border border-chum-border p-2">
                      <div>
                        <div className="font-mono text-xs text-chum-text">{b.name}</div>
                        <div className="font-mono text-[10px] text-chum-muted">
                          {(b.amount / 1e9).toFixed(2)} SOL
                        </div>
                      </div>
                      <BidStatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Vote Packs">
              {remaining ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-chum-text">
                      Free: {remaining.freeRemaining}/{remaining.freeTotal}
                    </span>
                    <span className="font-mono text-xs text-chum-text">
                      Paid: {remaining.paidRemaining ?? 0}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate('/judge')}
                    className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-xs uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors"
                  >
                    Buy More Votes
                  </button>
                </div>
              ) : (
                <p className="font-mono text-xs text-chum-muted">Loading...</p>
              )}
            </Section>
          </>
        )}
      </div>

      {/* Withdraw confirmation modal */}
      <ConfirmModal
        open={!!withdrawTarget}
        title="Withdraw from Leaderboard?"
        message={`Return ${withdrawTarget?.name || 'this NFT'} to your wallet. It will be removed from voting.`}
        warning="No refund on 0.015 SOL join fee. Re-joining costs 0.015 SOL."
        confirmLabel="WITHDRAW"
        cancelLabel="CANCEL"
        destructive
        preview={withdrawTarget?.animation_url ? (
          <video src={withdrawTarget.animation_url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
        ) : withdrawTarget?.image_url ? (
          <img src={withdrawTarget.image_url} alt="" className="w-full h-full object-cover" />
        ) : undefined}
        onCancel={() => setWithdrawTarget(null)}
        onConfirm={async () => {
          if (!withdrawTarget) return;
          const mint = withdrawTarget.mint_address;
          setWithdrawTarget(null);
          setWithdrawingMint(mint);
          try {
            await api.withdraw(connectedWallet, mint);
            load();
          } catch (e: any) {
            setErrorMessage(`Withdraw failed: ${e?.message || e}`);
          }
          setWithdrawingMint(null);
        }}
      />

      {/* Error modal */}
      {errorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-chum-surface border border-chum-border max-w-sm w-full p-6">
            <p className="font-mono text-xs text-chum-danger mb-4">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage('')}
              className="w-full min-h-[44px] border border-chum-border text-chum-text font-mono text-xs uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
