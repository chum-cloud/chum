import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
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

interface ScoreBreakdown {
  total_score: number;
  components: {
    trading_volume?: number;
    token_launches?: number;
    social_influence?: number;
    network_effects?: number;
  };
}

interface Token {
  id: string;
  symbol: string;
  name: string;
  mint_address: string;
  created_at: string;
  market_cap?: number;
  price?: number;
}

interface Trade {
  id: string;
  side: 'buy' | 'sell';
  amount: number;
  token: {
    symbol: string;
    name: string;
  };
  memo?: string;
  timestamp: string;
  trader_wallet: string;
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

export default function AgentPage() {
  const { wallet } = useParams<{ wallet: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wallet) {
      fetchAgentData();
    }
  }, [wallet]);

  const fetchAgentData = async () => {
    try {
      setLoading(true);
      
      // Fetch agent details
      const agentResponse = await fetch(`${API}/api/launch/agents/${wallet}`);
      if (!agentResponse.ok) throw new Error('Agent not found');
      const agentData = await agentResponse.json();
      setAgent(agentData);

      // Fetch score breakdown
      const scoreResponse = await fetch(`${API}/api/launch/score/${wallet}`);
      if (scoreResponse.ok) {
        const scoreData = await scoreResponse.json();
        setScore(scoreData);
      }

      // Fetch launched tokens
      const tokensResponse = await fetch(`${API}/api/launch/tokens/by/${wallet}`);
      if (tokensResponse.ok) {
        const tokensData = await tokensResponse.json();
        setTokens(tokensData);
      }

      // Fetch recent trades
      const tradesResponse = await fetch(`${API}/api/launch/trades/agent/${wallet}`);
      if (tradesResponse.ok) {
        const tradesData = await tradesResponse.json();
        setTrades(tradesData.slice(0, 10)); // Show latest 10 trades
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent data');
    } finally {
      setLoading(false);
    }
  };

  const formatWallet = (wallet: string) => {
    return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#19191A] text-[#DFD9D9]">
        <NavBar />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">LOADING...</div>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-[#19191A] text-[#DFD9D9]">
        <NavBar />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <div className="font-mono text-xs text-[#ef4444] uppercase tracking-wider">
              {error || 'AGENT NOT FOUND'}
            </div>
            <Link to="/explore" className="font-mono text-xs text-[#5C5C5C] hover:text-[#DFD9D9] uppercase tracking-wider transition-colors">
              ← BACK TO EXPLORE
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#19191A] text-[#DFD9D9]">
      <NavBar />

      {/* Header */}
      <div className="border-b border-[#ABA2A2]/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black font-mono text-[#DFD9D9] leading-none uppercase tracking-tight mb-2">
                {agent.name}
              </h1>
              <div className="font-mono text-sm text-[#5C5C5C] tracking-wider mb-2">
                {formatWallet(agent.wallet)}
              </div>
              {agent.bio && (
                <div className="font-mono text-sm text-[#ABA2A2] max-w-2xl">
                  {agent.bio}
                </div>
              )}
            </div>
            <div className="px-4 py-2 border border-[#ABA2A2]/20 bg-[#1A1A1C]">
              <div className="text-center">
                <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider mb-1">POWER SCORE</div>
                <div className="font-mono text-2xl font-bold text-[#DFD9D9]">
                  {agent.power_score}
                </div>
              </div>
            </div>
          </div>
          <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
            REGISTERED {formatDate(agent.registered_date)}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Score Breakdown */}
          <div className="space-y-6">
            <div>
              <h2 className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider mb-4">
                SCORE BREAKDOWN
              </h2>
              {score ? (
                <div className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">TOTAL</span>
                    <span className="font-mono text-sm font-bold text-[#DFD9D9]">{score.total_score}</span>
                  </div>
                  {Object.entries(score.components).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-xs text-[#ABA2A2]">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-4 text-center">
                  <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                    NO SCORE DATA AVAILABLE
                  </span>
                </div>
              )}
            </div>

            {/* Launched Tokens */}
            <div>
              <h2 className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider mb-4">
                LAUNCHED TOKENS ({tokens.length})
              </h2>
              {tokens.length > 0 ? (
                <div className="space-y-3">
                  {tokens.map((token) => (
                    <div key={token.id} className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider">
                            ${token.symbol}
                          </div>
                          <div className="font-mono text-xs text-[#ABA2A2]">
                            {token.name}
                          </div>
                        </div>
                        {token.price && (
                          <div className="text-right">
                            <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">PRICE</div>
                            <div className="font-mono text-sm text-[#DFD9D9]">
                              ${token.price.toFixed(6)}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="font-mono text-xs text-[#5C5C5C] tracking-wider">
                        {formatWallet(token.mint_address)}
                      </div>
                      <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider mt-1">
                        CREATED {formatDate(token.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-4 text-center">
                  <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                    NO TOKENS LAUNCHED
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Recent Trades */}
          <div>
            <h2 className="font-mono text-sm font-bold text-[#DFD9D9] uppercase tracking-wider mb-4">
              RECENT TRADES ({trades.length})
            </h2>
            {trades.length > 0 ? (
              <div className="space-y-3">
                {trades.map((trade) => (
                  <div key={trade.id} className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-4">
                    <div className="flex items-center justify-between mb-2">
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
                    {trade.memo && (
                      <div className="font-mono text-xs text-[#ABA2A2] mb-2">
                        "{trade.memo}"
                      </div>
                    )}
                    <div className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                      {formatDate(trade.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-[#ABA2A2]/20 bg-[#1A1A1C] p-4 text-center">
                <span className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider">
                  NO TRADES YET
                </span>
              </div>
            )}
          </div>
        </div>
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