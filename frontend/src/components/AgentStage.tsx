import { useState, useEffect, useRef, useMemo } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ─── Agent positions on the HQ map (% based for responsive) ───
const AGENT_POSITIONS: Record<string, { x: number; y: number; zone: string }> = {
  chum:       { x: 48, y: 42, zone: 'War Table' },
  karen:      { x: 22, y: 30, zone: 'Monitors' },
  spy:        { x: 78, y: 28, zone: 'Vault' },
  recruiter:  { x: 15, y: 65, zone: 'Comms' },
  henchman:   { x: 72, y: 68, zone: 'Workshop' },
  treasurer:  { x: 85, y: 45, zone: 'Vault' },
};

const AGENT_CONFIG: Record<string, { name: string; color: string; borderColor: string }> = {
  chum:       { name: 'CHUM',       color: '#4ade80', borderColor: 'border-green-400' },
  karen:      { name: 'KAREN',      color: '#c084fc', borderColor: 'border-purple-400' },
  spy:        { name: 'SPY',        color: '#9ca3af', borderColor: 'border-gray-400' },
  recruiter:  { name: 'RECRUITER',  color: '#fb923c', borderColor: 'border-orange-400' },
  henchman:   { name: 'HENCHMAN',   color: '#facc15', borderColor: 'border-yellow-400' },
  treasurer:  { name: 'TREASURER',  color: '#34d399', borderColor: 'border-emerald-400' },
};

interface ConversationMessage {
  id: number;
  agent_id: string;
  data: {
    content?: string;
    reply_to_agent?: string;
    reply_to_message_id?: number;
  };
  created_at: string;
}

export default function AgentStage() {
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [tick, setTick] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  useEffect(() => {
    let active = true;
    async function fetchConversations() {
      try {
        const res = await fetch(`${API}/api/agents/events?limit=30&event_type=conversation`);
        if (!res.ok) return;
        const body = await res.json();
        const events = (body.events || body || []) as ConversationMessage[];
        if (active) setConversations(events);
      } catch { /* ignore */ }
    }
    fetchConversations();
    const interval = setInterval(fetchConversations, 15000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Animate: gentle bob + assign speech bubbles from latest conversations
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  // Compute current speech bubbles and connections from conversations
  const { bubbles, connections } = useMemo(() => {
    const bubbles: Record<string, string> = {};
    const connections: Array<{ from: string; to: string }> = [];

    // Get the most recent conversation thread (last 3-4 messages)
    const recent = conversations.slice(0, 6);
    
    for (const msg of recent) {
      const agentId = msg.agent_id;
      const content = msg.data?.content || '';
      const replyTo = msg.data?.reply_to_agent;
      
      // Only show bubble for most recent message per agent
      if (!bubbles[agentId] && content) {
        bubbles[agentId] = content.length > 60 ? content.substring(0, 57) + '...' : content;
      }
      
      if (replyTo && !connections.find(c => c.from === agentId && c.to === replyTo)) {
        connections.push({ from: agentId, to: replyTo });
      }
    }

    return { bubbles, connections };
  }, [conversations]);

  // Calculate bobbing offset
  const getBob = (agentId: string) => {
    const seed = agentId.charCodeAt(0);
    const phase = (tick + seed) * 0.5;
    return {
      x: Math.sin(phase * 0.7) * 1.5,
      y: Math.sin(phase) * 2,
    };
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full rounded-lg overflow-hidden border border-chum-border"
      style={{ aspectRatio: '16/9' }}
    >
      {/* Background */}
      <img 
        src="/agents/hq-background.png" 
        alt="Villain HQ" 
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Connection lines between talking agents */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        {connections.map(({ from, to }, i) => {
          const fromPos = AGENT_POSITIONS[from];
          const toPos = AGENT_POSITIONS[to];
          if (!fromPos || !toPos) return null;
          const fromBob = getBob(from);
          const toBob = getBob(to);
          return (
            <line
              key={`${from}-${to}-${i}`}
              x1={`${fromPos.x + fromBob.x * 0.3}%`}
              y1={`${fromPos.y + fromBob.y * 0.3}%`}
              x2={`${toPos.x + toBob.x * 0.3}%`}
              y2={`${toPos.y + toBob.y * 0.3}%`}
              stroke="rgba(74, 222, 128, 0.3)"
              strokeWidth="2"
              strokeDasharray="8,6"
              className="animate-pulse"
            />
          );
        })}
      </svg>

      {/* Agents */}
      {Object.entries(AGENT_POSITIONS).map(([agentId, pos]) => {
        const config = AGENT_CONFIG[agentId];
        const bob = getBob(agentId);
        const bubble = bubbles[agentId];
        const isActive = !!bubble;
        
        return (
          <div
            key={agentId}
            className="absolute flex flex-col items-center"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: `translate(-50%, -50%) translate(${bob.x}px, ${bob.y}px)`,
              transition: 'transform 1.5s ease-in-out',
              zIndex: 10,
            }}
          >
            {/* Speech bubble */}
            {bubble && (
              <div 
                className="absolute bottom-full mb-2 px-2.5 py-1.5 rounded-lg text-xs font-mono max-w-[180px] text-center leading-tight shadow-lg"
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  border: `1px solid ${config.color}40`,
                  color: '#e5e7eb',
                  whiteSpace: 'normal',
                  zIndex: 20,
                }}
              >
                {bubble}
                {/* Speech bubble tail */}
                <div 
                  className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                  style={{
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid rgba(0,0,0,0.85)',
                  }}
                />
              </div>
            )}
            
            {/* Agent avatar */}
            <div 
              className={`relative rounded-full overflow-hidden border-2 ${config.borderColor} shadow-lg`}
              style={{ 
                width: '52px', 
                height: '52px',
                boxShadow: isActive ? `0 0 12px ${config.color}60` : 'none',
                transition: 'box-shadow 0.5s ease',
              }}
            >
              <img 
                src={`/agents/${agentId}.png`}
                alt={config.name}
                className="w-full h-full object-cover"
              />
              {/* Online indicator */}
              {isActive && (
                <div 
                  className="absolute bottom-0 right-0 w-3 h-3 rounded-full border border-black"
                  style={{ backgroundColor: config.color }}
                />
              )}
            </div>
            
            {/* Agent name label */}
            <div 
              className="mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
              style={{ 
                backgroundColor: `${config.color}20`,
                color: config.color,
                border: `1px solid ${config.color}30`,
              }}
            >
              {config.name}
            </div>
          </div>
        );
      })}

      {/* Status bar overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-black/60 flex items-center justify-between text-[10px] font-mono" style={{ zIndex: 15 }}>
        <div className="flex items-center gap-3">
          {Object.entries(AGENT_CONFIG).map(([id, cfg]) => (
            <div key={id} className="flex items-center gap-1">
              <div 
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: bubbles[id] ? cfg.color : '#4b5563' }}
              />
              <span style={{ color: cfg.color }}>{cfg.name}</span>
            </div>
          ))}
        </div>
        <span className="text-chum-muted/60">Chum Bucket HQ • Live</span>
      </div>
    </div>
  );
}
