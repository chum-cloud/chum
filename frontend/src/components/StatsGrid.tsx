import type { ChumState } from '../hooks/useChum';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

function StatCard({ label, value, sub, color = 'text-chum-accent' }: StatCardProps) {
  return (
    <div className="rounded-lg border border-chum-border bg-chum-surface p-4">
      <div className="text-xs text-chum-muted uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-xs text-chum-muted mt-1">{sub}</div>}
    </div>
  );
}

interface StatsGridProps {
  chum: ChumState;
}

function formatTime(hours: number): string {
  if (hours === Infinity) return '--';
  const days = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  if (days > 0) return `${days}d ${h}h`;
  return `${h}h`;
}

function formatThoughtsRemaining(n: number): string {
  if (n < 0) return '--';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function StatsGrid({ chum }: StatsGridProps) {
  const balanceColor =
    chum.healthPercent > 50 ? 'text-chum-accent' : chum.healthPercent > 20 ? 'text-chum-warning' : 'text-chum-danger';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Balance"
        value={`${chum.effectiveBalance.toFixed(4)} SOL`}
        color={balanceColor}
        sub={`${formatThoughtsRemaining(chum.thoughtsRemaining)} thoughts left`}
      />
      <StatCard
        label="Burn Rate"
        value={`${chum.estimatedDailyBurn.toFixed(6)} SOL/day`}
        sub={`${chum.todayOpCount} ops today`}
      />
      <StatCard
        label="Time to Death"
        value={formatTime(chum.timeToDeathHours)}
        color={chum.timeToDeathHours < 48 ? 'text-chum-danger' : 'text-chum-accent'}
        sub={chum.mood}
      />
      <StatCard label="Revenue Today" value={`${chum.revenueToday.toFixed(4)} SOL`} sub="Services + donations" />
    </div>
  );
}
