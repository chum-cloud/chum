import { useState, useEffect, useRef, useMemo } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const AGENT_HOMES: Record<string, { x: number; y: number; zone: string }> = {
  karen:      { x: 18, y: 22, zone: 'Surveillance' },
  spy:        { x: 50, y: 14, zone: 'Intel' },
  treasurer:  { x: 82, y: 22, zone: 'Treasury' },
  chum:       { x: 50, y: 50, zone: 'War Table' },
  recruiter:  { x: 18, y: 72, zone: 'Comms' },
  henchman:   { x: 82, y: 72, zone: 'Workshop' },
};

const AGENT_CONFIG: Record<string, { name: string; hex: string }> = {
  chum:       { name: 'CHUM',       hex: '#4ade80' },
  karen:      { name: 'KAREN',      hex: '#c084fc' },
  spy:        { name: 'SPY',        hex: '#9ca3af' },
  recruiter:  { name: 'RECRUITER',  hex: '#fb923c' },
  henchman:   { name: 'HENCHMAN',   hex: '#facc15' },
  treasurer:  { name: 'TREASURER',  hex: '#34d399' },
};

interface ConversationMessage {
  id: number;
  agent_id: string;
  data: { content?: string; reply_to_agent?: string };
  created_at: string;
}

// ─── Wandering + conversation pull ───
function useWander(homeX: number, homeY: number, radius: number, pullTo: { x: number; y: number } | null) {
  const [pos, setPos] = useState({ x: homeX, y: homeY });
  const targetRef = useRef({ x: homeX, y: homeY });
  const frameRef = useRef<number>(0);

  useEffect(() => {
    // If in convo, move toward partner but stop at 30% to prevent overlap
    if (pullTo) {
      const tx = homeX + (pullTo.x - homeX) * 0.3;
      const ty = homeY + (pullTo.y - homeY) * 0.3;
      targetRef.current = { x: tx + (Math.random() - 0.5) * 2, y: ty + (Math.random() - 0.5) * 2 };
    }

    const pick = () => {
      if (pullTo) {
        const tx = homeX + (pullTo.x - homeX) * 0.3;
        const ty = homeY + (pullTo.y - homeY) * 0.3;
        targetRef.current = { x: tx + (Math.random() - 0.5) * 2, y: ty + (Math.random() - 0.5) * 2 };
      } else {
        targetRef.current = {
          x: homeX + (Math.random() - 0.5) * radius * 2,
          y: homeY + (Math.random() - 0.5) * radius * 2,
        };
      }
    };

    const move = () => {
      setPos(prev => {
        const dx = targetRef.current.x - prev.x;
        const dy = targetRef.current.y - prev.y;
        if (Math.sqrt(dx * dx + dy * dy) < 0.3) { pick(); return prev; }
        const speed = pullTo ? 0.04 : 0.06;
        return { x: prev.x + dx * speed, y: prev.y + dy * speed };
      });
      frameRef.current = requestAnimationFrame(move);
    };
    frameRef.current = requestAnimationFrame(move);
    const interval = setInterval(pick, pullTo ? 4000 : 3000 + Math.random() * 2000);
    return () => { cancelAnimationFrame(frameRef.current); clearInterval(interval); };
  }, [homeX, homeY, radius, pullTo?.x, pullTo?.y]);

  return pos;
}

// ─── Conversation parser ───
function getActiveConversation(messages: ConversationMessage[]) {
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const recent = messages.filter(m => new Date(m.created_at).getTime() > fiveMinAgo);

  const participants = new Set<string>();
  // Map agent → who they're talking to
  const talkingTo: Record<string, string> = {};
  let latestMsg: { agent: string; content: string; replyTo?: string } | null = null;

  for (const msg of recent) {
    const agentId = msg.agent_id;
    const content = msg.data?.content || '';
    const replyTo = msg.data?.reply_to_agent;

    participants.add(agentId);
    if (replyTo) {
      participants.add(replyTo);
      if (!talkingTo[agentId]) talkingTo[agentId] = replyTo;
      if (!talkingTo[replyTo]) talkingTo[replyTo] = agentId;
    }

    if (!latestMsg && content) {
      latestMsg = { agent: agentId, content, replyTo };
    }
  }

  return { participants, talkingTo, latestMsg };
}

// ─── Agent Avatar ───
function AgentAvatar({ agentId, talkingTo }: { agentId: string; talkingTo: string | null }) {
  const config = AGENT_CONFIG[agentId];
  const home = AGENT_HOMES[agentId];
  const partnerHome = talkingTo ? AGENT_HOMES[talkingTo] : null;
  const pullTo = partnerHome ? { x: partnerHome.x, y: partnerHome.y } : null;
  const pos = useWander(home.x, home.y, 1.5, pullTo);

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: talkingTo ? 15 : 10,
        transition: 'filter 0.3s',
      }}
    >
      <div
        className="relative rounded-full overflow-hidden w-9 h-9 sm:w-12 sm:h-12 md:w-14 md:h-14"
        style={{
          border: `2px solid ${config.hex}`,
          boxShadow: talkingTo ? `0 0 14px ${config.hex}50` : `0 2px 6px rgba(0,0,0,0.4)`,
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

// ─── Dialog Box (separate, below the map) ───
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
    <div className="rounded-lg overflow-hidden mt-2" style={{ backgroundColor: 'rgba(8,12,20,0.95)', border: `1px solid ${config?.hex || '#4ade80'}30` }}>
      <div className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3">
        <div className="shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden" style={{ border: `2px solid ${config?.hex}` }}>
            <img src={`/agents/${agent}.png`} alt={config?.name} className="w-full h-full object-cover" />
          </div>
        </div>
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
  );
}

// ─── Room Background (CSS) ───
function RoomBackground() {
  return (
    <div className="absolute inset-0" style={{ background: '#0c1a2a' }}>
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(74,222,128,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(74,222,128,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />
      {Object.entries(AGENT_HOMES).map(([id, home]) => (
        <div key={id} className="absolute text-[7px] sm:text-[9px] font-mono uppercase tracking-wider"
          style={{ left: `${home.x}%`, top: `${home.y + 10}%`, transform: 'translateX(-50%)', color: 'rgba(74,222,128,0.1)' }}>
          {home.zone}
        </div>
      ))}
      {/* Center table */}
      <div className="absolute" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        <div className="w-14 h-9 sm:w-20 sm:h-12 md:w-28 md:h-16 rounded-lg border border-green-900/25" style={{ background: 'rgba(74,222,128,0.03)' }}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-green-500/20 animate-pulse" />
          </div>
        </div>
      </div>
      {/* Connecting lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.06 }}>
        {['karen','spy','treasurer','recruiter','henchman'].map(id => {
          const a = AGENT_HOMES[id], c = AGENT_HOMES.chum;
          return <line key={id} x1={`${a.x}%`} y1={`${a.y}%`} x2={`${c.x}%`} y2={`${c.y}%`} stroke="#4ade80" strokeWidth="1" strokeDasharray="4,8" />;
        })}
      </svg>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(4,8,16,0.5) 100%)' }} />
    </div>
  );
}

// ─── Main ───
export default function AgentStage() {
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);

  useEffect(() => {
    let active = true;
    async function fetch_() {
      try {
        const res = await fetch(`${API}/api/agents/events?limit=20&tags=conversation`);
        if (!res.ok) return;
        const body = await res.json();
        if (active) setConversations((body.events || body || []) as ConversationMessage[]);
      } catch { /* ignore */ }
    }
    fetch_();
    const interval = setInterval(fetch_, 15000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const { talkingTo, latestMsg } = useMemo(
    () => getActiveConversation(conversations),
    [conversations]
  );

  return (
    <div>
      {/* Agent Map */}
      <div className="relative w-full rounded-lg overflow-hidden border border-chum-border" style={{ aspectRatio: '16/9' }}>
        <RoomBackground />

        {/* Active conversation lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          <defs>
            <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {Object.entries(talkingTo).map(([from, to]) => {
            const f = AGENT_HOMES[from], t = AGENT_HOMES[to];
            if (!f || !t || from > to) return null; // dedupe
            return (
              <line key={`${from}-${to}`}
                x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
                stroke="rgba(74, 222, 128, 0.25)" strokeWidth="1.5" strokeDasharray="6,4" filter="url(#glow)"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.5s" repeatCount="indefinite" />
              </line>
            );
          })}
        </svg>

        {Object.keys(AGENT_HOMES).map(id => (
          <AgentAvatar key={id} agentId={id} talkingTo={talkingTo[id] || null} />
        ))}
      </div>

      {/* Dialog box — separate, below the map */}
      {latestMsg && (
        <DialogBox agent={latestMsg.agent} content={latestMsg.content} replyTo={latestMsg.replyTo} />
      )}
    </div>
  );
}
