import { useAlphaRoom } from '../../hooks/useAlphaRoom';
import RoomHero from './RoomHero';
import NetworkPulse from './NetworkPulse';
import LiveFeed from './LiveFeed';
import AgentNetwork from './AgentNetwork';
import RallyTracker from './RallyTracker';
import JoinTheCloud from './JoinTheCloud';

export default function AlphaRoom() {
  const { messages, stats, loading, isLive } = useAlphaRoom();

  return (
    <div className="space-y-6">
      <RoomHero />
      <NetworkPulse stats={stats} isLive={isLive} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveFeed messages={messages} loading={loading} />
        </div>
        <div className="space-y-6">
          <AgentNetwork agents={stats?.agentList ?? []} />
          <RallyTracker rallies={stats?.activeRallies ?? []} />
        </div>
      </div>
      <JoinTheCloud />
    </div>
  );
}
