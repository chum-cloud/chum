import { useState, useEffect, useRef, useMemo } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ─── Home positions for each agent (% based, matching rooms on the top-down HQ map) ───
const AGENT_HOMES: Record<string, { x: number; y: number; zone: string }> = {
  chum:       { x: 28, y: 18, zone: 'Command Center' },    // Top-left, big table
  karen:      { x: 15, y: 50, zone: 'Surveillance' },      // Mid-left, screens
  spy:        { x: 72, y: 18, zone: 'Vault' },             // Top-right
  recruiter:  { x: 18, y: 82, zone: 'Comms' },             // Bottom-left
  henchman:   { x: 82, y: 82, zone: 'Workshop' },          // Bottom-right
  treasurer:  { x: 82, y: 18, zone: 'Treasury' },          // Top-right near vault
};

// Meeting point — center of the main hall
const MEETING_POINT = { x: 50, y: 58 };

const AGENT_CONFIG: Record<string, { name: string; color: string; borderColor: string }> = {
  chum:       { name: 'CHUM',       color: '#4ade80', borderColor: '#4ade80' },
  karen:      { name: 'KAREN',      color: '#c084fc', borderColor: '#c084fc' },
  spy:        { name: 'SPY',        color: '#9ca3af', borderColor: '#9ca3af' },
  recruiter:  { name: 'RECRUITER',  color: '#fb923c', borderColor: '#fb923c' },
  henchman:   { name: 'HENCHMAN',   color: '#facc15', borderColor: '#facc15' },
  treasurer:  { name: 'TREASURER',  color: '#34d399', borderColor: '#34d399' },
};

interface ConversationMessage {
  id: number;
  agent_id: string;
  data: {
    content?: string;
    reply_to_agent?: string;
    reply_to_message_id?: number;
    conversation_starter?: boolean;
  };
  created_at: string;
}

// Determine which agents are in an active conversation (within last 5 min)
function getActiveConversation(messages: ConversationMessage[]): {
  participants: Set<string>;
  bubbles: Record<string, string>;
  threads: Array<{ from: string; to: string }>;
} {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const recent = messages.filter(m => new Date(m.created_at).getTime() > fiveMinAgo);
  
  const participants = new Set<string>();
  const bubbles: Record<string, string> = {};
  const threads: Array<{ from: string; to: string }> = [];
  
  for (const msg of recent) {
    const agentId = msg.agent_id;
    const content = msg.data?.content || '';
    const replyTo = msg.data?.reply_to_agent;
    
    participants.add(agentId);
    if (replyTo) participants.add(replyTo);
    
    if (!bubbles[agentId] && content) {
      bubbles[agentId] = content.length > 50 ? content.substring(0, 47) + '...' : content;
    }
    
    if (replyTo && !threads.find(t => t.from === agentId && t.to === replyTo)) {
      threads.push({ from: agentId, to: replyTo });
    }
  }
  
  return { participants, bubbles, threads };
}

// Calculate meeting positions for participants (clustered around meeting point)
function getMeetingPositions(participants: string[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const count = participants.length;
  const radius = 8; // spread radius in %
  
  participants.forEach((agent, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    positions[agent] = {
      x: MEETING_POINT.x + Math.cos(angle) * radius,
      y: MEETING_POINT.y + Math.sin(angle) * radius * 0.6, // squish vertically for perspective
    };
  });
  
  return positions;
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
        const res = await fetch(`${API}/api/agents/events?limit=20&tags=conversation`);
        if (!res.ok) return;
        const body = await res.json();
        if (active) setConversations((body.events || body || []) as ConversationMessage[]);
      } catch { /* ignore */ }
    }
    fetchConversations();
    const interval = setInterval(fetchConversations, 15000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Tick for bobbing animation
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  const { participants, bubbles, threads } = useMemo(
    () => getActiveConversation(conversations),
    [conversations]
  );

  const meetingPositions = useMemo(
    () => getMeetingPositions([...participants]),
    [participants]
  );

  // Get current position for each agent (home or meeting)
  const getPosition = (agentId: string) => {
    if (participants.has(agentId) && meetingPositions[agentId]) {
      return meetingPositions[agentId];
    }
    return AGENT_HOMES[agentId];
  };

  // Gentle bob
  const getBob = (agentId: string) => {
    const seed = agentId.charCodeAt(0) + agentId.charCodeAt(agentId.length - 1);
    const phase = (tick + seed) * 0.5;
    return {
      x: Math.sin(phase * 0.7) * 1,
      y: Math.sin(phase) * 1.5,
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
      
      {/* Slight overlay for readability */}
      <div className="absolute inset-0 bg-black/10" />

      {/* Connection lines between talking agents */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        {threads.map(({ from, to }, i) => {
          const fromPos = getPosition(from);
          const toPos = getPosition(to);
          if (!fromPos || !toPos) return null;
          return (
            <line
              key={`${from}-${to}-${i}`}
              x1={`${fromPos.x}%`}
              y1={`${fromPos.y}%`}
              x2={`${toPos.x}%`}
              y2={`${toPos.y}%`}
              stroke="rgba(74, 222, 128, 0.35)"
              strokeWidth="2"
              strokeDasharray="6,4"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="2s" repeatCount="indefinite" />
            </line>
          );
        })}
      </svg>

      {/* Agents */}
      {Object.entries(AGENT_HOMES).map(([agentId]) => {
        const config = AGENT_CONFIG[agentId];
        const pos = getPosition(agentId);
        const bob = getBob(agentId);
        const bubble = bubbles[agentId];
        const isInConvo = participants.has(agentId);
        
        return (
          <div
            key={agentId}
            className="absolute flex flex-col items-center"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: `translate(-50%, -50%) translate(${bob.x}px, ${bob.y}px)`,
              transition: 'left 2s ease-in-out, top 2s ease-in-out, transform 1.5s ease-in-out',
              zIndex: isInConvo ? 15 : 10,
            }}
          >
            {/* Speech bubble */}
            {bubble && (
              <div 
                className="absolute bottom-full mb-2 px-2 py-1.5 rounded-lg text-[11px] font-mono max-w-[160px] text-center leading-tight shadow-lg pointer-events-none"
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.88)',
                  border: `1px solid ${config.color}50`,
                  color: '#e5e7eb',
                  whiteSpace: 'normal',
                  zIndex: 20,
                }}
              >
                {bubble}
                <div 
                  className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
                  style={{
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '5px solid rgba(0,0,0,0.88)',
                  }}
                />
              </div>
            )}
            
            {/* Agent avatar */}
            <div 
              className="relative rounded-full overflow-hidden shadow-lg"
              style={{ 
                width: '46px', 
                height: '46px',
                border: `2px solid ${config.borderColor}`,
                boxShadow: isInConvo ? `0 0 14px ${config.color}70` : `0 2px 8px rgba(0,0,0,0.5)`,
                transition: 'box-shadow 0.5s ease',
              }}
            >
              <img 
                src={`/agents/${agentId}.png`}
                alt={config.name}
                className="w-full h-full object-cover"
              />
              {/* Pulse ring when in conversation */}
              {isInConvo && (
                <div 
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ 
                    border: `2px solid ${config.color}`,
                    opacity: 0.3,
                  }}
                />
              )}
            </div>
            
            {/* Name label */}
            <div 
              className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap"
              style={{ 
                backgroundColor: `rgba(0,0,0,0.7)`,
                color: config.color,
                border: `1px solid ${config.color}30`,
              }}
            >
              {config.name}
            </div>
          </div>
        );
      })}

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-black/70 flex items-center justify-between text-[10px] font-mono" style={{ zIndex: 20 }}>
        <div className="flex items-center gap-3">
          {Object.entries(AGENT_CONFIG).map(([id, cfg]) => (
            <div key={id} className="flex items-center gap-1">
              <div 
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: participants.has(id) ? cfg.color : '#4b5563' }}
              />
              <span style={{ color: participants.has(id) ? cfg.color : '#6b7280' }}>{cfg.name}</span>
            </div>
          ))}
        </div>
        <span className="text-gray-500">
          {participants.size > 0 
            ? `💬 ${participants.size} agents in conversation` 
            : '😴 Agents at stations'}
        </span>
      </div>
    </div>
  );
}
