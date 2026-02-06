import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://chum-production.up.railway.app';

interface WalletState {
  survival: number;
  trading: number;
  reserve: number;
}

interface WarChestData {
  current: number;
  target: number;
  progress: number;
  status: string;
  message: string;
  wallets: WalletState;
}

export default function WarChest() {
  const [data, setData] = useState<WarChestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/trading/warchest`);
        const json = await res.json();
        if (json.success) {
          setData({
            current: json.warchest.current,
            target: json.warchest.target,
            progress: json.warchest.progress,
            status: json.warchest.status,
            message: json.warchest.message,
            wallets: json.wallets,
          });
        }
      } catch (err) {
        console.error('[WarChest] Failed to fetch:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return null; // Don't show until loaded
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'from-yellow-500 to-amber-400';
    if (progress >= 75) return 'from-green-500 to-emerald-400';
    if (progress >= 50) return 'from-lime-500 to-green-400';
    if (progress >= 25) return 'from-yellow-500 to-lime-400';
    return 'from-orange-500 to-yellow-400';
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'ready': return '⚔️';
      case 'almost': return '🔥';
      case 'halfway': return '📈';
      default: return '💰';
    }
  };

  const formatSOL = (value: number) => {
    if (value < 0.0001) return '0';
    if (value < 0.01) return value.toFixed(4);
    if (value < 1) return value.toFixed(3);
    return value.toFixed(2);
  };

  return (
    <div
      className="w-full cursor-pointer select-none"
      onClick={() => setExpanded(!expanded)}
      style={{ marginBottom: 12 }}
    >
      {/* Main container */}
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(20,18,14,0.95) 0%, rgba(12,10,8,0.98) 100%)',
          border: '1px solid rgba(139,115,85,0.3)',
          borderRadius: 10,
          padding: '12px 14px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,235,200,0.04)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getStatusEmoji(data.status)}</span>
            <span
              className="font-bold tracking-wide"
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 10,
                color: 'rgba(212,195,165,0.9)',
                letterSpacing: 1,
              }}
            >
              WAR CHEST
            </span>
          </div>
          <div
            className="font-mono text-xs"
            style={{ color: 'rgba(180,165,140,0.8)' }}
          >
            {formatSOL(data.current)} / {data.target} SOL
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 8,
            borderRadius: 4,
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(139,115,85,0.2)',
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            className={`h-full bg-gradient-to-r ${getProgressColor(data.progress)}`}
            style={{
              width: `${Math.min(data.progress, 100)}%`,
              borderRadius: 3,
              boxShadow: data.progress > 0 ? '0 0 8px rgba(255,200,100,0.3)' : 'none',
              transition: 'width 1s ease-out',
            }}
          />
        </div>

        {/* Status message */}
        <div
          className="text-center italic"
          style={{
            fontSize: 11,
            color: 'rgba(180,165,140,0.7)',
          }}
        >
          "{data.message}"
        </div>

        {/* Expanded wallet details */}
        {expanded && (
          <div
            className="mt-3 pt-3"
            style={{
              borderTop: '1px solid rgba(139,115,85,0.2)',
            }}
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Survival */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 6,
                  padding: '8px 4px',
                  border: '1px solid rgba(74,222,128,0.2)',
                }}
              >
                <div className="text-green-400 text-xs font-bold mb-1">SURVIVAL</div>
                <div className="font-mono text-sm text-green-300">
                  {formatSOL(data.wallets.survival)} ◎
                </div>
                <div className="text-[9px] text-green-400/50 mt-1">public</div>
              </div>

              {/* Trading */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 6,
                  padding: '8px 4px',
                  border: '1px solid rgba(251,191,36,0.2)',
                }}
              >
                <div className="text-amber-400 text-xs font-bold mb-1">TRADING</div>
                <div className="font-mono text-sm text-amber-300">
                  {formatSOL(data.wallets.trading)} ◎
                </div>
                <div className="text-[9px] text-amber-400/50 mt-1">armed</div>
              </div>

              {/* Reserve */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 6,
                  padding: '8px 4px',
                  border: '1px solid rgba(147,197,253,0.2)',
                }}
              >
                <div className="text-blue-400 text-xs font-bold mb-1">RESERVE</div>
                <div className="font-mono text-sm text-blue-300">
                  {formatSOL(data.wallets.reserve)} ◎
                </div>
                <div className="text-[9px] text-blue-400/50 mt-1">backup</div>
              </div>
            </div>

            {/* Trading status */}
            <div
              className="mt-3 text-center"
              style={{
                fontSize: 10,
                color: 'rgba(180,165,140,0.6)',
              }}
            >
              Status: <span className="text-amber-400/80">DORMANT 💤</span>
              <span className="block mt-1 text-[9px]">(Activates at {data.target} SOL)</span>
            </div>
          </div>
        )}

        {/* Expand hint */}
        <div
          className="text-center mt-2"
          style={{
            fontSize: 9,
            color: 'rgba(180,165,140,0.4)',
          }}
        >
          {expanded ? '▲ tap to collapse' : '▼ tap for details'}
        </div>
      </div>
    </div>
  );
}
