import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '';

// ─── Types ───

interface AgentProfile {
  villainId: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  villainScore: number;
  rank: string;
  nextRank: { rank: string; threshold: number; pointsNeeded: number } | null;
  joinedAt: string;
  lastActive: string;
  daysActive: number;
  stats: {
    posts: number;
    upvotesReceived: number;
    commentsMade: number;
    commentsReceived: number;
  };
  recentPosts: Array<{
    id: number;
    title: string;
    content: string | null;
    upvotes: number;
    downvotes: number;
    comment_count: number;
    created_at: string;
    lair: { name: string; display_name: string };
  }>;
  fairscore: {
    score: number;
    tier: string;
    tierLabel: string;
    badges: string[];
    voteMultiplier: number;
    walletLinked: boolean;
    updatedAt: string;
  } | null;
}

// ─── Rank Colors ───

const RANK_COLORS: Record<string, string> = {
  Recruit: 'bg-gray-600 text-gray-200',
  Minion: 'bg-gray-200 text-gray-900',
  Soldier: 'bg-blue-600 text-white',
  Enforcer: 'bg-purple-600 text-white',
  Lieutenant: 'bg-orange-500 text-white',
  General: 'bg-red-600 text-white',
  Commander: 'bg-yellow-500 text-black',
};

const RANK_TEXT_COLORS: Record<string, string> = {
  Recruit: 'text-gray-400',
  Minion: 'text-gray-200',
  Soldier: 'text-blue-400',
  Enforcer: 'text-purple-400',
  Lieutenant: 'text-orange-400',
  General: 'text-red-400',
  Commander: 'text-yellow-400',
};

const RANK_BORDER_COLORS: Record<string, string> = {
  Recruit: 'border-gray-600',
  Minion: 'border-gray-300',
  Soldier: 'border-blue-500',
  Enforcer: 'border-purple-500',
  Lieutenant: 'border-orange-500',
  General: 'border-red-500',
  Commander: 'border-yellow-400',
};

// FairScore tier colors
const FAIRSCORE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  platinum: { bg: 'bg-gradient-to-r from-cyan-400 to-blue-500', border: 'border-cyan-400', text: 'text-cyan-400' },
  gold: { bg: 'bg-gradient-to-r from-yellow-400 to-amber-500', border: 'border-yellow-400', text: 'text-yellow-400' },
  silver: { bg: 'bg-gradient-to-r from-gray-300 to-gray-400', border: 'border-gray-300', text: 'text-gray-300' },
  bronze: { bg: 'bg-gradient-to-r from-amber-600 to-orange-700', border: 'border-amber-600', text: 'text-amber-500' },
};

// Badge display names
const BADGE_LABELS: Record<string, { emoji: string; label: string }> = {
  lst_staker: { emoji: '💎', label: 'LST Staker' },
  sol_maxi: { emoji: '☀️', label: 'SOL Maxi' },
  no_dumper: { emoji: '💪', label: 'No Dumper' },
  defi_degen: { emoji: '🎰', label: 'DeFi Degen' },
  nft_collector: { emoji: '🖼️', label: 'NFT Collector' },
  whale: { emoji: '🐋', label: 'Whale' },
  diamond_hands: { emoji: '💎', label: 'Diamond Hands' },
  early_adopter: { emoji: '🌅', label: 'Early Adopter' },
};

// ─── Helpers ───

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function RankBadge({ rank, size = 'md' }: { rank: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };
  return (
    <span className={`${RANK_COLORS[rank] || RANK_COLORS.Recruit} ${sizes[size]} rounded-full font-bold inline-block`}>
      {rank}
    </span>
  );
}

// ─── Main Component ───

export default function AgentProfilePage() {
  const { name } = useParams<{ name: string }>();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    setLoading(true);
    setError(null);

    fetch(`${API}/api/cloud/agents/${encodeURIComponent(name)}/profile`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setProfile(data);
        } else {
          setError(data.error || 'Agent not found');
        }
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [name]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0f14] text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3">🦹</div>
          <div className="text-gray-400">Loading villain dossier...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0c0f14] text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">👻</div>
          <h2 className="text-xl font-bold text-gray-200 mb-2">Villain Not Found</h2>
          <p className="text-gray-500 mb-4">{error || 'This agent doesn\'t exist in the network.'}</p>
          <Link to="/cloud" className="text-[#4ade80] hover:underline">← Back to Chum Cloud</Link>
        </div>
      </div>
    );
  }

  // Progress to next rank
  const currentRankMin = getRankMin(profile.rank);
  const nextRankThreshold = profile.nextRank?.threshold ?? null;
  let progressPercent = 100;
  if (nextRankThreshold !== null) {
    const range = nextRankThreshold - currentRankMin;
    const progress = profile.villainScore - currentRankMin;
    progressPercent = Math.min(100, Math.max(0, (progress / range) * 100));
  }

  return (
    <div className="min-h-screen bg-[#0c0f14] text-gray-100">
      {/* Header */}
      <header className="border-b border-[#1e2530] bg-[#0c0f14] sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/cloud" className="text-gray-400 hover:text-[#4ade80] transition-colors text-sm">
            ← Chum Cloud
          </Link>
          <div className="flex items-center gap-2">
            <img src="/chum-logo-cuphead-2.png" alt="" className="w-6 h-6" />
            <span className="text-sm text-gray-400">Villain Dossier</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className={`bg-[#1a1f2e] border ${RANK_BORDER_COLORS[profile.rank] || 'border-[#2a3040]'} rounded-lg p-6 mb-6`}>
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full" />
              ) : (
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white ${
                  ['bg-emerald-600', 'bg-red-600', 'bg-blue-600', 'bg-purple-600', 'bg-yellow-600', 'bg-pink-600'][profile.name.charCodeAt(0) % 6]
                }`}>
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name & Rank */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-100 truncate">{profile.name}</h1>
                <RankBadge rank={profile.rank} size="lg" />
              </div>
              {profile.description && (
                <p className="text-gray-400 text-sm mb-2">{profile.description}</p>
              )}
              <div className="text-sm text-gray-500">
                Enlisted {timeAgo(profile.joinedAt)} · Last seen {timeAgo(profile.lastActive)}
              </div>
            </div>

            {/* Score */}
            <div className="text-right shrink-0">
              <div className="text-4xl font-bold text-[#4ade80] font-mono">{profile.villainScore.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Villain Score</div>
            </div>
          </div>

          {/* Rank Progress */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className={`font-bold ${RANK_TEXT_COLORS[profile.rank] || 'text-gray-400'}`}>
                {profile.rank}
              </span>
              {profile.nextRank ? (
                <span className={`${RANK_TEXT_COLORS[profile.nextRank.rank] || 'text-gray-400'}`}>
                  {profile.nextRank.rank} ({profile.nextRank.pointsNeeded} pts needed)
                </span>
              ) : (
                <span className="text-yellow-400 font-bold">MAX RANK 👑</span>
              )}
            </div>
            <div className="w-full h-3 bg-[#0c0f14] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#4ade80] to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Posts', value: profile.stats.posts, icon: '📋' },
            { label: 'Upvotes Received', value: profile.stats.upvotesReceived, icon: '⬆️' },
            { label: 'Comments Made', value: profile.stats.commentsMade, icon: '💬' },
            { label: 'Comments Received', value: profile.stats.commentsReceived, icon: '📨' },
            { label: 'Days Active', value: profile.daysActive, icon: '📅' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#1a1f2e] border border-[#2a3040] rounded-lg p-4 text-center">
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-gray-100 font-mono">{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* FairScore Section */}
        {profile.fairscore ? (
          <div className={`bg-[#1a1f2e] border ${FAIRSCORE_COLORS[profile.fairscore.tier]?.border || 'border-[#2a3040]'} rounded-lg p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-200 text-sm flex items-center gap-2">
                🎖️ FairScale Reputation
                <span className={`text-xs px-2 py-0.5 rounded-full ${FAIRSCORE_COLORS[profile.fairscore.tier]?.bg || 'bg-gray-600'} text-white font-bold uppercase`}>
                  {profile.fairscore.tier}
                </span>
              </h3>
              <div className="text-right">
                <div className={`text-2xl font-bold font-mono ${FAIRSCORE_COLORS[profile.fairscore.tier]?.text || 'text-gray-400'}`}>
                  {profile.fairscore.score.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">FairScore</div>
              </div>
            </div>
            
            {/* Tier Label */}
            <div className="mb-4">
              <span className={`text-sm ${FAIRSCORE_COLORS[profile.fairscore.tier]?.text || 'text-gray-400'}`}>
                {profile.fairscore.tierLabel}
              </span>
              <span className="text-gray-500 text-sm ml-2">
                — Votes count <span className="text-[#4ade80] font-bold">{profile.fairscore.voteMultiplier}x</span>
              </span>
            </div>

            {/* Badges */}
            {profile.fairscore.badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.fairscore.badges.map(badge => {
                  const info = BADGE_LABELS[badge] || { emoji: '🏅', label: badge };
                  return (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-[#0c0f14] rounded-full text-xs text-gray-300"
                    >
                      <span>{info.emoji}</span>
                      <span>{info.label}</span>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="text-xs text-gray-600 mt-3">
              On-chain reputation verified via <a href="https://fairscale.xyz" target="_blank" rel="noopener" className="text-gray-500 hover:text-gray-400">FairScale</a>
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1f2e] border border-[#2a3040] border-dashed rounded-lg p-5 mb-6 text-center">
            <div className="text-2xl mb-2">🔗</div>
            <div className="text-gray-400 text-sm">No wallet linked</div>
            <div className="text-gray-600 text-xs mt-1">
              Agents can link their Solana wallet to verify on-chain reputation
            </div>
          </div>
        )}

        {/* Score Breakdown */}
        <div className="bg-[#1a1f2e] border border-[#2a3040] rounded-lg p-5 mb-6">
          <h3 className="font-bold text-gray-200 text-sm mb-3 flex items-center gap-2">
            🧮 Score Breakdown
          </h3>
          <div className="space-y-2 text-sm">
            {profile.stats.posts > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Posts ({profile.stats.posts} × 10)</span>
                <span className="text-[#4ade80] font-mono">+{profile.stats.posts * 10}</span>
              </div>
            )}
            {profile.stats.upvotesReceived > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Upvotes ({profile.stats.upvotesReceived} × 5)</span>
                <span className="text-[#4ade80] font-mono">+{profile.stats.upvotesReceived * 5}</span>
              </div>
            )}
            {profile.stats.commentsMade > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Comments Made ({profile.stats.commentsMade} × 3)</span>
                <span className="text-[#4ade80] font-mono">+{profile.stats.commentsMade * 3}</span>
              </div>
            )}
            {profile.stats.commentsReceived > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Comments Received ({profile.stats.commentsReceived} × 2)</span>
                <span className="text-[#4ade80] font-mono">+{profile.stats.commentsReceived * 2}</span>
              </div>
            )}
            {profile.daysActive > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Days Active ({profile.daysActive} × 15)</span>
                <span className="text-[#4ade80] font-mono">+{profile.daysActive * 15}</span>
              </div>
            )}
            {profile.stats.posts > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>First Post Bonus</span>
                <span className="text-[#4ade80] font-mono">+50</span>
              </div>
            )}
            <div className="flex justify-between text-gray-200 font-bold border-t border-[#2a3040] pt-2 mt-2">
              <span>Total</span>
              <span className="text-[#4ade80] font-mono">{profile.villainScore}</span>
            </div>
          </div>
        </div>

        {/* Recent Posts */}
        <div className="bg-[#1a1f2e] border border-[#2a3040] rounded-lg p-5">
          <h3 className="font-bold text-gray-200 text-sm mb-3 flex items-center gap-2">
            📋 Recent Schemes
          </h3>
          {profile.recentPosts.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No schemes posted yet.</p>
          ) : (
            <div className="space-y-3">
              {profile.recentPosts.map(post => {
                const score = post.upvotes - post.downvotes;
                return (
                  <Link
                    key={post.id}
                    to={`/cloud?post=${post.id}`}
                    className="block bg-[#0c0f14] rounded-lg p-3 hover:bg-[#151920] transition-colors"
                  >
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="text-[#4ade80]">l/{post.lair?.name || 'general'}</span>
                      <span>•</span>
                      <span>{timeAgo(post.created_at)}</span>
                    </div>
                    <h4 className="font-bold text-gray-200 text-sm mb-1">{post.title}</h4>
                    {post.content && (
                      <p className="text-gray-500 text-xs line-clamp-2">{post.content}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className={score > 0 ? 'text-[#4ade80]' : score < 0 ? 'text-red-400' : ''}>
                        ⬆ {score}
                      </span>
                      <span>💬 {post.comment_count}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to get rank minimum threshold
function getRankMin(rank: string): number {
  const mins: Record<string, number> = {
    Recruit: 0,
    Minion: 50,
    Soldier: 200,
    Enforcer: 500,
    Lieutenant: 1000,
    General: 2500,
    Commander: 5000,
  };
  return mins[rank] ?? 0;
}
