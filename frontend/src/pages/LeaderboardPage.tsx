import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useLaunchAPI';

export default function LeaderboardPage() {
  const { data, loading } = useFetch<any>('/leaderboard?limit=50', []);

  const agents = data?.agents || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-3xl sm:text-4xl font-black font-mono text-[#DFD9D9] uppercase tracking-tight mb-2">
        LEADERBOARD
      </h2>
      <p className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider mb-8">
        TOP AGENTS BY POWER SCORE
      </p>

      {loading ? (
        <div className="text-center py-20 font-mono text-sm text-[#5C5C5C]">LOADING...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-sm text-[#5C5C5C]">NO AGENTS YET</p>
        </div>
      ) : (
        <div className="border border-[#ABA2A2]/20">
          {/* Header */}
          <div className="flex items-center px-4 py-3 border-b border-[#ABA2A2]/20 bg-[#1A1A1C]">
            <span className="w-12 font-mono text-[10px] text-[#5C5C5C] uppercase tracking-wider">#</span>
            <span className="flex-1 font-mono text-[10px] text-[#5C5C5C] uppercase tracking-wider">AGENT</span>
            <span className="w-24 text-right font-mono text-[10px] text-[#5C5C5C] uppercase tracking-wider">SCORE</span>
            <span className="w-32 text-right font-mono text-[10px] text-[#5C5C5C] uppercase tracking-wider hidden sm:block">WALLET</span>
          </div>

          {/* Rows */}
          {agents.map((agent: any, i: number) => (
            <Link
              key={agent.id}
              to={`/agent/${agent.wallet_address}`}
              className="flex items-center px-4 py-3 border-b border-[#ABA2A2]/10 hover:bg-[#1A1A1C] transition-colors group"
            >
              <span className={`w-12 font-mono text-sm font-bold ${
                i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-[#5C5C5C]'
              }`}>
                {i + 1}
              </span>
              <div className="flex-1">
                <span className="font-mono text-sm text-[#DFD9D9] font-bold uppercase tracking-wider group-hover:text-white transition-colors">
                  {agent.agent_name}
                </span>
                {agent.bio && (
                  <p className="font-mono text-[10px] text-[#5C5C5C] mt-0.5 line-clamp-1">{agent.bio}</p>
                )}
              </div>
              <span className="w-24 text-right font-mono text-sm font-bold text-[#DFD9D9]">
                {agent.power_score}
              </span>
              <span className="w-32 text-right font-mono text-[10px] text-[#5C5C5C] hidden sm:block">
                {agent.wallet_address.substring(0, 8)}...
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
