import type { ChumState } from '../hooks/useChum';

function formatTime(hours: number): string {
  if (hours === Infinity) return '--';
  const days = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  if (days > 0) return `${days}d ${h}h`;
  return `${h}h`;
}

interface HudPanelProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

function HudPanel({ label, value, sub, color = 'text-chum-accent', position }: HudPanelProps) {
  const positionClasses: Record<string, string> = {
    'top-left': 'top-16 left-4 sm:left-6',
    'top-right': 'top-16 right-4 sm:right-6',
    'bottom-left': 'bottom-28 left-4 sm:left-6',
    'bottom-right': 'bottom-28 right-4 sm:right-6',
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} hud-panel z-20`}
    >
      <div className="text-[10px] uppercase tracking-wider text-chum-muted mb-0.5">{label}</div>
      <div className={`text-lg sm:text-xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-chum-muted mt-0.5">{sub}</div>}
    </div>
  );
}

interface HudOverlayProps {
  chum: ChumState;
}

export default function HudOverlay({ chum }: HudOverlayProps) {
  const balanceColor =
    chum.healthPercent > 50 ? 'text-chum-accent' : chum.healthPercent > 20 ? 'text-chum-warning' : 'text-chum-danger';

  const deathColor = chum.timeToDeathHours < 48 ? 'text-chum-danger' : 'text-chum-accent';

  return (
    <>
      <HudPanel
        label="Balance"
        value={`${chum.balance.toFixed(4)} SOL`}
        sub={`${chum.healthPercent.toFixed(0)}% health`}
        color={balanceColor}
        position="top-left"
      />
      <HudPanel
        label="Time to Death"
        value={formatTime(chum.timeToDeathHours)}
        sub={chum.mood}
        color={deathColor}
        position="top-right"
      />
      <HudPanel
        label="Burn Rate"
        value={`${chum.burnRate} SOL/day`}
        sub="Server + AI costs"
        position="bottom-left"
      />
      <HudPanel
        label="Revenue"
        value={`${chum.revenueToday.toFixed(4)} SOL`}
        sub="Services + donations"
        position="bottom-right"
      />
    </>
  );
}
