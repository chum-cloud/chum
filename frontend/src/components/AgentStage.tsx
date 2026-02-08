import { useState, useEffect, useRef, useMemo } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ─── Home positions for each agent (% based, matching rooms on the top-down HQ map) ───
const AGENT_HOMES: Record<string, { x: number; y: number; zone: string }> = {
  chum:       { x: 50, y: 50, zone: 'War Table' },         // Center table
  karen:      { x: 14, y: 30, zone: 'Surveillance' },      // Top-left monitors
  spy:        { x: 50, y: 15, zone: 'Vault' },             // Top center near vault
  recruiter:  { x: 14, y: 75, zone: 'Comms' },             // Bottom-left comms desk
  henchman:   { x: 86, y: 75, zone: 'Workshop' },          // Bottom-right workshop
  treasurer:  { x: 86, y: 30, zone: 'Treasury' },          // Top-right treasury desk
};

// No single meeting point — agents stay in their zones during conversations

const AGENT_CONFIG: Record<string, { name: string; color: string }> = {
  chum:       { name: 'CHUM',       color: '#4ade80' },
  karen:      { name: 'KAREN',      color: '#c084fc' },
  spy:        { name: 'SPY',        color: '#9ca3af' },
  recruiter:  { name: 'RECRUITER',  color: '#fb923c' },
  henchman:   { name: 'HENCHMAN',   color: '#facc15' },
  treasurer:  { name: 'TREASURER',  color: '#34d399' },
};

interface ConversationMessage {
  id: number;
  agent_id: string;
  data: {
    content?: string;
    reply_to_agent?: string;
  };
  created_at: string;
}

// ─── Typewriter effect ───
function TypewriterText({ text, color }: { text: string; color: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [text]);
  
  return (
    <span>
      <span style={{ color }}>{displayed}</span>
      {!done && <span className="animate-pulse" style={{ color }}>▌</span>}
    </span>
  );
}

// ─── Continuous random wandering within a radius ───
function useWander(homeX: number, homeY: number, radius: number) {
  const [pos, setPos] = useState({ x: homeX, y: homeY });
  const targetRef = useRef({ x: homeX, y: homeY });
  const frameRef = useRef<number>(0);
  
  useEffect(() => {
    // Wander around home
    const pickNewTarget = () => {
      targetRef.current = {
        x: homeX + (Math.random() - 0.5) * radius * 2,
        y: homeY + (Math.random() - 0.5) * radius * 2,
      };
    };
    
    pickNewTarget();
    
    const move = () => {
      setPos(prev => {
        const dx = targetRef.current.x - prev.x;
        const dy = targetRef.current.y - prev.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 0.3) {
          pickNewTarget();
          return prev;
        }
        
        const speed = 0.08;
        return {
          x: prev.x + dx * speed,
          y: prev.y + dy * speed,
        };
      });
      frameRef.current = requestAnimationFrame(move);
    };
    
    frameRef.current = requestAnimationFrame(move);
    
    // Pick new targets periodically
    const interval = setInterval(pickNewTarget, 2000 + Math.random() * 3000);
    
    return () => {
      cancelAnimationFrame(frameRef.current);
      clearInterval(interval);
    };
  }, [homeX, homeY, radius]);
  
  return pos;
}

// ─── Get active conversation data ───
function getActiveConversation(messages: ConversationMessage[]) {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const recent = messages.filter(m => new Date(m.created_at).getTime() > fiveMinAgo);
  
  const participants = new Set<string>();
  const bubbles: Record<string, string> = {};
  const threads: Array<{ from: string; to: string }> = [];
  
  // Only keep most recent message per agent
  for (const msg of recent) {
    const agentId = msg.agent_id;
    const content = msg.data?.content || '';
    const replyTo = msg.data?.reply_to_agent;
    
    participants.add(agentId);
    if (replyTo) participants.add(replyTo);
    
    if (!bubbles[agentId] && content) {
      bubbles[agentId] = content.length > 70 ? content.substring(0, 67) + '...' : content;
    }
    
    if (replyTo && !threads.find(t => t.from === agentId && t.to === replyTo)) {
      threads.push({ from: agentId, to: replyTo });
    }
  }
  
  return { participants, bubbles, threads };
}

// ─── Single Agent on the map ───
function AgentAvatar({ 
  agentId, 
  isInConvo, 
  bubble, 
  bubbleIndex,
}: { 
  agentId: string; 
  isInConvo: boolean; 
  bubble: string | null;
  bubbleIndex: number;
}) {
  const config = AGENT_CONFIG[agentId];
  const home = AGENT_HOMES[agentId];
  const pos = useWander(home.x, home.y, 2);
  
  // Stagger bubbles vertically so they don't overlap
  const bubbleOffset = bubbleIndex * 28;
  
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isInConvo ? 15 : 10,
      }}
    >
      {/* Speech bubble — positioned above with stagger */}
      {bubble && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded shadow-lg pointer-events-none"
          style={{ 
            bottom: `calc(100% + ${8 + bubbleOffset}px)`,
            backgroundColor: 'rgba(0,0,0,0.92)',
            border: `1px solid ${config.color}60`,
            whiteSpace: 'nowrap',
            maxWidth: '200px',
            overflow: 'hidden',
            zIndex: 25 + bubbleIndex,
            fontSize: '11px',
            fontFamily: 'monospace',
            lineHeight: '1.4',
          }}
        >
          <TypewriterText text={bubble} color={config.color} />
          {bubbleIndex === 0 && (
            <div 
              className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid rgba(0,0,0,0.92)',
              }}
            />
          )}
        </div>
      )}
      
      {/* Avatar */}
      <div 
        className="relative rounded-full overflow-hidden shadow-lg w-10 h-10 sm:w-14 sm:h-14 md:w-[72px] md:h-[72px]"
        style={{ 
          border: `2px solid ${config.color}`,
          boxShadow: isInConvo ? `0 0 16px ${config.color}60` : `0 2px 8px rgba(0,0,0,0.5)`,
        }}
      >
        <img 
          src={`/agents/${agentId}.png`}
          alt={config.name}
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Name */}
      <div 
        className="mt-0.5 px-1 py-0.5 rounded text-[7px] sm:text-[8px] md:text-[9px] font-mono font-bold whitespace-nowrap"
        style={{ 
          backgroundColor: 'rgba(0,0,0,0.75)',
          color: config.color,
          border: `1px solid ${config.color}30`,
        }}
      >
        {config.name}
      </div>
    </div>
  );
}

// ─── Main Stage ───
export default function AgentStage() {
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);

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

  const { participants, bubbles, threads } = useMemo(
    () => getActiveConversation(conversations),
    [conversations]
  );

  // Assign bubble stagger index per agent
  const bubbleAgents = Object.keys(bubbles);

  return (
    <div 
      className="relative w-full rounded-lg overflow-hidden border border-chum-border"
      style={{ aspectRatio: '16/9' }}
    >
      {/* Background — underwater office HQ */}
      <div className="absolute inset-0 bg-[#0a1520]" />
      <img 
        src="/agents/hq-topdown.png" 
        alt="Villain HQ" 
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'brightness(1.15) saturate(1.1)' }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(4,10,20,0.4) 100%)' }} />

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {threads.map(({ from, to }, i) => {
          const fromHome = AGENT_HOMES[from];
          const toHome = AGENT_HOMES[to];
          if (!fromHome || !toHome) return null;
          return (
            <line
              key={`${from}-${to}-${i}`}
              x1={`${fromHome.x}%`}
              y1={`${fromHome.y}%`}
              x2={`${toHome.x}%`}
              y2={`${toHome.y}%`}
              stroke="rgba(74, 222, 128, 0.4)"
              strokeWidth="1.5"
              strokeDasharray="6,4"
              filter="url(#glow)"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite" />
            </line>
          );
        })}
      </svg>

      {/* Agents */}
      {Object.keys(AGENT_HOMES).map((agentId) => (
        <AgentAvatar
          key={agentId}
          agentId={agentId}
          isInConvo={participants.has(agentId)}
          bubble={bubbles[agentId] || null}
          bubbleIndex={bubbleAgents.indexOf(agentId)}
        />
      ))}

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
            ? `💬 ${participants.size} agents talking` 
            : '😴 Agents patrolling'}
        </span>
      </div>
    </div>
  );
}
