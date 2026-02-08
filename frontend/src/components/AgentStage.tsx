import { useState, useEffect, useRef, useMemo } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ─── Home positions (% based) — kept away from edges for mobile safety ───
const AGENT_HOMES: Record<string, { x: number; y: number; zone: string }> = {
  chum:       { x: 50, y: 45, zone: 'War Table' },
  karen:      { x: 18, y: 25, zone: 'Surveillance' },
  spy:        { x: 50, y: 12, zone: 'Vault' },
  recruiter:  { x: 18, y: 65, zone: 'Comms' },
  henchman:   { x: 82, y: 65, zone: 'Workshop' },
  treasurer:  { x: 82, y: 25, zone: 'Treasury' },
};

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
  
  for (const msg of recent) {
    const agentId = msg.agent_id;
    const content = msg.data?.content || '';
    const replyTo = msg.data?.reply_to_agent;
    
    participants.add(agentId);
    if (replyTo) participants.add(replyTo);
    
    if (!bubbles[agentId] && content) {
      bubbles[agentId] = content.length > 40 ? content.substring(0, 37) + '...' : content;
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
}: { 
  agentId: string; 
  isInConvo: boolean; 
  bubble: string | null;
}) {
  const config = AGENT_CONFIG[agentId];
  const home = AGENT_HOMES[agentId];
  const pos = useWander(home.x, home.y, 2);
  
  // Position bubble left/right based on agent position to prevent overflow
  const bubbleOnLeft = home.x > 50;
  
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
      {/* Speech bubble */}
      {bubble && (
        <div 
          className="absolute px-2 py-1 rounded shadow-lg pointer-events-none"
          style={{ 
            bottom: `calc(100% + 4px)`,
            ...(bubbleOnLeft ? { right: '0', left: 'auto' } : { left: '0', right: 'auto' }),
            backgroundColor: 'rgba(0,0,0,0.92)',
            border: `1px solid ${config.color}60`,
            whiteSpace: 'nowrap',
            maxWidth: '160px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            zIndex: 25,
            fontSize: '9px',
            fontFamily: 'monospace',
            lineHeight: '1.3',
          }}
        >
          <TypewriterText text={bubble} color={config.color} />
        </div>
      )}
      
      {/* Avatar — responsive sizes */}
      <div 
        className="relative rounded-full overflow-hidden shadow-lg w-8 h-8 sm:w-12 sm:h-12 md:w-[60px] md:h-[60px]"
        style={{ 
          border: `2px solid ${config.color}`,
          boxShadow: isInConvo ? `0 0 12px ${config.color}60` : `0 2px 6px rgba(0,0,0,0.5)`,
        }}
      >
        <img 
          src={`/agents/${agentId}.png`}
          alt={config.name}
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Name label */}
      <div 
        className="mt-0.5 px-1 rounded text-[6px] sm:text-[7px] md:text-[9px] font-mono font-bold whitespace-nowrap"
        style={{ 
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: config.color,
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

  return (
    <div 
      className="relative w-full rounded-lg overflow-hidden border border-chum-border"
      style={{ aspectRatio: '16/9' }}
    >
      {/* Background */}
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
        />
      ))}

      {/* Status bar — hidden on small screens, compact */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/70 hidden sm:flex items-center justify-between text-[9px] font-mono" style={{ zIndex: 20 }}>
        <div className="flex items-center gap-2 overflow-hidden">
          {Object.entries(AGENT_CONFIG).map(([id, cfg]) => (
            <div key={id} className="flex items-center gap-0.5 shrink-0">
              <div 
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: participants.has(id) ? cfg.color : '#4b5563' }}
              />
              <span style={{ color: participants.has(id) ? cfg.color : '#6b7280' }}>{cfg.name}</span>
            </div>
          ))}
        </div>
        <span className="text-gray-500 shrink-0 ml-2">
          {participants.size > 0 
            ? `💬 ${participants.size} talking` 
            : '😴 Patrolling'}
        </span>
      </div>
    </div>
  );
}
