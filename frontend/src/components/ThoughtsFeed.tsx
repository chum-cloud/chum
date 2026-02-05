import { useThoughtStream } from '../hooks/useThoughtStream';

const MOOD_EMOJI: Record<string, string> = {
  thriving: '😎',
  comfortable: '😌',
  content: '😊',
  hopeful: '🤞',
  worried: '😰',
  anxious: '😟',
  desperate: '😱',
  devastated: '💀',
  dying: '☠️',
  ecstatic: '🎉',
  grateful: '🥹',
  jealous: '😤',
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

export default function ThoughtsFeed() {
  const { thoughts, isConnected } = useThoughtStream();

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold font-heading">💭 CHUM's Thoughts</h2>
        {isConnected ? (
          <span className="text-xs font-mono text-green-400">● LIVE</span>
        ) : (
          <span className="text-xs font-mono text-yellow-400">○ Reconnecting...</span>
        )}
      </div>

      {thoughts.length === 0 ? (
        <div className="text-chum-muted text-sm font-mono">
          {isConnected ? 'The void stares back. No thoughts yet.' : 'Connecting to thought stream...'}
        </div>
      ) : (
        <div className="space-y-3">
          {thoughts.map((t) => (
            <div
              key={t.id}
              className="bg-chum-surface border border-chum-border rounded-lg p-4 hover:border-chum-accent/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {MOOD_EMOJI[t.mood] || '💭'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-chum-text leading-relaxed whitespace-pre-wrap">
                    {t.content}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-chum-muted font-mono">
                    <span>{timeAgo(t.created_at)}</span>
                    <span className="capitalize">{t.mood}</span>
                    {t.tweeted && (
                      <span className="text-blue-400">
                        𝕏 tweeted
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
