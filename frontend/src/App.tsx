import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import VisualNovelScene from './components/VisualNovelScene';
import StatsGrid from './components/StatsGrid';
import KeepAlive from './components/KeepAlive';
import LatestTweet from './components/LatestTweet';
import VillainClaim from './components/VillainClaim';
import ChumCloud from './components/ChumCloud';
import { useChum } from './hooks/useChum';
import { useThoughtStream } from './hooks/useThoughtStream';

export default function App() {
  const chum = useChum();
  const { thoughts: streamedThoughts } = useThoughtStream();

  // SSE thoughts override polled thoughts for real-time updates
  const latestThought = streamedThoughts.length > 0
    ? streamedThoughts[0].content
    : chum.latestThought;
  const recentThoughts = streamedThoughts.length > 0
    ? streamedThoughts.map((t) => t.content)
    : chum.recentThoughts;

  return (
    <div className="min-h-screen bg-chum-bg text-chum-text">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-chum-border">
        <div className="flex items-center gap-3">
          <img 
            src="/chum-logo-cuphead-2.png" 
            alt="CHUM Logo" 
            className="w-12 h-12 md:w-16 md:h-16" 
          />
          <div className="flex flex-col">
            <span className="text-xl font-bold font-heading text-chum-accent">$CHUM</span>
            <span className="text-xs text-chum-muted hidden sm:inline">The Official Currency of World Domination</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Social Links */}
          <div className="hidden sm:flex items-center gap-3">
            <a 
              href="https://x.com/chum_cloud" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-chum-muted hover:text-chum-accent transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a 
              href="https://chum-ashen.vercel.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-chum-muted hover:text-chum-accent transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </a>
          </div>
          
          <WalletMultiButton />
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-emerald-900/20 to-transparent border-b border-chum-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">
          <h1 className="text-4xl md:text-6xl font-bold font-heading text-chum-accent mb-4">
            IN PLANKTON WE TRUST
          </h1>
          <p className="text-lg md:text-xl text-chum-muted mb-8 max-w-2xl mx-auto">
            $CHUM is the official currency of the world Plankton will conquer.
          </p>
          <div className="text-sm text-chum-muted/60">
            Welcome to the revolution. Welcome to the future. Welcome to your new headquarters.
          </div>
        </div>
        
        {/* Subtle villain ambiance */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <VisualNovelScene
          mood={chum.mood}
          healthPercent={chum.healthPercent}
          latestThought={latestThought}
          recentThoughts={recentThoughts}
        />
        <StatsGrid chum={chum} />
        <LatestTweet />
        <KeepAlive onDonation={chum.triggerCelebration} />
        <VillainClaim />
        <ChumCloud />
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-chum-muted border-t border-chum-border mt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-chum-accent font-mono font-bold">
              IN PLANKTON WE TRUST
            </div>
            
            <div className="flex items-center gap-6">
              <a 
                href="https://x.com/chum_cloud" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-chum-muted hover:text-chum-accent transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="hidden sm:inline">Twitter</span>
              </a>
              
              <a 
                href="https://chum-ashen.vercel.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-chum-muted hover:text-chum-accent transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <span className="hidden sm:inline">Website</span>
              </a>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-chum-border/30 text-xs">
            $CHUM on Solana &middot; Not financial advice &middot; World domination in progress
          </div>
        </div>
      </footer>
    </div>
  );
}
