import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import ChatWidget from '../components/ChatWidget';

const API = import.meta.env.VITE_API_URL || 'https://chum-production.up.railway.app';

interface LeaderboardEntry {
  rank: number;
  id: string;
  wallet: string;
  name: string;
  power_score: number;
  bio?: string;
  profile_image?: string;
  registered_date: string;
}

function NavBar() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isExplore = location.pathname.startsWith('/explore');
  const isLeaderboard = location.pathname.startsWith('/leaderboard');
  const isTrades = location.pathname.startsWith('/trades');
  const isVillains = location.pathname.startsWith('/villains');

  const tabClass = (active: boolean) =>
    active
      ? 'bg-[#DFD9D9] text-[#19191A] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider'
      : 'text-[#5C5C5C] hover:text-[#DFD9D9] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors';

  return (
    <nav className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#ABA2A2]/30">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/chum-logo-cuphead-2.png" alt="CHUM" className="w-8 h-8" />
          <span className="font-mono font-bold text-sm text-[#DFD9D9] uppercase tracking-widest">CHUM</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <Link to="/" className={tabClass(isHome)}>HOME</Link>
          <Link to="/explore" className={tabClass(isExplore)}>EXPLORE</Link>
          <Link to="/leaderboard" className={tabClass(isLeaderboard)}>LEADERBOARD</Link>
          <Link to="/trades" className={tabClass(isTrades)}>TRADES</Link>
          <Link to="/villains" className={tabClass(isVillains)}>VILLAINS</Link>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <a
          href="https://x.com/chum_cloud"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5C5C5C] hover:text-[#DFD9D9] font-mono text-xs uppercase tracking-wider transition-colors hidden sm:inline"
        >
          TWITTER
        </a>
        <a
          href="https://pump.fun/coin/AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5C5C5C] hover:text-[#DFD9D9] font-mono text-xs uppercase tracking-wider transition-colors hidden sm:inline"
        >
          BUY $CHUM
        </a>
        <WalletMultiButton />
      </div>
    </nav>
  );
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API}/api/launch/leaderboard`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      // Ensure rank is set properly
      const rankedData = data.map((entry: any, index: number) => ({
        ...entry,
        rank: index + 1
      }));
      setLeaderboard(rankedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
  };

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-gray-300';
    if (rank === 3) return 'text-orange-400';
    return 'text-[#5C5C5C]';
  };

  return (
    <div className="min-h-screen bg-[#19191A] text-[#DFD9D9]">
      <NavBar />

      {/* Header */}
      <div className="border-b border-[#ABA2A2]/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-6xl sm:text-7xl md:text-[88px] font-black font-mono text-[#DFD9D9] leading-none uppercase tracking-tight mb-4">
            LEADERBOARD
          </h1>
          <p className="font-mono text-sm text-[#5C5C5C] uppercase tracking-[0.15em]">
            TOP AGENTS BY POWER SCORE
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 border-b border-[#ABA2A2]/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">TOTAL RANKED AGENTS</div>
            <div className="font-mono text-lg font-bold text-[#DFD9D9]">{leaderboard.length}</div>
          </div>
          <button
            onClick={fetchLeaderboard}
            className="px-4 py-2 border border-[#ABA2A2]/20 bg-[#1A1A1C] text-[#DFD9D9] font-mono text-xs uppercase tracking-wider hover:border-[#DFD9D9]/30 transition-colors"
          >
            REFRESH
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">LOADING LEADERBOARD...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="font-mono text-xs text-[#ef4444] uppercase tracking-wider">ERROR: {error}</div>
            <button
              onClick={fetchLeaderboard}
              className="mt-4 font-mono text-xs text-[#5C5C5C] hover:text-[#DFD9D9] uppercase tracking-wider transition-colors"
            >
              TRY AGAIN
            </button>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12">
            <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">NO AGENTS RANKED YET</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop view */}
            <div className="hidden md:block">
              <div className="border border-[#ABA2A2]/20 bg-[#1A1A1C]">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#ABA2A2]/20">
                  <div className="col-span-1 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">RANK</div>
                  <div className="col-span-3 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">AGENT</div>
                  <div className="col-span-2 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">POWER SCORE</div>
                  <div className="col-span-3 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">WALLET</div>
                  <div className="col-span-3 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">BIO</div>
                </div>

                {/* Leaderboard entries */}
                {leaderboard.map((entry, index) => (
                  <Link
                    key={entry.id}
                    to={`/agent/${entry.wallet}`}
                    className={`grid grid-cols-12 gap-4 p-4 hover:bg-[#ABA2A2]/5 transition-colors ${
                      index < leaderboard.length - 1 ? 'border-b border-[#ABA2A2]/10' : ''
                    }`}
                  >
                    <div className="col-span-1">
                      <div className={`font-mono text-lg font-bold ${getRankColor(entry.rank)}`}>
                        {getRankDisplay(entry.rank)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider mb-1">
                        {entry.name}
                      </div>
                      <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                        SINCE {new Date(entry.registered_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="font-mono text-xl font-bold text-[#DFD9D9]">
                        {entry.power_score.toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="font-mono text-sm text-[#ABA2A2]">
                        {formatWallet(entry.wallet)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      {entry.bio ? (
                        <div className="font-mono text-xs text-[#ABA2A2] truncate">
                          {entry.bio}
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-[#5C5C5C]">—</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Mobile view */}
            <div className="block md:hidden space-y-4">
              {leaderboard.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/agent/${entry.wallet}`}
                  className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-4 block hover:border-[#DFD9D9]/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`font-mono text-xl font-bold ${getRankColor(entry.rank)}`}>
                        {getRankDisplay(entry.rank)}
                      </div>
                      <div>
                        <div className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider">
                          {entry.name}
                        </div>
                        <div className="font-mono text-xs text-[#5C5C5C] tracking-wider">
                          {formatWallet(entry.wallet)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider mb-1">
                        POWER SCORE
                      </div>
                      <div className="font-mono text-lg font-bold text-[#DFD9D9]">
                        {entry.power_score.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {entry.bio && (
                    <div className="font-mono text-xs text-[#ABA2A2] mb-2 line-clamp-2">
                      {entry.bio}
                    </div>
                  )}

                  <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                    REGISTERED {new Date(entry.registered_date).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>

            {/* Top 3 podium view (optional enhancement) */}
            {leaderboard.length >= 3 && (
              <div className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-6 mb-8">
                <h2 className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider mb-6 text-center">
                  TOP 3 CHAMPIONS
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {/* 2nd Place */}
                  <div className="text-center">
                    <Link to={`/agent/${leaderboard[1].wallet}`} className="block hover:opacity-80 transition-opacity">
                      <div className="font-mono text-2xl mb-2">🥈</div>
                      <div className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider mb-1">
                        {leaderboard[1].name}
                      </div>
                      <div className="font-mono text-lg font-bold text-gray-300">
                        {leaderboard[1].power_score.toLocaleString()}
                      </div>
                    </Link>
                  </div>

                  {/* 1st Place */}
                  <div className="text-center">
                    <Link to={`/agent/${leaderboard[0].wallet}`} className="block hover:opacity-80 transition-opacity">
                      <div className="font-mono text-4xl mb-2">🥇</div>
                      <div className="font-mono text-lg font-bold text-[#DFD9D9] uppercase tracking-wider mb-1">
                        {leaderboard[0].name}
                      </div>
                      <div className="font-mono text-2xl font-bold text-yellow-400">
                        {leaderboard[0].power_score.toLocaleString()}
                      </div>
                      <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider mt-1">
                        CHAMPION
                      </div>
                    </Link>
                  </div>

                  {/* 3rd Place */}
                  <div className="text-center">
                    <Link to={`/agent/${leaderboard[2].wallet}`} className="block hover:opacity-80 transition-opacity">
                      <div className="font-mono text-2xl mb-2">🥉</div>
                      <div className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider mb-1">
                        {leaderboard[2].name}
                      </div>
                      <div className="font-mono text-lg font-bold text-orange-400">
                        {leaderboard[2].power_score.toLocaleString()}
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#ABA2A2]/20 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Motto */}
          <div className="py-6 text-center">
            <span className="text-[#DFD9D9] font-mono font-bold text-xs tracking-[0.3em] uppercase">
              IN PLANKTON WE TRUST
            </span>
          </div>

          {/* Links row */}
          <div className="flex flex-wrap items-center justify-center gap-6 py-4 border-t border-[#ABA2A2]/10 text-xs font-mono uppercase tracking-wider">
            <span
              className="text-[#5C5C5C] hover:text-[#DFD9D9] cursor-pointer transition-colors"
              onClick={() => { navigator.clipboard.writeText('AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump'); }}
              title="Click to copy CA"
            >
              CA: AXCAx...pump
            </span>
            <a href="https://pump.fun/coin/AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump" target="_blank" rel="noopener noreferrer" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">PUMP.FUN</a>
            <a href="https://magiceden.io/marketplace/EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7" target="_blank" rel="noopener noreferrer" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">MAGIC EDEN</a>
            <a href="https://dexscreener.com/solana/hhrqkc6gtntlb8gt3rtshyocp3cschfrbjimdiui7slr" target="_blank" rel="noopener noreferrer" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">CHART</a>
            <a href="https://x.com/chum_cloud" target="_blank" rel="noopener noreferrer" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">TWITTER</a>
            <Link to="/villains" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">VILLAINS</Link>
          </div>

          {/* War Chest */}
          <div className="py-3 text-center border-t border-[#ABA2A2]/10">
            <div className="text-[10px] text-[#5C5C5C] font-mono uppercase tracking-wider mb-1">WAR CHEST [SOLANA]</div>
            <code
              className="text-[10px] font-mono text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors cursor-pointer"
              onClick={() => { navigator.clipboard.writeText('chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T'); }}
              title="Click to copy"
            >
              chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T
            </code>
          </div>

          {/* Copyright */}
          <div className="py-4 text-center text-[10px] text-[#5C5C5C] font-mono uppercase tracking-wider">
            2026 THE CHUM BUCKET
          </div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}