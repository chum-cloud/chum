import { useRef, useMemo } from 'react';
import Character from './Character';
import { useAnimation } from '../hooks/useAnimation';
import type { AnimationState } from '../hooks/useChum';

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
        bottom: '10%',
        width: size,
        height: size,
        background: 'radial-gradient(circle at 30% 30%, rgba(74,222,128,0.3), rgba(74,222,128,0.05))',
        border: '1px solid rgba(74,222,128,0.15)',
        animation: `bubble-rise ${duration}s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

interface TankProps {
  animationState: AnimationState;
}

export default function Tank({ animationState }: TankProps) {
  const tankRef = useRef<HTMLDivElement>(null);
  const { frameSrc, direction, x } = useAnimation(animationState, 800);

  const bubbles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: Math.random() * 90 + 5,
        size: Math.random() * 8 + 4,
        delay: Math.random() * 6,
        duration: Math.random() * 4 + 5,
      })),
    [],
  );

  return (
    <div
      ref={tankRef}
      className="relative w-full overflow-hidden rounded-xl border border-chum-border"
      style={{
        height: 320,
        background: 'linear-gradient(180deg, #0a1628 0%, #071020 60%, #050c18 100%)',
      }}
    >
      {/* Bubbles */}
      {bubbles.map((b) => (
        <Bubble key={b.id} left={b.left} size={b.size} delay={b.delay} duration={b.duration} />
      ))}

      {/* Ground */}
      <div
        className="absolute bottom-0 left-0 right-0 h-6"
        style={{
          background: 'linear-gradient(180deg, rgba(30,37,48,0.4) 0%, rgba(20,25,32,0.8) 100%)',
          borderTop: '1px solid rgba(74,222,128,0.1)',
        }}
      />

      {/* Watermark */}
      <div className="absolute top-3 right-4 text-xs font-mono text-chum-muted opacity-30 select-none tracking-widest">
        $CHUM HABITAT
      </div>

      {/* Character */}
      <Character frameSrc={frameSrc} direction={direction as 'east' | 'west'} x={x} />
    </div>
  );
}
