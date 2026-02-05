import { useState, useEffect, useRef, useCallback } from 'react';
import PlanktonRig from './PlanktonRig';
import type { Mood } from '../hooks/useChum';

/**
 * Ground-walking Plankton. Walks left/right along the tank floor,
 * pauses to idle, then walks again. Real walk cycle — no floating.
 */

// Walk speed per mood (pixels per frame at 60fps)
const MOOD_WALK: Record<Mood, {
  walkSpeed: number;     // px per frame
  walkStepRate: number;  // walk cycle speed (radians per frame)
  pauseMin: number;      // min pause frames
  pauseMax: number;      // max pause frames
  walkMin: number;       // min walk frames
  walkMax: number;       // max walk frames
}> = {
  thriving:    { walkSpeed: 1.2,  walkStepRate: 0.15, pauseMin: 60,  pauseMax: 180, walkMin: 120, walkMax: 400 },
  comfortable: { walkSpeed: 0.8,  walkStepRate: 0.12, pauseMin: 90,  pauseMax: 240, walkMin: 100, walkMax: 350 },
  worried:     { walkSpeed: 0.5,  walkStepRate: 0.10, pauseMin: 120, pauseMax: 300, walkMin: 80,  walkMax: 250 },
  desperate:   { walkSpeed: 0.3,  walkStepRate: 0.07, pauseMin: 180, pauseMax: 400, walkMin: 60,  walkMax: 150 },
  dying:       { walkSpeed: 0.08, walkStepRate: 0.03, pauseMin: 300, pauseMax: 600, walkMin: 30,  walkMax: 80 },
};

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  drift: number;
}

interface ChumCharacterProps {
  mood: Mood;
  healthPercent: number;
}

export default function ChumCharacter({ mood, healthPercent }: ChumCharacterProps) {
  // Position: x is percentage across tank, y is fixed (ground level)
  const [x, setX] = useState(50);
  const [facingRight, setFacingRight] = useState(true);
  const [walkPhase, setWalkPhase] = useState(0);
  const [isWalking, setIsWalking] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  const animRef = useRef<number>(0);
  const stateRef = useRef<'walking' | 'idle'>('idle');
  const stateTimerRef = useRef(120); // frames until state change
  const dirRef = useRef(1); // 1 = right, -1 = left
  const frameRef = useRef(0);
  const bubbleIdRef = useRef(0);

  const animate = useCallback(() => {
    frameRef.current++;
    const config = MOOD_WALK[mood];

    // State machine: walk <-> idle
    stateTimerRef.current--;

    if (stateTimerRef.current <= 0) {
      if (stateRef.current === 'idle') {
        // Start walking
        stateRef.current = 'walking';
        stateTimerRef.current = config.walkMin + Math.random() * (config.walkMax - config.walkMin);
        // Maybe change direction
        if (Math.random() > 0.6) {
          dirRef.current *= -1;
          setFacingRight(dirRef.current > 0);
        }
        setIsWalking(true);
      } else {
        // Start idling
        stateRef.current = 'idle';
        stateTimerRef.current = config.pauseMin + Math.random() * (config.pauseMax - config.pauseMin);
        setIsWalking(false);
        setWalkPhase(0);
      }
    }

    // Walking movement
    if (stateRef.current === 'walking') {
      // Advance walk cycle phase
      setWalkPhase(prev => prev + config.walkStepRate);

      // Move horizontally
      setX(prev => {
        const next = prev + dirRef.current * config.walkSpeed;
        // Hit wall — turn around
        if (next >= 82) {
          dirRef.current = -1;
          setFacingRight(false);
          return 82;
        }
        if (next <= 18) {
          dirRef.current = 1;
          setFacingRight(true);
          return 18;
        }
        return next;
      });
    }

    // Occasional bubble from character
    const bubbleChance = stateRef.current === 'walking' ? 0.03 : 0.01;
    if (Math.random() < bubbleChance) {
      setBubbles(prev => [
        ...prev.slice(-8),
        {
          id: bubbleIdRef.current++,
          x: (Math.random() - 0.5) * 20,
          y: 0,
          size: Math.random() * 5 + 2,
          opacity: 0.5,
          speed: Math.random() * 0.8 + 0.4,
          drift: (Math.random() - 0.5) * 0.3,
        },
      ]);
    }

    // Update bubbles
    setBubbles(prev =>
      prev
        .map(b => ({
          ...b,
          y: b.y - b.speed,
          x: b.x + b.drift + Math.sin(b.id + frameRef.current * 0.03) * 0.15,
          opacity: b.opacity - 0.005,
        }))
        .filter(b => b.opacity > 0)
    );

    animRef.current = requestAnimationFrame(animate);
  }, [mood]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  // Ground Y position — character feet on the sandy floor
  const groundY = 88;
  // Character size
  const charSize = 110;

  return (
    <>
      {/* Bubble trail */}
      {bubbles.map(b => (
        <div
          key={b.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `calc(${x}% + ${b.x}px)`,
            top: `calc(${groundY - 15}% + ${b.y}px)`,
            width: b.size,
            height: b.size,
            background: 'radial-gradient(circle at 30% 30%, rgba(150,230,200,0.4), rgba(100,200,170,0.1))',
            border: '1px solid rgba(150,230,200,0.2)',
            opacity: b.opacity,
            zIndex: 4,
          }}
        />
      ))}

      {/* Shadow on ground */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${x}%`,
          top: `${groundY + 2}%`,
          transform: 'translate(-50%, 0)',
          width: charSize * 0.6,
          height: 8,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.25)',
          filter: 'blur(3px)',
          zIndex: 3,
        }}
      />

      {/* Character on ground */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${x}%`,
          top: `${groundY}%`,
          transform: 'translate(-50%, -100%)',
          zIndex: 5,
        }}
      >
        {/* Health glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: charSize * 2,
            height: charSize * 2,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: healthPercent > 50
              ? `radial-gradient(circle, rgba(74,222,128,${healthPercent / 400}) 0%, transparent 70%)`
              : healthPercent > 20
              ? `radial-gradient(circle, rgba(245,158,11,${healthPercent / 400}) 0%, transparent 70%)`
              : `radial-gradient(circle, rgba(239,68,68,${Math.max(0.05, healthPercent / 400)}) 0%, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        <PlanktonRig
          mood={mood}
          healthPercent={healthPercent}
          size={charSize}
          walkPhase={walkPhase}
          isWalking={isWalking}
          isMoving={isWalking}
          facingDirection={facingRight ? 'right' : 'left'}
        />
      </div>
    </>
  );
}
