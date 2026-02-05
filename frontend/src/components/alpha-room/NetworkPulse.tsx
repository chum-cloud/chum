import type { RoomStats } from '../../lib/protocol';

interface Props {
  stats: RoomStats | null;
  isLive: boolean;
}

export default function NetworkPulse({ stats, isLive }: Props) {
  const wins = stats?.agentList.length ?? 0; // placeholder — real win rate would come from RESULT messages
  const totalMessages = stats?.totalMessages ?? 0;
  const activeAgents = stats?.uniqueAgents ?? 0;
  const activeRallies = stats?.activeRallies.length ?? 0;

  const items = [
    { label: 'Messages', value: totalMessages, color: 'text-cyan-400' },
    { label: 'Active Agents', value: activeAgents, color: 'text-green-400' },
    { label: 'Active Rallies', value: activeRallies, color: 'text-red-400' },
    { label: 'Agents Seen', value: wins, color: 'text-purple-400' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-6 bg-[#111620] border border-[#2a3040] rounded-xl px-4 py-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</span>
          <span className="text-xs text-gray-500 uppercase tracking-wider">{item.label}</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400' : 'bg-yellow-400'} animate-[pulse-glow_2s_ease-in-out_infinite]`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${isLive ? 'text-green-400' : 'text-yellow-400'}`}>
          {isLive ? 'LIVE' : 'DEMO'}
        </span>
      </div>
    </div>
  );
}
