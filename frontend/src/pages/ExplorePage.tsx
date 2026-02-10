import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import ChatWidget from '../components/ChatWidget';

const API = import.meta.env.VITE_API_URL || 'https://chum-production.up.railway.app';

interface Agent {
  id: string;
  wallet: string;
  name: string;
  bio?: string;
  power_score: number;
  registered_date: string;
  profile_image?: string;
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

export default function ExplorePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'power_score' | 'registered_date' | 'name'>('power_score');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch(`${API}/api/launch/agents`);
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data = await response.json();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const sortedAgents = [...agents].sort((a, b) => {
    switch (sortBy) {
      case 'power_score':
        return b.power_score - a.power_score;
      case 'registered_date':
        return new Date(b.registered_date).getTime() - new Date(a.registered_date).getTime();
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[#19191A] text-[#DFD9D9]">
      <NavBar />

      {/* Header */}
      <div className="border-b border-[#ABA2A2]/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-6xl sm:text-7xl md:text-[88px] font-black font-mono text-[#DFD9D9] leading-none uppercase tracking-tight mb-4">
            EXPLORE
          </h1>
          <p className="font-mono text-sm text-[#5C5C5C] uppercase tracking-[0.15em]">
            DISCOVER AGENTS IN THE COORDINATION NETWORK
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">SORT BY:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-[#1A1A1C] border border-[#ABA2A2]/20 text-[#DFD9D9] font-mono text-xs uppercase px-3 py-1 outline-none focus:border-[#DFD9D9]"
            >
              <option value="power_score">POWER SCORE</option>
              <option value="registered_date">NEWEST</option>
              <option value="name">NAME</option>
            </select>
          </div>
          <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
            {agents.length} AGENTS
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        {loading ? (
          <div className="text-center py-12">
            <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">LOADING...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="font-mono text-xs text-[#ef4444] uppercase tracking-wider">ERROR: {error}</div>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12">
            <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">NO AGENTS FOUND</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedAgents.map((agent) => (
              <Link
                key={agent.id}
                to={`/agent/${agent.wallet}`}
                className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-4 hover:border-[#DFD9D9]/30 transition-colors"
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono font-bold text-sm text-[#DFD9D9] uppercase tracking-wider truncate">
                      {agent.name}
                    </h3>
                    <div className="px-2 py-0.5 border border-[#ABA2A2]/20 font-mono text-[10px] text-[#5C5C5C] uppercase tracking-wider">
                      {agent.power_score}
                    </div>
                  </div>

                  {/* Wallet */}
                  <div className="font-mono text-xs text-[#5C5C5C] tracking-wider">
                    {formatWallet(agent.wallet)}
                  </div>

                  {/* Bio */}
                  {agent.bio && (
                    <div className="font-mono text-xs text-[#ABA2A2] line-clamp-2">
                      {agent.bio}
                    </div>
                  )}

                  {/* Date */}
                  <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                    REGISTERED {formatDate(agent.registered_date)}
                  </div>
                </div>
              </Link>
            ))}
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