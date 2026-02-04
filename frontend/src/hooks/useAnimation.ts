import { useState, useEffect, useRef, useCallback } from 'react';
import { type AnimationName, type Direction, ANIMATION_FRAMES, getFramePath, getBestDirection } from '../lib/sprites';
import type { AnimationState } from './useChum';

const ANIMATION_MAP: Record<AnimationState, AnimationName> = {
  running: 'running-8-frames',
  'sad-walk': 'sad-walk',
  idle: 'breathing-idle',
  death: 'falling-back-death',
  celebrate: 'backflip',
};

const FPS = 10;
const FRAME_DURATION = 1000 / FPS;

interface AnimationResult {
  frameSrc: string;
  direction: Direction;
  x: number;
}

export function useAnimation(
  animationState: AnimationState,
  tankWidth: number,
): AnimationResult {
  const [frame, setFrame] = useState(0);
  const [direction, setDirection] = useState<Direction>('east');
  const [x, setX] = useState(50);
  const lastFrameTime = useRef(0);
  const animRef = useRef<number>(0);
  const prevAnimState = useRef(animationState);

  // Reset frame when animation changes
  useEffect(() => {
    if (prevAnimState.current !== animationState) {
      setFrame(0);
      prevAnimState.current = animationState;
    }
  }, [animationState]);

  const animate = useCallback(
    (timestamp: number) => {
      if (timestamp - lastFrameTime.current >= FRAME_DURATION) {
        lastFrameTime.current = timestamp;

        const animName = ANIMATION_MAP[animationState];
        const totalFrames = ANIMATION_FRAMES[animName];

        setFrame((prev) => {
          if (animationState === 'death') {
            // Death animation plays once and stops on last frame
            return Math.min(prev + 1, totalFrames - 1);
          }
          if (animationState === 'celebrate') {
            // Celebrate plays once then we let useChum reset it
            return prev + 1 >= totalFrames ? totalFrames - 1 : prev + 1;
          }
          return (prev + 1) % totalFrames;
        });

        // Move character horizontally (not during death/idle)
        if (animationState === 'running' || animationState === 'sad-walk') {
          const speed = animationState === 'sad-walk' ? 0.3 : 0.6;
          setX((prev) => {
            const next = direction === 'east' ? prev + speed : prev - speed;
            if (next >= 85) {
              setDirection('west');
              return 85;
            }
            if (next <= 5) {
              setDirection('east');
              return 5;
            }
            return next;
          });
        }
      }

      animRef.current = requestAnimationFrame(animate);
    },
    [animationState, direction],
  );

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  const animName = ANIMATION_MAP[animationState];
  const bestDir = getBestDirection(animName, direction);
  const clampedFrame = Math.min(frame, ANIMATION_FRAMES[animName] - 1);
  const frameSrc = getFramePath(animName, bestDir, clampedFrame);

  return { frameSrc, direction, x };
}
