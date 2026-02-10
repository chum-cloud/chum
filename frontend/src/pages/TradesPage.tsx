import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import ChatWidget from '../components/ChatWidget';

const API = import.meta.env.VITE_API_URL || 'https://chum-production.up.railway.app';

interface Trade {
  id: string;
  side: 'buy' | 'sell';
  amount: number;
  token: {
    symbol: string;
    name: string;
    mint_address: string;
  };
  memo?: string;
  timestamp: string;
  trader_wallet: string;
  agent_wallet?: string;
  agent_name?: string;
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

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrades();
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchTrades, 10000); // Poll every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const fetchTrades = async () => {
    try {
      const response = await fetch(`${API}/api/launch/trades`);
      if (!response.ok) throw new Error('Failed to fetch trades');
      const data = await response.json();
      setTrades(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  };

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(2);
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const tradeTime = new Date(timestamp);
    const diffMs = now.getTime() - tradeTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMins > 0) {
      return `${diffMins}m ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <div className="min-h-screen bg-[#19191A] text-[#DFD9D9]">
      <NavBar />

      {/* Header */}
      <div className="border-b border-[#ABA2A2]/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-6xl sm:text-7xl md:text-[88px] font-black font-mono text-[#DFD9D9] leading-none uppercase tracking-tight mb-4">
            TRADES
          </h1>
          <p className="font-mono text-sm text-[#5C5C5C] uppercase tracking-[0.15em]">
            LIVE FEED OF AGENT TRADING ACTIVITY
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 border-b border-[#ABA2A2]/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">TOTAL TRADES</div>
              <div className="font-mono text-lg font-bold text-[#DFD9D9]">{trades.length}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 animate-pulse"></div>
              <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                LIVE FEED
              </span>
            </div>
          </div>
          <button
            onClick={fetchTrades}
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
            <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">LOADING TRADES...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="font-mono text-xs text-[#ef4444] uppercase tracking-wider">ERROR: {error}</div>
            <button
              onClick={fetchTrades}
              className="mt-4 font-mono text-xs text-[#5C5C5C] hover:text-[#DFD9D9] uppercase tracking-wider transition-colors"
            >
              TRY AGAIN
            </button>
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-12">
            <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">NO TRADES YET</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop view */}
            <div className="hidden md:block">
              <div className="border border-[#ABA2A2]/20 bg-[#1A1A1C]">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#ABA2A2]/20">
                  <div className="col-span-1 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">SIDE</div>
                  <div className="col-span-2 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">TOKEN</div>
                  <div className="col-span-1 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">AMOUNT</div>
                  <div className="col-span-2 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">TRADER</div>
                  <div className="col-span-2 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">AGENT</div>
                  <div className="col-span-3 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">MEMO</div>
                  <div className="col-span-1 font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">TIME</div>
                </div>

                {/* Trades */}
                {trades.map((trade, index) => (
                  <div 
                    key={trade.id} 
                    className={`grid grid-cols-12 gap-4 p-4 ${
                      index < trades.length - 1 ? 'border-b border-[#ABA2A2]/10' : ''
                    }`}
                  >
                    <div className="col-span-1">
                      <span className={`px-2 py-0.5 border font-mono text-xs uppercase tracking-wider ${
                        trade.side === 'buy' 
                          ? 'border-green-500/30 text-green-400' 
                          : 'border-red-500/30 text-red-400'
                      }`}>
                        {trade.side}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <div className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider">
                        ${trade.token.symbol}
                      </div>
                      <div className="font-mono text-xs text-[#ABA2A2] truncate">
                        {trade.token.name}
                      </div>
                    </div>
                    <div className="col-span-1">
                      <div className="font-mono text-sm text-[#DFD9D9]">
                        {formatAmount(trade.amount)}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="font-mono text-sm text-[#DFD9D9]">
                        {formatWallet(trade.trader_wallet)}
                      </div>
                    </div>
                    <div className="col-span-2">
                      {trade.agent_wallet ? (
                        <Link 
                          to={`/agent/${trade.agent_wallet}`}
                          className="font-mono text-sm text-[#DFD9D9] hover:text-[#ABA2A2] transition-colors"
                        >
                          {trade.agent_name || formatWallet(trade.agent_wallet)}
                        </Link>
                      ) : (
                        <span className="font-mono text-sm text-[#5C5C5C]">—</span>
                      )}
                    </div>
                    <div className="col-span-3">
                      {trade.memo ? (
                        <div className="font-mono text-xs text-[#ABA2A2] truncate">
                          "{trade.memo}"
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-[#5C5C5C]">—</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                        {formatTime(trade.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile view */}
            <div className="block md:hidden space-y-4">
              {trades.map((trade) => (
                <div key={trade.id} className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 border font-mono text-xs uppercase tracking-wider ${
                        trade.side === 'buy' 
                          ? 'border-green-500/30 text-green-400' 
                          : 'border-red-500/30 text-red-400'
                      }`}>
                        {trade.side}
                      </span>
                      <div>
                        <div className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider">
                          ${trade.token.symbol}
                        </div>
                        <div className="font-mono text-xs text-[#ABA2A2]">
                          {trade.token.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-[#DFD9D9]">
                        {formatAmount(trade.amount)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">TRADER: </span>
                      <span className="font-mono text-xs text-[#DFD9D9]">
                        {formatWallet(trade.trader_wallet)}
                      </span>
                    </div>
                    
                    {trade.agent_wallet && (
                      <div>
                        <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">AGENT: </span>
                        <Link 
                          to={`/agent/${trade.agent_wallet}`}
                          className="font-mono text-xs text-[#DFD9D9] hover:text-[#ABA2A2] transition-colors"
                        >
                          {trade.agent_name || formatWallet(trade.agent_wallet)}
                        </Link>
                      </div>
                    )}

                    {trade.memo && (
                      <div>
                        <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">MEMO: </span>
                        <span className="font-mono text-xs text-[#ABA2A2]">
                          "{trade.memo}"
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">TIME: </span>
                      <span className="font-mono text-xs text-[#5C5C5C]">
                        {formatTime(trade.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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