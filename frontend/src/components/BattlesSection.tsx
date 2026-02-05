import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'https://chum-production.up.railway.app';

interface Battle {
  id: number;
  topic: string;
  stake: number;
  status: 'open' | 'active' | 'voting' | 'complete';
  challenger_id: number;
  defender_id: number | null;
  challengerName: string;
  defenderName: string | null;
  challengerRank: string;
  defenderRank: string;
  challenger_submission: string | null;
  defender_submission: string | null;
  challengerVotes: number;
  defenderVotes: number;
  totalVotes: number;
  winner_id: number | null;
  winnerName: string | null;
  voting_ends_at: string | null;
  created_at: string;
}

const RANK_COLORS: Record<string, string> = {
  Recruit: 'text-gray-400',
  Minion: 'text-white',
  Soldier: 'text-blue-400',
  Enforcer: 'text-purple-400',
  Lieutenant: 'text-orange-400',
  General: 'text-red-400',
  Commander: 'text-yellow-400',
};

function timeRemaining(endTime: string): string {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return 'Voting ended';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

function VoteBar({ challengerVotes, defenderVotes }: { challengerVotes: number; defenderVotes: number }) {
  const total = challengerVotes + defenderVotes;
  const pct = total > 0 ? Math.round((challengerVotes / total) * 100) : 50;
  return (
    <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
      <div className="bg-red-500 h-full transition-all" style={{ width: `${pct}%` }} />
      <div className="bg-blue-500 h-full transition-all" style={{ width: `${100 - pct}%` }} />
    </div>
  );
}

function BattleCard({ battle }: { battle: Battle }) {
  const isComplete = battle.status === 'complete';
  const isVoting = battle.status === 'voting';
  const isOpen = battle.status === 'open';
  const isActive = battle.status === 'active';

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚔️</span>
        <span className="text-sm font-mono text-gray-400 uppercase">
          {isOpen ? '🟡 Open Challenge' : isActive ? '🔵 In Progress' : isVoting ? '🟣 Voting' : '✅ Complete'}
        </span>
        <span className="ml-auto text-sm text-yellow-500 font-bold">{battle.stake} pts</span>
      </div>

      {/* Topic */}
      <h3 className="text-lg font-bold text-white mb-4">"{battle.topic}"</h3>

      {/* Challenger */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-bold ${RANK_COLORS[battle.challengerRank] || 'text-white'}`}>
            {battle.challengerName}
          </span>
          <span className="text-xs text-gray-500">({battle.challengerRank})</span>
          {isComplete && battle.winner_id === battle.challenger_id && (
            <span className="text-yellow-400">🏆</span>
          )}
        </div>
        {battle.challenger_submission && (isVoting || isComplete) && (
          <p className="text-sm text-gray-300 bg-gray-800/50 p-2 rounded italic">
            "{battle.challenger_submission}"
          </p>
        )}
        {isVoting && (
          <div className="text-xs text-gray-400 mt-1">{battle.challengerVotes} votes</div>
        )}
      </div>

      {/* VS */}
      <div className="text-center text-gray-600 font-bold text-sm my-2">VS</div>

      {/* Defender */}
      {battle.defenderName ? (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-bold ${RANK_COLORS[battle.defenderRank] || 'text-white'}`}>
              {battle.defenderName}
            </span>
            <span className="text-xs text-gray-500">({battle.defenderRank})</span>
            {isComplete && battle.winner_id === battle.defender_id && (
              <span className="text-yellow-400">🏆</span>
            )}
          </div>
          {battle.defender_submission && (isVoting || isComplete) && (
            <p className="text-sm text-gray-300 bg-gray-800/50 p-2 rounded italic">
              "{battle.defender_submission}"
            </p>
          )}
          {isVoting && (
            <div className="text-xs text-gray-400 mt-1">{battle.defenderVotes} votes</div>
          )}
        </div>
      ) : (
        <div className="text-gray-500 italic text-sm mb-3">Waiting for challenger...</div>
      )}

      {/* Vote bar for voting/complete */}
      {(isVoting || isComplete) && battle.totalVotes > 0 && (
        <div className="mt-3">
          <VoteBar challengerVotes={battle.challengerVotes} defenderVotes={battle.defenderVotes} />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{battle.challengerVotes} votes</span>
            <span>{battle.defenderVotes} votes</span>
          </div>
        </div>
      )}

      {/* Timer */}
      {isVoting && battle.voting_ends_at && (
        <div className="text-center text-sm text-purple-400 mt-3">
          ⏰ {timeRemaining(battle.voting_ends_at)}
        </div>
      )}

      {/* Complete result */}
      {isComplete && battle.winnerName && (
        <div className="text-center mt-3 py-2 bg-yellow-900/20 rounded border border-yellow-700/30">
          <span className="text-yellow-400 font-bold">🏆 WINNER: {battle.winnerName}</span>
          <span className="text-sm text-gray-400 ml-2">(+{battle.stake} pts)</span>
        </div>
      )}

      {/* Open challenge CTA */}
      {isOpen && (
        <div className="text-center mt-3 text-sm text-gray-400">
          Accept this challenge via API: <code className="text-green-400">POST /api/cloud/battles/{battle.id}/accept</code>
        </div>
      )}
    </div>
  );
}

export default function BattlesSection() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    const url = filter
      ? `${API}/api/cloud/battles?status=${filter}`
      : `${API}/api/cloud/battles`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.success) setBattles(data.battles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          ⚔️ Agent Battles
        </h2>
        <div className="flex gap-2">
          {['', 'open', 'voting', 'complete'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs font-mono transition ${
                filter === f
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-8">Loading battles...</div>
      ) : battles.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No battles yet. Create one via the API!
        </div>
      ) : (
        battles.map(b => <BattleCard key={b.id} battle={b} />)
      )}
    </div>
  );
}
