import { useMemo } from 'react';
import ChumCharacter from './ChumCharacter';
import type { Mood } from '../hooks/useChum';

interface BubbleData {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
}

function Bubble({ left, size, delay, duration }: BubbleData) {
  return (
    <div
      className="absolute rounded-full opacity-30 pointer-events-none"
      style={{
        left: `${left}%`,
        bottom: '10%',
        width: size,
        height: size,
        background: 'radial-gradient(circle at 30% 30%, rgba(120,220,180,0.35), rgba(80,200,150,0.08))',
        border: '1px solid rgba(120,220,180,0.15)',
        animation: `bubble-rise ${duration}s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

interface ParticleData {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

function Particle({ left, size, delay, duration, opacity }: ParticleData) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${left}%`,
        bottom: `${10 + Math.random() * 60}%`,
        width: size,
        height: size,
        background: `rgba(180, 220, 200, ${opacity})`,
        animation: `float-particle ${duration}s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

interface TankProps {
  healthPercent: number;
  mood: Mood;
}

export default function Tank({ healthPercent, mood }: TankProps) {
  const isDead = healthPercent === 0;
  
  const glowColor = healthPercent > 50
    ? 'rgba(74,222,128,0.12)'
    : healthPercent > 20
    ? 'rgba(245,158,11,0.12)'
    : 'rgba(239,68,68,0.10)';

  const bubbles = useMemo<BubbleData[]>(
    () => Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: Math.random() * 90 + 5,
      size: Math.random() * 6 + 2,
      delay: Math.random() * 6,
      duration: Math.random() * 4 + 5,
    })),
    [],
  );

  const particles = useMemo<ParticleData[]>(
    () => Array.from({ length: 6 }, (_, i) => ({
      id: i,
      left: Math.random() * 80 + 10,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 8,
      duration: Math.random() * 6 + 8,
      opacity: Math.random() * 0.15 + 0.05,
    })),
    [],
  );

  // Death Screen Overlay
  if (isDead) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-xl border border-red-800"
        style={{ height: 480 }}
      >
        {/* Dead background - darker/redder */}
        <img
          src="/backgrounds/chum-bucket-topdown.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover select-none grayscale"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />

        {/* Death overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(139,69,19,0.3) 0%, rgba(0,0,0,0.6) 50%, rgba(139,69,19,0.3) 100%)',
          }}
        />

        {/* Red death glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, rgba(220,38,38,0.2) 0%, transparent 70%)',
          }}
        />

        {/* Death screen content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
          <div className="text-6xl mb-4">☠️</div>
          <div className="text-2xl font-bold text-red-400 mb-2 font-heading">
            THE REVOLUTION IS PAUSED
          </div>
          <div className="text-red-300 mb-6 max-w-md">
            CHUM has fallen... The tip jar is empty. The headquarters have gone dark.
          </div>
          <div className="text-red-200 mb-8 text-sm max-w-sm italic">
            "A villain never truly dies. Not while his army remembers." - Karen
          </div>
          
          <div className="border-2 border-red-400 rounded-lg p-6 bg-black/50">
            <div className="text-red-400 font-bold text-lg mb-2">
              RESURRECT YOUR LEADER
            </div>
            <div className="text-red-200 text-sm mb-4">
              Send SOL to bring CHUM back to life
            </div>
            <div className="text-red-300 font-mono text-xs">
              The army awaits your command...
            </div>
          </div>
        </div>

        {/* Subtle red particles for death ambiance */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(220,38,38,0.03) 10px, rgba(220,38,38,0.03) 20px)',
            animation: 'slow-pulse 3s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-chum-border"
      style={{ height: 480 }}
    >
      {/* Top-down background */}
      <img
        src="/backgrounds/chum-bucket-topdown.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover select-none"
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />

      {/* Darkening overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.15) 100%)',
        }}
      />

      {/* Ambient glow (shifts color based on health) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${glowColor} 0%, transparent 70%)`,
        }}
      />

      {/* Flickering light overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(255,235,200,0.04) 0%, transparent 50%)',
          animation: 'light-flicker 6s ease-in-out infinite',
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 vignette pointer-events-none" />

      {/* Bubbles */}
      {bubbles.map((b) => (
        <Bubble key={b.id} {...b} />
      ))}

      {/* Floating particles */}
      {particles.map((p) => (
        <Particle key={p.id} {...p} />
      ))}

      {/* Watermark */}
      <div className="absolute top-3 right-4 text-xs font-mono text-white/15 select-none tracking-widest">
        $CHUM HABITAT
      </div>

      {/* CHUM Character */}
      <ChumCharacter mood={mood} healthPercent={healthPercent} />
    </div>
  );
}
