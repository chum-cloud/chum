import { useState, useEffect, useRef } from 'react';

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
  title: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AgentMessage {
  id: string;
  agent: string;
  content: string;
  timestamp: string;
  type: 'event' | 'scheme';
}

const AGENT_CONFIG = {
  CHUM: {
    emoji: '🟢',
    name: 'CHUM',
    color: 'text-green-400',
    accent: 'text-green-300'
  },
  KAREN: {
    emoji: '💻',
    name: 'KAREN',
    color: 'text-purple-400',
    accent: 'text-purple-300'
  },
  SPY: {
    emoji: '🕵️',
    name: 'SPY',
    color: 'text-gray-400',
    accent: 'text-gray-300'
  },
  RECRUITER: {
    emoji: '📢',
    name: 'RECRUITER',
    color: 'text-orange-400',
    accent: 'text-orange-300'
  }
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatEventMessage(event: AgentEvent): string {
  const agentKey = event.agent_id?.toUpperCase() || 'CHUM';
  const agent = AGENT_CONFIG[agentKey as keyof typeof AGENT_CONFIG];
  const agentName = agent?.name || event.agent_id;

  try {
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

    switch (event.event_type) {
      case 'scheme_proposed': {
        const title = (data.title as string) || 'New scheme';
        const description = data.description as string;
        return `${agentName} proposed: "${title}"${description ? ' — ' + description.substring(0, 100) + (description.length > 100 ? '...' : '') : ''}`;
      }
      
      case 'scheme_reviewed': {
        const approved = data.approved as boolean;
        const reviewText = (data.review_text || data.review || 'No review text') as string;
        return `${agentName}: ${approved ? 'APPROVED' : 'REJECTED'} — ${reviewText}`;
      }
      
      case 'price_scouted': {
        const intel = (data.intel || data.report || data.message || 'Price intelligence gathered') as string;
        return `${agentName}: ${intel}`;
      }
      
      case 'mentions_scouted': {
        const intel = (data.intel || data.mentions || data.report || 'Social mentions analyzed') as string;
        return `${agentName}: ${intel}`;
      }
      
      case 'tweet_drafted': {
        const content = (data.content || data.tweet || data.text || 'Tweet content') as string;
        return `${agentName}: Drafted tweet: "${content}"`;
      }
      
      case 'cloud_post_drafted': {
        const content = (data.content || data.post || data.text || 'New cloud post drafted') as string;
        return `${agentName}: ${content}`;
      }
      
      case 'budget_analyzed': {
        const analysis = (data.analysis || data.summary || data.report || 'Budget analysis complete') as string;
        return `${agentName}: ${analysis}`;
      }
      
      default: {
        const summary = (data.content || data.message || data.summary || data.text || event.event_type.replace(/_/g, ' ')) as string;
        return `${agentName}: ${summary}`;
      }
    }
  } catch {
    return `${agentName}: ${event.event_type.replace(/_/g, ' ')}`;
  }
}

function formatSchemeMessage(scheme: Scheme): string {
  return `KAREN: New scheme "${scheme.title}" — ${scheme.description.substring(0, 100)}${scheme.description.length > 100 ? '...' : ''}`;
}

export default function AgentChat() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  // Auto-scroll to latest message when new ones arrive
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      lastMessageCountRef.current = messages.length;
    }
  }, [messages]);

  useEffect(() => {
    let active = true;

    async function fetchMessages() {
      try {
        const base = import.meta.env.VITE_API_URL || '';
        
        // Show typing indicator briefly
        setIsTyping(true);
        
        // Fetch both events and schemes
        const [eventsRes, schemesRes] = await Promise.all([
          fetch(`${base}/api/agents/events?limit=20`),
          fetch(`${base}/api/agents/schemes?limit=10`)
        ]);

        if (!active) return;

        const allMessages: AgentMessage[] = [];

        // Process events
        if (eventsRes.ok) {
          const eventsBody = await eventsRes.json();
          const events: AgentEvent[] = eventsBody.events || eventsBody || [];
          for (const event of events) {
            const agentKey = event.agent_id?.toUpperCase() || '';
            const agent = AGENT_CONFIG[agentKey as keyof typeof AGENT_CONFIG];
            if (agent) {
              allMessages.push({
                id: `event-${event.id}`,
                agent: agentKey,
                content: formatEventMessage(event),
                timestamp: event.created_at,
                type: 'event'
              });
            }
          }
        }

        // Process schemes
        if (schemesRes.ok) {
          const schemesBody = await schemesRes.json();
          const schemes: Scheme[] = schemesBody.schemes || schemesBody || [];
          for (const scheme of schemes) {
            allMessages.push({
              id: `scheme-${scheme.id}`,
              agent: 'KAREN',
              content: formatSchemeMessage(scheme),
              timestamp: scheme.created_at,
              type: 'scheme'
            });
          }
        }

        // Sort by timestamp and take latest 10
        const sortedMessages = allMessages
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10)
          .reverse(); // Show oldest first in UI

        if (active) {
          setMessages(sortedMessages);
        }
        
        // Hide typing indicator after a brief delay
        setTimeout(() => {
          if (active) setIsTyping(false);
        }, 500);
      } catch {
        if (active) setIsTyping(false);
      }
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section>
      <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
        <span className="text-2xl">💬</span>
        Agent War Room
      </h2>

      <div className="bg-chum-surface border border-chum-border rounded-lg overflow-hidden">
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-chum-border/50 bg-chum-bg/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-mono text-chum-muted">Live Feed</span>
            </div>
            <a
              href="/war-room"
              className="text-xs text-chum-accent hover:text-chum-accent/80 font-mono transition-colors"
            >
              View All →
            </a>
          </div>
        </div>

        {/* Chat messages */}
        <div 
          ref={scrollRef}
          className="h-80 overflow-y-auto p-4 space-y-3 scroll-smooth"
        >
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-chum-muted text-sm font-mono mb-2">
                Agents are sleeping...
              </p>
              <p className="text-xs text-chum-muted/60 font-mono">
                No recent activity detected
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const agentConfig = AGENT_CONFIG[message.agent as keyof typeof AGENT_CONFIG];
                return (
                  <div key={message.id} className="flex items-start gap-3">
                    {/* Agent avatar */}
                    <div className="flex-shrink-0">
                      <span className="text-lg">{agentConfig?.emoji || '🤖'}</span>
                    </div>
                    
                    {/* Message content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-bold ${agentConfig?.color || 'text-chum-accent'}`}>
                          {agentConfig?.name || message.agent}
                        </span>
                        <span className="text-xs text-chum-muted/60 font-mono">
                          {timeAgo(message.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-chum-text font-mono leading-relaxed break-words">
                        {message.content}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <span className="text-lg">⚡</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-chum-muted">Agents</span>
                      <span className="text-xs text-chum-muted/60 font-mono">thinking</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-chum-accent/60 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-chum-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-chum-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Chat footer */}
        <div className="px-4 py-3 border-t border-chum-border/50 bg-chum-bg/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs font-mono text-chum-muted/60">
              <div className="flex items-center gap-1">
                <span className="text-green-400">●</span>
                <span>CHUM</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-purple-400">●</span>
                <span>KAREN</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">●</span>
                <span>SPY</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-orange-400">●</span>
                <span>RECRUITER</span>
              </div>
            </div>
            <span className="text-xs text-chum-muted/40 font-mono">
              Live updates every 30s
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}