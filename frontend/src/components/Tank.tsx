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
        bottom: '25%',
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
}

export default function Tank({ animationState, mood }: TankProps) {
  const tankRef = useRef<HTMLDivElement>(null);
  const { frameSrc, direction, x } = useAnimation(animationState, 800);

  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
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
      style={{ height: 380 }}
    >
      {/* Background: warmer, brighter underwater */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #162a3f 0%, #1a3348 25%, #1d3850 50%, #1a3040 75%, #152535 100%)',
        }}
      />

      {/* Warm lamp glow from top-left */}
      <div
        className="absolute"
        style={{
          top: -40,
          left: '15%',
          width: 300,
          height: 280,
          background: 'radial-gradient(ellipse at center, rgba(255,200,100,0.12) 0%, rgba(255,180,80,0.06) 40%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Secondary warm glow from top-right */}
      <div
        className="absolute"
        style={{
          top: -20,
          right: '10%',
          width: 200,
          height: 200,
          background: 'radial-gradient(ellipse at center, rgba(255,220,140,0.07) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Subtle caustic/light ray effect */}
      <div
        className="absolute inset-0"
        style={{
          background: 'repeating-linear-gradient(105deg, transparent 0%, transparent 45%, rgba(255,255,255,0.015) 47%, transparent 49%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bubbles */}
      {bubbles.map((b) => (
        <Bubble key={b.id} left={b.left} size={b.size} delay={b.delay} duration={b.duration} />
      ))}

      {/* Sandy ground */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: 28,
          background: 'linear-gradient(180deg, rgba(60,75,65,0.3) 0%, rgba(45,55,50,0.6) 50%, rgba(35,45,40,0.8) 100%)',
          borderTop: '1px solid rgba(120,180,140,0.1)',
        }}
      />

      {/* Watermark */}
      <div className="absolute top-3 right-4 text-xs font-mono text-chum-muted opacity-20 select-none tracking-widest">
        $CHUM HABITAT
      </div>

      {/* Character — push up to leave room for dialogue */}
      <div style={{ position: 'absolute', inset: 0, bottom: 90 }}>
        <Character frameSrc={frameSrc} direction={direction as 'east' | 'west'} x={x} />
      </div>

      {/* Dialogue Box */}
      <DialogueBox mood={mood} />
    </div>
  );
}
