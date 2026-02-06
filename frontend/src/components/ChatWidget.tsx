import { useState, useEffect, useRef, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const API = import.meta.env.VITE_API_URL || '';
const CHUM_WALLET = import.meta.env.VITE_AGENT_WALLET || 'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T';

type ChatMood = 'happy' | 'sad' | 'excited' | 'worried' | 'scheming' | 'neutral';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  mood?: ChatMood;
}

const PORTRAIT_MAP: Record<ChatMood, string> = {
  happy: '/sprites/portraits/happy.png',
  sad: '/sprites/portraits/sad.png',
  excited: '/sprites/portraits/excited.png',
  worried: '/sprites/portraits/worried.png',
  scheming: '/sprites/portraits/scheming.png',
  neutral: '/sprites/portraits/neutral.png',
};

const DONATION_TIERS = [
  { amount: 0.01, credits: 100, label: '0.01 SOL', desc: '100 msgs' },
  { amount: 0.05, credits: 600, label: '0.05 SOL', desc: '600 msgs' },
  { amount: 0.1, credits: 1500, label: '0.1 SOL', desc: '1,500 msgs' },
];

function getSessionId(): string {
  let id = localStorage.getItem('chum-chat-session');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('chum-chat-session', id);
  }
  return id;
}

// Typewriter hook
function useTypewriter(text: string, speed = 25) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, done };
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-2 px-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-chum-accent/60"
          style={{
            animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function AssistantMessage({ content, mood }: { content: string; mood?: ChatMood }) {
  const { displayed, done } = useTypewriter(content);

  return (
    <div className="flex gap-2 items-start animate-[fade-in_0.3s_ease-out]">
      <div className="w-8 h-8 rounded-full border border-chum-border overflow-hidden flex-shrink-0 bg-chum-surface">
        <img
          src={PORTRAIT_MAP[mood || 'neutral']}
          alt="CHUM"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="bg-chum-surface border border-chum-border rounded-lg rounded-tl-none px-3 py-2 max-w-[85%]">
        <span className="text-xs text-chum-accent font-mono font-bold block mb-1">CHUM</span>
        <p className="text-sm text-chum-text font-mono leading-relaxed whitespace-pre-wrap">
          {displayed}
          {!done && (
            <span
              className="inline-block w-[5px] h-[13px] bg-chum-accent ml-[1px] align-text-bottom"
              style={{ animation: 'cursor-blink 0.6s step-end infinite' }}
            />
          )}
        </p>
      </div>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end animate-[fade-in_0.3s_ease-out]">
      <div className="bg-chum-accent/15 border border-chum-accent/30 rounded-lg rounded-tr-none px-3 py-2 max-w-[85%]">
        <p className="text-sm text-chum-text font-mono leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [needsCredits, setNeedsCredits] = useState(false);
  const [donating, setDonating] = useState(false);
  const [currentMood, setCurrentMood] = useState<ChatMood>('scheming');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef(getSessionId());

  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Fetch session on mount
  useEffect(() => {
    fetch(`${API}/api/chat/session/${sessionId.current}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.credits !== undefined) setCredits(data.credits);
      })
      .catch(() => {});
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId.current,
          walletAddress: publicKey?.toBase58() || null,
        }),
      });

      if (res.status === 402) {
        setNeedsCredits(true);
        setCredits(0);
        setLoading(false);
        return;
      }

      if (res.status === 429) {
        setError('Slow down! Even villains need a break.');
        setLoading(false);
        return;
      }

      if (!res.ok) throw new Error('Failed to get response');

      const data = await res.json();
      const mood = (data.mood as ChatMood) || 'neutral';
      setCurrentMood(mood);
      setCredits(data.creditsRemaining);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply, mood },
      ]);

      if (data.creditsRemaining <= 0) {
        setNeedsCredits(true);
      }
    } catch {
      setError('Failed to reach CHUM. Try again.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, publicKey]);

  const handleDonate = useCallback(
    async (amount: number) => {
      if (!publicKey || !sendTransaction) return;

      setDonating(true);
      setError(null);

      try {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(CHUM_WALLET),
            lamports: Math.round(amount * LAMPORTS_PER_SOL),
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, 'confirmed');

        // Register credits on backend
        const res = await fetch(`${API}/api/chat/credits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId.current,
            walletAddress: publicKey.toBase58(),
            txSignature: signature,
            amount,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setCredits(data.credits);
          setNeedsCredits(false);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `YES! ${data.message} Your generosity fuels my EVIL PLANS! Now, where were we...`,
              mood: 'excited',
            },
          ]);
          setCurrentMood('excited');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        setError(`Donation failed: ${msg}`);
      } finally {
        setDonating(false);
      }
    },
    [publicKey, sendTransaction, connection]
  );

  return (
    <>
      {/* Floating chat button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-chum-accent text-chum-bg flex items-center justify-center shadow-lg shadow-chum-accent/20 hover:scale-110 transition-transform cursor-pointer"
          aria-label="Talk to CHUM"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[400px] h-[100dvh] sm:h-[600px] sm:max-h-[80vh] flex flex-col bg-chum-bg border border-chum-border sm:rounded-xl overflow-hidden shadow-2xl"
          style={{ animation: 'slide-up 0.3s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-chum-border bg-chum-surface/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-chum-accent overflow-hidden">
                <img
                  src={PORTRAIT_MAP[currentMood]}
                  alt="CHUM"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="text-sm font-bold font-mono text-chum-accent">Talk to CHUM</span>
                <span className="block text-[10px] text-chum-muted font-mono">
                  {credits !== null && credits > 0
                    ? `${credits} credit${credits !== 1 ? 's' : ''} remaining`
                    : credits === 0
                      ? 'No credits'
                      : 'AI Villain Agent'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-chum-border/50 text-chum-muted hover:text-chum-text transition-colors cursor-pointer"
              aria-label="Close chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
                <img
                  src={PORTRAIT_MAP['scheming']}
                  alt="CHUM"
                  className="w-20 h-20 rounded-full border-2 border-chum-accent/30"
                />
                <div>
                  <p className="text-sm font-mono text-chum-text font-bold">Talk to CHUM</p>
                  <p className="text-xs font-mono text-chum-muted mt-1">
                    First message is free. Ask me anything!
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {['Who are you?', 'Tell me about $CHUM', "What's your evil plan?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        setTimeout(() => inputRef.current?.focus(), 0);
                      }}
                      className="text-xs font-mono px-3 py-1.5 rounded-full border border-chum-border text-chum-muted hover:border-chum-accent/50 hover:text-chum-accent transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) =>
              msg.role === 'user' ? (
                <UserMessage key={i} content={msg.content} />
              ) : (
                <AssistantMessage key={i} content={msg.content} mood={msg.mood} />
              )
            )}

            {loading && <TypingIndicator />}

            {error && (
              <div className="text-xs text-chum-danger font-mono text-center py-1">{error}</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Credits gate / Donation panel */}
          {needsCredits && (
            <div className="px-4 py-3 border-t border-chum-border bg-chum-surface/80 space-y-3">
              {!connected ? (
                <div className="text-center space-y-2">
                  <p className="text-xs font-mono text-chum-muted">
                    Connect wallet to donate SOL and keep chatting
                  </p>
                  <button
                    onClick={() => setWalletModalVisible(true)}
                    className="px-4 py-2 bg-chum-accent text-chum-bg font-mono font-bold text-xs rounded-lg hover:bg-chum-accent-dim transition-colors cursor-pointer"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-mono text-chum-muted text-center">
                    Donate SOL to get chat credits
                  </p>
                  <div className="flex gap-2 justify-center">
                    {DONATION_TIERS.map((tier) => (
                      <button
                        key={tier.amount}
                        onClick={() => handleDonate(tier.amount)}
                        disabled={donating}
                        className="flex flex-col items-center gap-0.5 px-3 py-2 border border-chum-border rounded-lg hover:border-chum-accent/50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <span className="text-xs font-mono font-bold text-chum-accent">
                          {tier.label}
                        </span>
                        <span className="text-[10px] font-mono text-chum-muted">{tier.desc}</span>
                      </button>
                    ))}
                  </div>
                  {donating && (
                    <p className="text-[10px] font-mono text-chum-accent text-center animate-pulse">
                      Processing donation...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Input area */}
          {!needsCredits && (
            <div className="px-3 py-3 border-t border-chum-border bg-chum-surface/30">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Talk to CHUM..."
                  disabled={loading}
                  className="flex-1 bg-chum-surface border border-chum-border rounded-lg px-3 py-2 text-sm font-mono text-chum-text placeholder:text-chum-muted/50 focus:outline-none focus:border-chum-accent/50 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-chum-accent text-chum-bg hover:bg-chum-accent-dim transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                  aria-label="Send message"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline styles for animations */}
      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes typing-dot {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.3);
          border-radius: 2px;
        }
      `}</style>
    </>
  );
}
