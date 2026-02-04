import { useRef, useMemo } from 'react';
import Character from './Character';
import DialogueBox from './DialogueBox';
import { useAnimation } from '../hooks/useAnimation';
import type { AnimationState, Mood } from '../hooks/useChum';

interface BubbleProps {
  left: number;
  size: number;
  delay: number;
  duration: number;
}

function Bubble({ left, size, delay, duration }: BubbleProps) {
  return (
    <div
      className="absolute rounded-full opacity-40"
      style={{
        left: `${left}%`,
        bottom: '15%',
        width: size,
        height: size,
        background: 'radial-gradient(circle at 30% 30%, rgba(120,220,180,0.35), rgba(80,200,150,0.08))',
        border: '1px solid rgba(120,220,180,0.2)',
        animation: `bubble-rise ${duration}s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

interface TankProps {
  animationState: AnimationState;
  mood: Mood;
  latestThought: string | null;
}

export default function Tank({ animationState, mood, latestThought }: TankProps) {
  const tankRef = useRef<HTMLDivElement>(null);
  const { frameSrc, x } = useAnimation(animationState, 800);

  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: Math.random() * 90 + 5,
        size: Math.random() * 8 + 3,
        delay: Math.random() * 6,
        duration: Math.random() * 4 + 5,
      })),
    [],
  );

  return (
    <div
      ref={tankRef}
      className="relative w-full overflow-hidden rounded-xl border border-chum-border"
      style={{ height: 480 }}
    >
      {/* Painted background image */}
      <img
        src="/sprites/environment/tank-bg.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover select-none"
        draggable={false}
      />

      {/* Slight darkening overlay for contrast with UI */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.2) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 vignette" />

      {/* Bubbles */}
      {bubbles.map((b) => (
        <Bubble key={b.id} left={b.left} size={b.size} delay={b.delay} duration={b.duration} />
      ))}

      {/* Watermark */}
      <div className="absolute top-3 right-4 text-xs font-mono text-white/20 select-none tracking-widest">
        $CHUM HABITAT
      </div>

      {/* Character — walks on the seafloor (~30% from bottom of bg) */}
      <div style={{ position: 'absolute', inset: 0, bottom: 120 }}>
        <Character frameSrc={frameSrc} x={x} />
      </div>

      {/* Dialogue Box */}
      <DialogueBox mood={mood} latestThought={latestThought} />
    </div>
  );
}
