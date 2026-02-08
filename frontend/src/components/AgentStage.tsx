import { useState, useEffect, useRef, useMemo } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ─── Agent positions (%) ───
const AGENT_HOMES: Record<string, { x: number; y: number; zone: string }> = {
  karen:      { x: 18, y: 22, zone: 'Surveillance' },
  spy:        { x: 50, y: 14, zone: 'Intel' },
  treasurer:  { x: 82, y: 22, zone: 'Treasury' },
  chum:       { x: 50, y: 48, zone: 'War Table' },
  recruiter:  { x: 18, y: 62, zone: 'Comms' },
  henchman:   { x: 82, y: 62, zone: 'Workshop' },
};

const AGENT_CONFIG: Record<string, { name: string; color: string; hex: string }> = {
  chum:       { name: 'CHUM',       color: 'text-green-400',   hex: '#4ade80' },
  karen:      { name: 'KAREN',      color: 'text-purple-400',  hex: '#c084fc' },
  spy:        { name: 'SPY',        color: 'text-gray-400',    hex: '#9ca3af' },
  recruiter:  { name: 'RECRUITER',  color: 'text-orange-400',  hex: '#fb923c' },
  henchman:   { name: 'HENCHMAN',   color: 'text-yellow-400',  hex: '#facc15' },
  treasurer:  { name: 'TREASURER',  color: 'text-emerald-400', hex: '#34d399' },
};

interface ConversationMessage {
  id: number;
  agent_id: string;
  data: { content?: string; reply_to_agent?: string };
  created_at: string;
}

// ─── Wandering hook ───
function useWander(homeX: number, homeY: number, radius: number) {
  const [pos, setPos] = useState({ x: homeX, y: homeY });
  const targetRef = useRef({ x: homeX, y: homeY });
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const pick = () => {
      targetRef.current = {
        x: homeX + (Math.random() - 0.5) * radius * 2,
        y: homeY + (Math.random() - 0.5) * radius * 2,
      };
    };
    pick();
    const move = () => {
      setPos(prev => {
        const dx = targetRef.current.x - prev.x;
        const dy = targetRef.current.y - prev.y;
        if (Math.sqrt(dx * dx + dy * dy) < 0.3) { pick(); return prev; }
        return { x: prev.x + dx * 0.06, y: prev.y + dy * 0.06 };
      });
      frameRef.current = requestAnimationFrame(move);
    };
    frameRef.current = requestAnimationFrame(move);
    const interval = setInterval(pick, 3000 + Math.random() * 2000);
    return () => { cancelAnimationFrame(frameRef.current); clearInterval(interval); };
  }, [homeX, homeY, radius]);

  return pos;
}

// ─── Get conversation data ───
function getActiveConversation(messages: ConversationMessage[]) {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const recent = messages.filter(m => new Date(m.created_at).getTime() > fiveMinAgo);

  const participants = new Set<string>();
  const threads: Array<{ from: string; to: string }> = [];
  let latestMsg: { agent: string; content: string; replyTo?: string } | null = null;

  for (const msg of recent) {
    const agentId = msg.agent_id;
    const content = msg.data?.content || '';
    const replyTo = msg.data?.reply_to_agent;

    participants.add(agentId);
    if (replyTo) participants.add(replyTo);

    if (!latestMsg && content) {
      latestMsg = { agent: agentId, content, replyTo };
    }

    if (replyTo && !threads.find(t => t.from === agentId && t.to === replyTo)) {
      threads.push({ from: agentId, to: replyTo });
    }
  }

  return { participants, threads, latestMsg };
}

// ─── Agent Avatar ───
function AgentAvatar({ agentId, isInConvo }: { agentId: string; isInConvo: boolean }) {
  const config = AGENT_CONFIG[agentId];
  const home = AGENT_HOMES[agentId];
  const pos = useWander(home.x, home.y, 1.5);

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      }}
    >
      <div
        className="relative rounded-full overflow-hidden w-8 h-8 sm:w-11 sm:h-11 md:w-14 md:h-14"
        style={{
          border: `2px solid ${config.hex}`,
          boxShadow: isInConvo ? `0 0 14px ${config.hex}50` : `0 2px 6px rgba(0,0,0,0.4)`,
        }}
      >
        <img src={`/agents/${agentId}.png`} alt={config.name} className="w-full h-full object-cover" />
      </div>
      <div
        className="mt-0.5 px-1 rounded text-[6px] sm:text-[7px] md:text-[8px] font-mono font-bold"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: config.hex }}
      >
        {config.name}
      </div>
    </div>
  );
}

// ─── Dialog Box (visual novel style) ───
function DialogBox({ agent, content, replyTo }: { agent: string; content: string; replyTo?: string }) {
  const config = AGENT_CONFIG[agent];
  const replyConfig = replyTo ? AGENT_CONFIG[replyTo] : null;
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i <= content.length) setDisplayed(content.slice(0, i));
      else clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [content]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20">
      <div className="mx-2 mb-2 sm:mx-4 sm:mb-3 rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(8,12,20,0.93)', border: `1px solid ${config?.hex || '#4ade80'}40` }}>
        <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3">
          {/* PFP */}
          <div className="shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden" style={{ border: `2px solid ${config?.hex}` }}>
              <img src={`/agents/${agent}.png`} alt={config?.name} className="w-full h-full object-cover" />
            </div>
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs sm:text-sm font-mono font-bold" style={{ color: config?.hex }}>{config?.name}</span>
              {replyConfig && (
                <span className="text-[10px] sm:text-xs font-mono text-chum-muted">
                  → <span style={{ color: replyConfig.hex }}>{replyConfig.name}</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-mono text-chum-text leading-relaxed">
              {displayed}
              {displayed.length < content.length && <span className="animate-pulse text-chum-accent">▌</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Room Background (pure CSS) ───
function RoomBackground() {
  return (
    <div className="absolute inset-0" style={{ background: '#0c1a2a' }}>
      {/* Floor grid */}
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(74,222,128,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(74,222,128,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      {/* Zone labels */}
      {Object.entries(AGENT_HOMES).map(([id, home]) => (
        <div
          key={id}
          className="absolute text-[8px] sm:text-[10px] font-mono uppercase tracking-wider"
          style={{
            left: `${home.x}%`,
            top: `${home.y + 12}%`,
            transform: 'translateX(-50%)',
            color: 'rgba(74,222,128,0.12)',
          }}
        >
          {home.zone}
        </div>
      ))}

      {/* Center war table */}
      <div className="absolute" style={{ left: '50%', top: '48%', transform: 'translate(-50%, -50%)' }}>
        <div className="w-16 h-10 sm:w-24 sm:h-14 md:w-32 md:h-20 rounded-lg border border-green-900/30" style={{ background: 'rgba(74,222,128,0.04)' }}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500/20 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Corner desk zones */}
      {[
        { x: 8, y: 10, w: 'w-14 sm:w-20', h: 'h-10 sm:h-14' },  // top-left
        { x: 72, y: 10, w: 'w-14 sm:w-20', h: 'h-10 sm:h-14' },  // top-right
        { x: 8, y: 52, w: 'w-14 sm:w-20', h: 'h-10 sm:h-14' },  // bottom-left
        { x: 72, y: 52, w: 'w-14 sm:w-20', h: 'h-10 sm:h-14' },  // bottom-right
      ].map((zone, i) => (
        <div key={i} className={`absolute ${zone.w} ${zone.h} rounded border border-green-900/20`} style={{ left: `${zone.x}%`, top: `${zone.y}%`, background: 'rgba(74,222,128,0.02)' }} />
      ))}

      {/* Subtle pipes/lines connecting zones */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.08 }}>
        <line x1="18%" y1="30%" x2="50%" y2="48%" stroke="#4ade80" strokeWidth="1" strokeDasharray="4,8" />
        <line x1="82%" y1="30%" x2="50%" y2="48%" stroke="#4ade80" strokeWidth="1" strokeDasharray="4,8" />
        <line x1="18%" y1="62%" x2="50%" y2="48%" stroke="#4ade80" strokeWidth="1" strokeDasharray="4,8" />
        <line x1="82%" y1="62%" x2="50%" y2="48%" stroke="#4ade80" strokeWidth="1" strokeDasharray="4,8" />
        <line x1="50%" y1="14%" x2="50%" y2="48%" stroke="#4ade80" strokeWidth="1" strokeDasharray="4,8" />
      </svg>

      {/* Vignette */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(4,8,16,0.6) 100%)' }} />
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

  const { participants, threads, latestMsg } = useMemo(
    () => getActiveConversation(conversations),
    [conversations]
  );

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden border border-chum-border"
      style={{ aspectRatio: '16/9' }}
    >
      {/* Code-drawn room background */}
      <RoomBackground />

      {/* Connection lines between talking agents */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {threads.map(({ from, to }, i) => {
          const f = AGENT_HOMES[from], t = AGENT_HOMES[to];
          if (!f || !t) return null;
          return (
            <line key={`${from}-${to}-${i}`}
              x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
              stroke="rgba(74, 222, 128, 0.3)" strokeWidth="1.5" strokeDasharray="6,4" filter="url(#glow)"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite" />
            </line>
          );
        })}
      </svg>

      {/* Agents */}
      {Object.keys(AGENT_HOMES).map(id => (
        <AgentAvatar key={id} agentId={id} isInConvo={participants.has(id)} />
      ))}

      {/* Dialog box — latest message */}
      {latestMsg && (
        <DialogBox agent={latestMsg.agent} content={latestMsg.content} replyTo={latestMsg.replyTo} />
      )}
    </div>
  );
}
