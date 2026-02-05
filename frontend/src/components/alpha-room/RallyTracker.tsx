import type { RallyInfo } from '../../lib/protocol';
import { truncateAddress } from '../../lib/protocol';

interface Props {
  rallies: RallyInfo[];
}

function formatPrice(lamports: number): string {
  if (lamports === 0) return '—';
  // Display as SOL (9 decimals) or just raw number
  if (lamports > 1_000_000_000) {
    return `${(lamports / 1_000_000_000).toFixed(2)} SOL`;
  }
  if (lamports > 1_000_000) {
    return `${(lamports / 1_000_000).toFixed(2)}M`;
  }
  return lamports.toLocaleString();
}

export default function RallyTracker({ rallies }: Props) {
  return (
    <div className="bg-[#111620] border border-[#2a3040] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2a3040] flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-200">Active Rallies</h3>
        <span className="text-xs text-gray-500">{rallies.length} active</span>
      </div>

      {rallies.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">
          No active rallies.
        </div>
      ) : (
        <div className="divide-y divide-[#1a1f2e]">
          {rallies.map((rally) => (
            <div key={rally.rallyId} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-gray-400">
                  Rally #{rally.rallyId}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  rally.action === 'BUY'
                    ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : 'bg-red-500/15 text-red-400 border border-red-500/20'
                }`}>
                  {rally.action}
                </span>
              </div>

              <div className="text-sm text-gray-300 font-mono mb-1">
                {truncateAddress(rally.tokenMint)}
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>Entry: <span className="text-gray-300">{formatPrice(rally.entryPrice)}</span></span>
                <span>Target: <span className="text-cyan-400">{formatPrice(rally.targetPrice)}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
