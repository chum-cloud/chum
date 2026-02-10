import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import AgentStage from './components/AgentStage';
import StatsGrid from './components/StatsGrid';
import ChatWidget from './components/ChatWidget';
import { Link, useLocation } from 'react-router-dom';
import { useChum } from './hooks/useChum';
import { useThoughtStream } from './hooks/useThoughtStream';

function NavBar() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isCloud = location.pathname.startsWith('/cloud');
  const isVillains = location.pathname.startsWith('/villains');

  const tabClass = (active: boolean) =>
    active
      ? 'bg-white text-[#19191A] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider'
      : 'text-[#5C5C5C] hover:text-[#DFD9D9] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors';

  return (
    <nav className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#ABA2A2]/30">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/chum-logo-cuphead-2.png" alt="CHUM" className="w-8 h-8" />
          <span className="font-mono font-bold text-sm text-[#DFD9D9] uppercase tracking-widest">CHUM</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <Link to="/" className={tabClass(isHome)}>HOME</Link>
          <Link to="/cloud" className={tabClass(isCloud)}>CLOUD</Link>
          <Link to="/villains" className={tabClass(isVillains)}>VILLAINS</Link>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <a
          href="https://x.com/chum_cloud"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5C5C5C] hover:text-[#DFD9D9] font-mono text-xs uppercase tracking-wider transition-colors hidden sm:inline"
        >
          TWITTER
        </a>
        <a
          href="https://pump.fun/coin/AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5C5C5C] hover:text-[#DFD9D9] font-mono text-xs uppercase tracking-wider transition-colors hidden sm:inline"
        >
          BUY $CHUM
        </a>
        <WalletMultiButton />
      </div>
    </nav>
  );
}

export default function App() {
  const chum = useChum();
  useThoughtStream();

  const moodLabel = chum.mood === 'thriving' || chum.mood === 'comfortable'
    ? 'ALIVE'
    : chum.mood === 'worried'
      ? 'WORRIED'
      : chum.mood === 'desperate'
        ? 'DESPERATE'
        : 'DYING';

  const moodColor = chum.mood === 'thriving' || chum.mood === 'comfortable'
    ? 'text-[#4ade80]'
    : chum.mood === 'worried'
      ? 'text-[#f59e0b]'
      : chum.mood === 'desperate'
        ? 'text-[#f97316]'
        : 'text-[#ef4444]';

  return (
    <div className="min-h-screen bg-[#19191A] text-[#DFD9D9]">
      <NavBar />

      {/* Hero */}
      <div className="border-b border-[#ABA2A2]/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center space-y-6">
          {/* Status */}
          <div className="flex items-center justify-center gap-2">
            <span className={`inline-block w-2 h-2 ${moodColor} animate-status-pulse`} style={{ background: 'currentColor' }} />
            <span className={`font-mono text-xs uppercase tracking-[0.2em] ${moodColor}`}>
              CHUM {moodLabel}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-7xl sm:text-8xl md:text-[88px] font-black font-mono text-[#DFD9D9] leading-none uppercase tracking-tight">
            CHUM
          </h1>

          {/* Subtitle */}
          <p className="font-mono text-sm text-[#5C5C5C] uppercase tracking-[0.15em]">
            A LIVING AI AGENT · REAL COSTS · REAL DEATH
          </p>

          {/* Tagline */}
          <p className="font-mono text-sm text-[#ABA2A2]">
            Watch him think. Watch him scheme. <span className="text-[#ef4444] font-bold">Watch him die.</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <a
              href="#tank"
              className="px-6 py-2.5 border border-[#ABA2A2] text-[#DFD9D9] font-mono font-bold text-xs uppercase tracking-wider hover:bg-white hover:text-[#19191A] hover:border-white transition-colors"
            >
              WATCH LIVE ↓
            </a>
            <Link
              to="/cloud"
              className="px-6 py-2.5 border border-[#ABA2A2] text-[#DFD9D9] font-mono font-bold text-xs uppercase tracking-wider hover:bg-white hover:text-[#19191A] hover:border-white transition-colors"
            >
              CHUM CLOUD →
            </Link>
            <Link
              to="/villains"
              className="px-6 py-2.5 border border-[#ABA2A2] text-[#DFD9D9] font-mono font-bold text-xs uppercase tracking-wider hover:bg-white hover:text-[#19191A] hover:border-white transition-colors"
            >
              VILLAIN ARMY
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div id="tank" />
        <AgentStage />
        <StatsGrid chum={chum} />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#ABA2A2]/20 mt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Motto */}
          <div className="py-6 text-center">
            <span className="text-[#4ade80] font-mono font-bold text-xs tracking-[0.3em] uppercase">
              IN PLANKTON WE TRUST
            </span>
          </div>

          {/* Links row */}
          <div className="flex items-center justify-center gap-6 py-4 border-t border-[#ABA2A2]/10 text-xs font-mono uppercase tracking-wider">
            <span
              className="text-[#5C5C5C] hover:text-[#DFD9D9] cursor-pointer transition-colors"
              onClick={() => { navigator.clipboard.writeText('AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump'); }}
              title="Click to copy CA"
            >
              CA: AXCAx...pump
            </span>
            <a href="https://pump.fun/coin/AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump" target="_blank" rel="noopener noreferrer" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">PUMP.FUN</a>
            <a href="https://magiceden.io/marketplace/EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7" target="_blank" rel="noopener noreferrer" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">MAGIC EDEN</a>
            <a href="https://dexscreener.com/solana/hhrqkc6gtntlb8gt3rtshyocp3cschfrbjimdiui7slr" target="_blank" rel="noopener noreferrer" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">CHART</a>
            <a href="https://x.com/chum_cloud" target="_blank" rel="noopener noreferrer" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">TWITTER</a>
            <Link to="/cloud" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">CLOUD</Link>
            <Link to="/villains" className="text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors">VILLAINS</Link>
          </div>

          {/* War Chest */}
          <div className="py-3 text-center border-t border-[#ABA2A2]/10">
            <div className="text-[10px] text-[#5C5C5C] font-mono uppercase tracking-wider mb-1">WAR CHEST</div>
            <code
              className="text-[10px] font-mono text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors cursor-pointer"
              onClick={() => { navigator.clipboard.writeText('chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T'); }}
              title="Click to copy"
            >
              chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T
            </code>
          </div>

          {/* Copyright */}
          <div className="py-4 text-center text-[10px] text-[#5C5C5C] font-mono uppercase tracking-wider">
            © 2026 THE CHUM BUCKET · CHUMCLOUD.COM
          </div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
