import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (el?: HTMLElement) => void;
      };
    };
  }
}

export default function LatestTweet() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!document.getElementById('twitter-wjs')) {
      const script = document.createElement('script');
      script.id = 'twitter-wjs';
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      document.body.appendChild(script);
    } else if (window.twttr?.widgets) {
      window.twttr.widgets.load(containerRef.current ?? undefined);
    }
  }, []);

  return (
    <section>
      <h2 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-chum-accent" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        Latest Propaganda
      </h2>
      <div
        ref={containerRef}
        className="rounded-lg border border-chum-border bg-chum-surface overflow-hidden"
      >
        <a
          className="twitter-timeline"
          data-theme="dark"
          data-chrome="noheader nofooter noborders transparent"
          data-tweet-limit="1"
          data-link-color="#4ade80"
          href="https://twitter.com/chum_cloud"
        >
          Loading latest from @chum_cloud...
        </a>
      </div>
    </section>
  );
}
