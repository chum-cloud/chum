import { useState, useEffect } from 'react';

interface TweetedThought {
  id: number;
  content: string;
  mood: string;
  tweeted: boolean;
  tweet_id: string | null;
  created_at: string;
}

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

export default function LatestTweet() {
  const [tweet, setTweet] = useState<TweetedThought | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchLatestTweet() {
      try {
        const base = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${base}/api/thoughts?limit=50`);
        if (!res.ok) return;
        const thoughts: TweetedThought[] = await res.json();
        // Find the most recent tweeted thought
        const tweeted = thoughts.find((t) => t.tweeted);
        if (active && tweeted) setTweet(tweeted);
      } catch {
        // silent
      }
    }

    fetchLatestTweet();
    const interval = setInterval(fetchLatestTweet, 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section>
      <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-chum-accent" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        Latest Propaganda
      </h2>

      <div className="bg-chum-surface border border-chum-border rounded-lg p-5">
        {tweet ? (
          <div>
            <p className="text-sm font-mono text-chum-text leading-relaxed whitespace-pre-wrap">
              "{tweet.content}"
            </p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-chum-muted font-mono">
                {timeAgo(tweet.created_at)}
              </span>
              {tweet.tweet_id && (
                <a
                  href={`https://x.com/chum_cloud/status/${tweet.tweet_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                >
                  View on 𝕏
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-chum-muted text-sm font-mono mb-3">
              No recent transmissions intercepted.
            </p>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-chum-border/50">
          <a
            href="https://x.com/chum_cloud"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-chum-muted hover:text-chum-accent font-mono transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            Follow @chum_cloud
          </a>
        </div>
      </div>
    </section>
  );
}
