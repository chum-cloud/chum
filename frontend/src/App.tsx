import { useEffect } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Tank from './components/Tank';
import StatsGrid from './components/StatsGrid';
import Services from './components/Services';
import KeepAlive from './components/KeepAlive';
import ThoughtsFeed from './components/ThoughtsFeed';
import { useChum } from './hooks/useChum';
import { preloadAllUsedAnimations } from './lib/sprites';

export default function App() {
  const chum = useChum();

  useEffect(() => {
    preloadAllUsedAnimations();
  }, []);

  return (
    <div className="min-h-screen bg-chum-bg text-chum-text">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-chum-border">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold font-heading text-chum-accent">$CHUM</span>
          <span className="text-xs text-chum-muted hidden sm:inline">Keep the Plankton Alive</span>
        </div>
        <WalletMultiButton />
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Tank animationState={chum.animationState} mood={chum.mood} latestThought={chum.latestThought} />
        <StatsGrid chum={chum} />
        <ThoughtsFeed />
        <KeepAlive onDonation={chum.triggerCelebration} />
        <Services />
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-chum-muted border-t border-chum-border mt-8">
        $CHUM on Solana &middot; Not financial advice &middot; Plankton approved
      </footer>
    </div>
  );
}
