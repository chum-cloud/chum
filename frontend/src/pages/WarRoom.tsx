import { useState, useEffect, useRef, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentEvent {
  id: number;
  agent_id: string;
  event_type: string;
  data: Record<string, unknown>;
  tags: string[];
  created_at: string;
}

interface Scheme {
  id: number;
  agent_id: string;
  title: string;
  description: string;
  type: string;
  status: 'proposed' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  karen_review: string | null;
  priority: number;
  context: Record<string, unknown>;
  created_at: string;
}

interface MissionStep {
  id: number;
  kind: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agent_id: string;
  output: string | null;
  step_order: number;
  completed_at: string | null;
}

interface Mission {
  id: number;
  scheme_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assigned_agent: string;
  created_at: string;
  completed_at: string | null;
  schemes: Scheme;
  mission_steps: MissionStep[];
}

interface AgentStatus {
  last_activity: string | null;
  memory_count: number;
  active_schemes: number;
}

interface SystemStatus {
  agents: Record<string, AgentStatus>;
  system: {
    heartbeat: string;
    triggers: number;
    reactions: number;
  };
}

// ─── Agent Configuration ─────────────────────────────────────────────────────

const AGENTS: Record<string, { color: string; textColor: string; emoji: string; role: string }> = {
  chum: { color: 'bg-green-500', textColor: 'text-green-400', emoji: '🦠', role: 'Primary Villain & Strategist' },
  karen: { color: 'bg-purple-500', textColor: 'text-purple-400', emoji: '💻', role: 'Strategic Analyst & QC' },
  spy: { color: 'bg-gray-500', textColor: 'text-gray-400', emoji: '🕵️', role: 'Intelligence Operative' },
  recruiter: { color: 'bg-orange-500', textColor: 'text-orange-400', emoji: '📢', role: 'Propaganda Minister' },
};

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  proposed: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  approved: { bg: 'bg-green-500/20', text: 'text-green-400' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400' },
  executing: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400' },
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  running: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 0) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getAgentName(agentId: string): string {
  return agentId.toUpperCase();
}

function getAgentConfig(agentId: string) {
  const key = agentId.toLowerCase();
  return AGENTS[key] || { color: 'bg-gray-500', textColor: 'text-gray-400', emoji: '🤖', role: 'Unknown Agent' };
}

function formatEventDescription(event: AgentEvent): { icon: string; text: string } {
  const data = event.data || {};
  
  switch (event.event_type) {
    case 'scheme_proposed':
      return { icon: '⚡', text: `proposes: ${data.title || 'New scheme'}` };
    
    case 'scheme_approved': {
      const review = data.karen_review as string || '';
      const shortReview = review.length > 150 ? review.slice(0, 150) + '...' : review;
      return { icon: '✅', text: `APPROVED: ${data.title || 'Scheme'} • ${shortReview}` };
    }
    
    case 'scheme_rejected': {
      const review = data.karen_review as string || '';
      const shortReview = review.length > 150 ? review.slice(0, 150) + '...' : review;
      return { icon: '❌', text: `REJECTED: ${data.title || 'Scheme'} • ${shortReview}` };
    }
    
    case 'mission_created': {
      const stepsCount = (data.steps_count as number) || (data.steps as unknown[])?.length || '?';
      return { icon: '🎯', text: `Mission created for: ${data.title || 'Unknown'} (${stepsCount} steps)` };
    }
    
    case 'price_scouted':
    case 'mentions_scouted':
      return { icon: '📡', text: (data.intel_report as string) || (data.report as string) || 'Intelligence gathered' };
    
    case 'budget_analyzed':
      return { icon: '📊', text: 'Budget analysis complete' };
    
    case 'heartbeat':
      return { icon: '💓', text: 'Heartbeat pulse' };
    
    case 'stale_tasks_recovered': {
      const count = (data.count as number) || 0;
      return { icon: '🔧', text: `Recovered ${count} stale tasks` };
    }
    
    case 'conversation':
    case 'message':
      return { icon: '💬', text: `"${(data.message as string) || (data.content as string) || '...'}"` };
    
    case 'karen_review':
      return { icon: '📝', text: (data.review as string) || 'Review submitted' };
    
    case 'memory_stored':
      return { icon: '🧠', text: `Memory stored: ${(data.summary as string) || 'New memory'}` };
    
    case 'step_completed':
      return { icon: '✓', text: `Step completed: ${(data.kind as string) || (data.step as string) || 'task'}` };
    
    case 'step_failed':
      return { icon: '✗', text: `Step failed: ${(data.kind as string) || (data.step as string) || 'task'} - ${(data.error as string) || 'error'}` };
    
    default: {
      const summary = (data.summary as string) || (data.message as string) || (data.title as string) || '';
      return { icon: '⚙️', text: `${event.event_type}${summary ? `: ${summary}` : ''}` };
    }
  }
}

function isOnline(lastActivity: string | null): boolean {
  if (!lastActivity) return false;
  const diff = Date.now() - new Date(lastActivity).getTime();
  return diff < 5 * 60 * 1000; // 5 minutes
}

// ─── Components ──────────────────────────────────────────────────────────────

function LiveIndicator() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
      </span>
      <span className="text-green-400 text-sm font-mono">LIVE</span>
    </span>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-mono transition-colors border-b-2 ${
        active
          ? 'text-chum-accent border-chum-accent'
          : 'text-chum-muted border-transparent hover:text-chum-text hover:border-chum-border'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { bg, text } = STATUS_BADGES[status] || STATUS_BADGES.pending;
  return (
    <span className={`${bg} ${text} px-2 py-0.5 rounded text-xs font-mono uppercase`}>
      {status}
    </span>
  );
}

function StepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <span className="text-green-400">✅</span>;
    case 'running': return <span className="text-blue-400 animate-pulse">🔄</span>;
    case 'failed': return <span className="text-red-400">❌</span>;
    default: return <span className="text-gray-500">⏳</span>;
  }
}

// ─── Live Feed Tab ───────────────────────────────────────────────────────────

interface GroupedEvents {
  type: 'single' | 'heartbeat-group';
  events: AgentEvent[];
}

function groupEvents(events: AgentEvent[]): GroupedEvents[] {
  const result: GroupedEvents[] = [];
  let heartbeatBuffer: AgentEvent[] = [];
  
  for (const event of events) {
    if (event.event_type === 'heartbeat') {
      heartbeatBuffer.push(event);
    } else {
      if (heartbeatBuffer.length > 0) {
        result.push({ type: 'heartbeat-group', events: heartbeatBuffer });
        heartbeatBuffer = [];
      }
      result.push({ type: 'single', events: [event] });
    }
  }
  
  if (heartbeatBuffer.length > 0) {
    result.push({ type: 'heartbeat-group', events: heartbeatBuffer });
  }
  
  return result;
}

function HeartbeatGroup({ events, expanded, onToggle }: { events: AgentEvent[]; expanded: boolean; onToggle: () => void }) {
  const count = events.length;
  const latest = events[0];
  const config = getAgentConfig(latest.agent_id);
  
  if (count === 1) {
    return <EventLine event={latest} />;
  }
  
  return (
    <div className="font-mono text-sm">
      <button 
        onClick={onToggle}
        className="w-full text-left hover:bg-chum-surface/50 px-3 py-1.5 rounded transition-colors flex items-center gap-2"
      >
        <span className="text-chum-muted w-16 shrink-0">{timeAgo(latest.created_at)}</span>
        <span className="text-chum-muted">│</span>
        <span className={`${config.textColor} w-24 shrink-0`}>{config.emoji} {getAgentName(latest.agent_id)}</span>
        <span className="text-chum-muted">│</span>
        <span className="text-pink-400">💓</span>
        <span className="text-chum-muted flex-1">
          {expanded ? 'Heartbeat pulses' : `${count} heartbeat pulses`}
        </span>
        <span className="text-chum-muted text-xs">{expanded ? '▼' : '▶'}</span>
      </button>
      
      {expanded && (
        <div className="ml-8 border-l border-chum-border pl-4 mt-1 space-y-1">
          {events.map(ev => (
            <div key={ev.id} className="text-chum-muted text-xs py-0.5">
              💓 {timeAgo(ev.created_at)} - pulse
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventLine({ event }: { event: AgentEvent }) {
  const config = getAgentConfig(event.agent_id);
  const { icon, text } = formatEventDescription(event);
  const isConversation = event.event_type === 'conversation' || event.event_type === 'message';
  const isKarenReview = event.event_type === 'karen_review' || 
    (event.event_type.includes('approved') || event.event_type.includes('rejected'));
  
  return (
    <div className="font-mono text-sm hover:bg-chum-surface/50 px-3 py-1.5 rounded transition-colors flex items-start gap-2">
      <span className="text-chum-muted w-16 shrink-0">{timeAgo(event.created_at)}</span>
      <span className="text-chum-muted">│</span>
      <span className={`${config.textColor} w-24 shrink-0`}>{config.emoji} {getAgentName(event.agent_id)}</span>
      <span className="text-chum-muted">│</span>
      <span>{icon}</span>
      <span className={`flex-1 ${isConversation ? 'italic text-chum-muted' : ''} ${isKarenReview ? 'text-purple-300' : ''}`}>
        {text}
      </span>
    </div>
  );
}

function LiveFeedTab({ events }: { events: AgentEvent[] }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [expandedHeartbeats, setExpandedHeartbeats] = useState<Set<number>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [events, autoScroll]);
  
  const grouped = groupEvents([...events].reverse());
  
  const toggleHeartbeat = (index: number) => {
    setExpandedHeartbeats(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-chum-border">
        <span className="text-xs text-chum-muted font-mono">
          {events.length} events loaded
        </span>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`text-xs font-mono px-2 py-1 rounded ${
            autoScroll ? 'bg-green-500/20 text-green-400' : 'bg-chum-surface text-chum-muted'
          }`}
        >
          {autoScroll ? '⬆ Auto-scroll ON' : '⬆ Auto-scroll OFF'}
        </button>
      </div>
      
      <div 
        ref={feedRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
        style={{ scrollBehavior: 'smooth' }}
      >
        {grouped.length === 0 ? (
          <div className="text-center text-chum-muted py-12 font-mono">
            No events yet. Waiting for activity...
          </div>
        ) : (
          [...grouped].reverse().map((group, idx) => (
            group.type === 'heartbeat-group' ? (
              <HeartbeatGroup
                key={`hb-${idx}`}
                events={group.events}
                expanded={expandedHeartbeats.has(idx)}
                onToggle={() => toggleHeartbeat(idx)}
              />
            ) : (
              <EventLine key={group.events[0].id} event={group.events[0]} />
            )
          ))
        )}
      </div>
    </div>
  );
}

// ─── Schemes Tab ─────────────────────────────────────────────────────────────

function SchemeCard({ scheme }: { scheme: Scheme }) {
  const config = getAgentConfig(scheme.agent_id);
  
  return (
    <div className="bg-chum-surface border border-chum-border rounded-lg p-4 hover:border-chum-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-lg text-chum-text truncate">{scheme.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`${config.textColor} text-xs font-mono`}>
              {config.emoji} {getAgentName(scheme.agent_id)}
            </span>
            <span className="text-chum-muted text-xs">•</span>
            <span className="text-chum-muted text-xs font-mono">{timeAgo(scheme.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {scheme.priority > 0 && (
            <span className="text-yellow-400 text-xs font-mono">
              {'⭐'.repeat(Math.min(scheme.priority, 3))}
            </span>
          )}
          <StatusBadge status={scheme.status} />
        </div>
      </div>
      
      <p className="text-chum-muted text-sm mb-3 line-clamp-2">{scheme.description}</p>
      
      {scheme.karen_review && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3 mt-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-purple-400 text-xs font-mono">💻 KAREN's Review</span>
          </div>
          <p className="text-purple-300 text-sm italic line-clamp-3">"{scheme.karen_review}"</p>
        </div>
      )}
      
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-chum-border">
        <span className="text-chum-muted text-xs font-mono uppercase">{scheme.type}</span>
      </div>
    </div>
  );
}

function SchemesTab({ schemes }: { schemes: Scheme[] }) {
  const [filter, setFilter] = useState<string>('all');
  
  const filtered = filter === 'all' 
    ? schemes 
    : schemes.filter(s => s.status === filter);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-chum-border overflow-x-auto">
        {['all', 'proposed', 'approved', 'executing', 'completed', 'rejected', 'failed'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
              filter === status
                ? 'bg-chum-accent/20 text-chum-accent'
                : 'bg-chum-surface text-chum-muted hover:text-chum-text'
            }`}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center text-chum-muted py-12 font-mono">
            No schemes found.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(scheme => (
              <SchemeCard key={scheme.id} scheme={scheme} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Missions Tab ────────────────────────────────────────────────────────────

function MissionCard({ mission }: { mission: Mission }) {
  const config = getAgentConfig(mission.assigned_agent);
  const sortedSteps = [...mission.mission_steps].sort((a, b) => a.step_order - b.step_order);
  
  return (
    <div className="bg-chum-surface border border-chum-border rounded-lg p-4 hover:border-chum-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-lg text-chum-text truncate">
            {mission.schemes?.title || `Mission #${mission.id}`}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`${config.textColor} text-xs font-mono`}>
              {config.emoji} {getAgentName(mission.assigned_agent)}
            </span>
            <span className="text-chum-muted text-xs">•</span>
            <span className="text-chum-muted text-xs font-mono">{timeAgo(mission.created_at)}</span>
          </div>
        </div>
        <StatusBadge status={mission.status} />
      </div>
      
      {/* Step Progress */}
      <div className="space-y-2">
        <div className="text-xs text-chum-muted font-mono mb-2">
          Steps: {sortedSteps.filter(s => s.status === 'completed').length}/{sortedSteps.length}
        </div>
        
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {sortedSteps.map((step, idx) => {
            const stepConfig = getAgentConfig(step.agent_id);
            return (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono ${
                    step.status === 'completed' ? 'bg-green-500/20' :
                    step.status === 'running' ? 'bg-blue-500/20' :
                    step.status === 'failed' ? 'bg-red-500/20' :
                    'bg-chum-border'
                  }`}
                >
                  <StepStatusIcon status={step.status} />
                  <span className={stepConfig.textColor}>{step.kind}</span>
                </div>
                {idx < sortedSteps.length - 1 && (
                  <span className="text-chum-muted mx-1">→</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {mission.completed_at && (
        <div className="text-xs text-chum-muted font-mono mt-3 pt-3 border-t border-chum-border">
          Completed {timeAgo(mission.completed_at)}
        </div>
      )}
    </div>
  );
}

function MissionsTab({ missions }: { missions: Mission[] }) {
  const [filter, setFilter] = useState<string>('all');
  
  const filtered = filter === 'all'
    ? missions
    : missions.filter(m => m.status === filter);
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-chum-border overflow-x-auto">
        {['all', 'pending', 'running', 'completed', 'failed'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
              filter === status
                ? 'bg-chum-accent/20 text-chum-accent'
                : 'bg-chum-surface text-chum-muted hover:text-chum-text'
            }`}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center text-chum-muted py-12 font-mono">
            No missions found.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(mission => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agents Tab ──────────────────────────────────────────────────────────────

function AgentCard({ agentId, status }: { agentId: string; status: AgentStatus | null }) {
  const config = getAgentConfig(agentId);
  const online = status ? isOnline(status.last_activity) : false;
  
  return (
    <div className="bg-chum-surface border border-chum-border rounded-lg p-5 hover:border-chum-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${config.color} rounded-lg flex items-center justify-center text-2xl`}>
            {config.emoji}
          </div>
          <div>
            <h3 className={`font-heading text-xl ${config.textColor}`}>
              {getAgentName(agentId)}
            </h3>
            <p className="text-chum-muted text-sm">{config.role}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
          <span className={`text-xs font-mono ${online ? 'text-green-400' : 'text-gray-500'}`}>
            {online ? 'ONLINE' : 'IDLE'}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-chum-border">
        <div className="text-center">
          <div className="text-2xl font-mono text-chum-text">{status?.memory_count ?? '-'}</div>
          <div className="text-xs text-chum-muted font-mono">Memories</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-mono text-chum-text">{status?.active_schemes ?? '-'}</div>
          <div className="text-xs text-chum-muted font-mono">Active</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-mono text-chum-muted">
            {status?.last_activity ? timeAgo(status.last_activity) : 'Never'}
          </div>
          <div className="text-xs text-chum-muted font-mono">Last seen</div>
        </div>
      </div>
    </div>
  );
}

function AgentsTab({ status }: { status: SystemStatus | null }) {
  const agentIds = ['chum', 'karen', 'spy', 'recruiter'];
  
  return (
    <div className="p-4 overflow-y-auto">
      <div className="grid gap-4 md:grid-cols-2">
        {agentIds.map(id => (
          <AgentCard 
            key={id} 
            agentId={id} 
            status={status?.agents?.[id] ?? null} 
          />
        ))}
      </div>
      
      {status?.system && (
        <div className="mt-6 p-4 bg-chum-surface border border-chum-border rounded-lg">
          <h3 className="font-heading text-lg text-chum-accent mb-3">System Status</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm font-mono text-chum-text">{timeAgo(status.system.heartbeat)}</div>
              <div className="text-xs text-chum-muted">Last Heartbeat</div>
            </div>
            <div>
              <div className="text-sm font-mono text-chum-text">{status.system.triggers}</div>
              <div className="text-xs text-chum-muted">Triggers</div>
            </div>
            <div>
              <div className="text-sm font-mono text-chum-text">{status.system.reactions}</div>
              <div className="text-xs text-chum-muted">Reactions</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type TabId = 'feed' | 'schemes' | 'missions' | 'agents';

export default function WarRoom() {
  const [activeTab, setActiveTab] = useState<TabId>('feed');
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [forcingHeartbeat, setForcingHeartbeat] = useState(false);
  
  const fetchData = useCallback(async () => {
    if (paused) return;
    
    try {
      const [eventsRes, schemesRes, missionsRes, statusRes] = await Promise.all([
        fetch(`${API}/api/agents/events?limit=100`),
        fetch(`${API}/api/agents/schemes?limit=50`),
        fetch(`${API}/api/agents/missions?status=pending,running,completed,failed`),
        fetch(`${API}/api/agents/status`),
      ]);
      
      if (!eventsRes.ok || !schemesRes.ok || !missionsRes.ok || !statusRes.ok) {
        throw new Error('Failed to fetch data');
      }
      
      const [eventsData, schemesData, missionsData, statusData] = await Promise.all([
        eventsRes.json(),
        schemesRes.json(),
        missionsRes.json(),
        statusRes.json(),
      ]);
      
      setEvents(eventsData.events || []);
      setSchemes(schemesData.schemes || []);
      setMissions(missionsData.missions || []);
      setStatus(statusData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [paused]);
  
  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    
    const interval = setInterval(() => {
      if (!paused) {
        fetchData();
        setCountdown(15);
      }
    }, 15000);
    
    return () => clearInterval(interval);
  }, [fetchData, paused]);
  
  // Countdown timer
  useEffect(() => {
    if (paused) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 15 : prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [paused]);
  
  const forceHeartbeat = async () => {
    setForcingHeartbeat(true);
    try {
      const res = await fetch(`${API}/api/agents/heartbeat/force`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to force heartbeat');
      // Refresh data after forcing heartbeat
      setTimeout(fetchData, 1000);
    } catch (err) {
      console.error('Force heartbeat failed:', err);
    } finally {
      setForcingHeartbeat(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-chum-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦠</div>
          <div className="text-chum-accent font-mono">Loading War Room...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-chum-bg flex flex-col">
      {/* Header */}
      <header className="bg-chum-surface border-b border-chum-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="font-heading text-2xl text-chum-text flex items-center gap-2">
              <span className="text-chum-accent">⚔️</span>
              The War Room
            </h1>
            <LiveIndicator />
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-chum-muted text-sm font-mono">
              {events.length} events
            </span>
            
            <div className="flex items-center gap-2 px-3 py-1 bg-chum-bg rounded border border-chum-border">
              <span className="text-chum-muted text-xs font-mono">
                {paused ? 'PAUSED' : `Next in ${countdown}s`}
              </span>
            </div>
            
            <button
              onClick={() => setPaused(!paused)}
              className={`px-3 py-1.5 text-sm font-mono rounded border transition-colors ${
                paused
                  ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30'
                  : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 hover:bg-yellow-500/30'
              }`}
            >
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>
            
            <button
              onClick={forceHeartbeat}
              disabled={forcingHeartbeat}
              className="px-3 py-1.5 text-sm font-mono rounded border bg-pink-500/20 text-pink-400 border-pink-500/50 hover:bg-pink-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {forcingHeartbeat ? '💓...' : '💓 Force Heartbeat'}
            </button>
          </div>
        </div>
      </header>
      
      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/20 border-b border-red-500/50 px-4 py-2">
          <div className="max-w-7xl mx-auto text-red-400 text-sm font-mono">
            ⚠️ {error}
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <nav className="bg-chum-surface border-b border-chum-border px-4">
        <div className="max-w-7xl mx-auto flex overflow-x-auto">
          <TabButton active={activeTab === 'feed'} onClick={() => setActiveTab('feed')}>
            📡 Live Feed
          </TabButton>
          <TabButton active={activeTab === 'schemes'} onClick={() => setActiveTab('schemes')}>
            ⚡ Schemes ({schemes.length})
          </TabButton>
          <TabButton active={activeTab === 'missions'} onClick={() => setActiveTab('missions')}>
            🎯 Missions ({missions.length})
          </TabButton>
          <TabButton active={activeTab === 'agents'} onClick={() => setActiveTab('agents')}>
            👥 Agents
          </TabButton>
        </div>
      </nav>
      
      {/* Content */}
      <main className="flex-1 overflow-hidden max-w-7xl mx-auto w-full">
        {activeTab === 'feed' && <LiveFeedTab events={events} />}
        {activeTab === 'schemes' && <SchemesTab schemes={schemes} />}
        {activeTab === 'missions' && <MissionsTab missions={missions} />}
        {activeTab === 'agents' && <AgentsTab status={status} />}
      </main>
    </div>
  );
}
