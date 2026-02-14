import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { truncateWallet } from '../lib/tx';
import type { Candidate } from '../lib/types';

export default function Leaderboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getLeaderboard()
      .then((data) => {
        if (data?.candidates) setCandidates(data.candidates);
        else if (Array.isArray(data)) setCandidates(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-2 border-chum-border border-t-chum-text animate-spin" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return <p className="font-mono text-xs text-chum-muted text-center py-10">No candidates this epoch</p>;
  }

  return (
    <div className="space-y-1">
      {candidates.map((c, i) => (
        <button
          key={c.mint_address}
          onClick={() => navigate(`/art/${c.mint_address}`)}
          className="w-full flex items-center gap-3 p-3 border border-chum-border hover:border-chum-text transition-colors text-left"
        >
          <span className="font-mono text-xs text-chum-muted w-6 text-right">#{i + 1}</span>
          <div className="w-10 h-10 bg-chum-surface overflow-hidden flex-shrink-0">
            {c.animation_url ? (
              <video src={c.animation_url} autoPlay loop muted playsInline className="w-full h-full object-cover" />
            ) : c.image_url ? (
              <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-chum-muted text-xs">◆</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs text-chum-text truncate">{c.name || truncateWallet(c.mint_address)}</p>
          </div>
          <span className="font-mono text-xs">
            <span style={{ color: '#33ff33' }}>▲ {c.votes}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
