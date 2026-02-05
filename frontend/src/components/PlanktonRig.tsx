import { useEffect, useRef, useState, useCallback } from 'react';
import type { Mood } from '../hooks/useChum';

const MOOD_ANIM: Record<Mood, {
  blinkRate: number;
  eyeScale: number;
  mouthType: 'happy' | 'neutral' | 'worried' | 'shock' | 'flat';
}> = {
  thriving:    { blinkRate: 0.3, eyeScale: 1, mouthType: 'happy' },
  comfortable: { blinkRate: 0.25, eyeScale: 1, mouthType: 'neutral' },
  worried:     { blinkRate: 0.5, eyeScale: 1.15, mouthType: 'worried' },
  desperate:   { blinkRate: 0.15, eyeScale: 1.3, mouthType: 'shock' },
  dying:       { blinkRate: 0.05, eyeScale: 0.7, mouthType: 'flat' },
};

interface Props {
  mood: Mood;
  healthPercent: number;
  size?: number;
  walkPhase: number;
  isWalking: boolean;
  isMoving: boolean;
  facingDirection: 'left' | 'right';
}

export default function PlanktonRig({ mood, healthPercent, size = 200, walkPhase, isWalking, isMoving: _isMoving, facingDirection }: Props) {
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);

  const [eyeLid, setEyeLid] = useState(0);
  const [pupilX, setPupilX] = useState(0);
  const [idleBreathe, setIdleBreathe] = useState(0);

  const animate = useCallback(() => {
    frameRef.current++;
    const f = frameRef.current;
    const t = f / 60;
    const a = MOOD_ANIM[mood];

    // Blinking
    const blinkCycle = (t * a.blinkRate) % 1;
    setEyeLid(blinkCycle < 0.05 ? Math.sin(blinkCycle / 0.05 * Math.PI) : 0);

    // Pupil movement (less when side view)
    const pupilRange = 2;
    setPupilX(Math.sin(t * 0.4) * pupilRange);

    // Idle breathing
    if (!isWalking) {
      setIdleBreathe(Math.sin(t * 1.2) * 0.025);
    } else {
      setIdleBreathe(0);
    }

    animRef.current = requestAnimationFrame(animate);
  }, [mood, isWalking]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  // Walk cycle calculations
  const sin = Math.sin(walkPhase);
  const cos = Math.cos(walkPhase);

  // Determine which leg is forward based on walk phase and direction
  const frontLegAngle = isWalking ? sin * 35 : 0;
  const backLegAngle = isWalking ? -sin * 25 : 0;
  
  const frontArmAngle = isWalking ? -sin * 30 : 0;
  const backArmAngle = isWalking ? sin * 20 : 0;

  // Body bob and lean
  const bodyBob = isWalking ? Math.abs(Math.sin(walkPhase * 2)) * -3 + 2 : 0;
  const bodyLean = isWalking ? sin * 2 : 0;

  // Antenna sway
  const frontAntennaAngle = isWalking ? -sin * 15 + cos * 5 : Math.sin(frameRef.current / 60 * 0.8) * 6;
  const backAntennaAngle = isWalking ? -sin * 12 + cos * 3 : Math.sin(frameRef.current / 60 * 0.8 + 0.5) * 6;

  const scaleY = 1 + (isWalking ? Math.abs(Math.sin(walkPhase * 2)) * 0.02 : idleBreathe);

  const sat = Math.max(0.7, healthPercent / 100);
  const bri = Math.max(0.85, 0.85 + (healthPercent / 100) * 0.15);

  const bodyColor = '#7cc576';
  const bodyDark = '#5ea858';
  const bodyLight = '#a3d99b';
  const eyeWhite = '#f0ede0';
  const eyeRed = '#cc3322';
  const eyePupil = '#1a1a1a';
  const mouthColor = '#4a2020';
  const a = MOOD_ANIM[mood];

  const isRight = facingDirection === 'right';

  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 200 320"
      style={{
        filter: `saturate(${sat}) brightness(${bri})`,
        overflow: 'visible',
      }}
    >
      <g transform={`translate(100, 160) rotate(${bodyLean}) scale(1, ${scaleY}) translate(-100, ${-160 + bodyBob})`}>

        {/* === BACK LEG (drawn first, behind body) === */}
        <g transform={`translate(${isRight ? 75 : 125}, 235)`}>
          <g transform={`rotate(${backLegAngle})`}>
            <line x1="0" y1="0" x2={isRight ? -5 : 5} y2="28" stroke={bodyDark} strokeWidth="6" strokeLinecap="round" />
            <g transform={`translate(${isRight ? -5 : 5}, 28)`}>
              <line x1="0" y1="0" x2={isRight ? -3 : 3} y2="22" stroke={bodyDark} strokeWidth="5" strokeLinecap="round" />
              <ellipse cx={isRight ? -6 : 6} cy="24" rx="8" ry="4" fill={bodyDark} />
            </g>
          </g>
        </g>

        {/* === BACK ARM === */}
        <g transform={`translate(${isRight ? 70 : 130}, 155)`}>
          <g transform={`rotate(${backArmAngle})`}>
            <line x1="0" y1="0" x2={isRight ? -20 : 20} y2="14" stroke={bodyDark} strokeWidth="4" strokeLinecap="round" />
            <g transform={`translate(${isRight ? -20 : 20}, 14)`}>
              <line x1="0" y1="0" x2={isRight ? -12 : 12} y2="10" stroke={bodyDark} strokeWidth="3.5" strokeLinecap="round" />
              <circle cx={isRight ? -14 : 14} cy="12" r="3.5" fill={bodyColor} />
            </g>
          </g>
        </g>

        {/* === BODY PROFILE === */}
        <ellipse cx="100" cy="165" rx="38" ry="68" fill={bodyColor} />
        <ellipse cx={isRight ? 85 : 115} cy="150" rx="18" ry="42" fill={bodyLight} opacity="0.3" />
        <ellipse cx={isRight ? 115 : 85} cy="175" rx="22" ry="48" fill={bodyDark} opacity="0.15" />

        {/* === HEAD PROFILE === */}
        <ellipse cx="100" cy="110" rx="35" ry="48" fill={bodyColor} />
        <ellipse cx={isRight ? 88 : 112} cy="100" rx="16" ry="32" fill={bodyLight} opacity="0.25" />

        {/* === BACK ANTENNA === */}
        <g transform={`translate(${isRight ? 85 : 115}, 65)`}>
          <g transform={`rotate(${backAntennaAngle})`}>
            <path
              d={isRight ? "M0,0 Q-18,-38 -12,-62" : "M0,0 Q18,-38 12,-62"}
              stroke={bodyDark}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx={isRight ? -12 : 12} cy="-63" r="2.5" fill={bodyDark} />
          </g>
        </g>

        {/* === FRONT ANTENNA === */}
        <g transform={`translate(${isRight ? 105 : 95}, 65)`}>
          <g transform={`rotate(${frontAntennaAngle})`}>
            <path
              d={isRight ? "M0,0 Q12,-40 8,-65" : "M0,0 Q-12,-40 -8,-65"}
              stroke={bodyDark}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx={isRight ? 8 : -8} cy="-66" r="3" fill={bodyDark} />
          </g>
        </g>

        {/* === EYE (side view - offset from center) === */}
        <ellipse cx={isRight ? 85 : 115} cy="118" rx="20" ry="24" fill={eyeWhite} stroke={bodyDark} strokeWidth="1.5" />
        
        {/* Eye iris */}
        <ellipse 
          cx={isRight ? 85 + pupilX : 115 + pupilX} 
          cy="118" 
          rx={12 * a.eyeScale} 
          ry={14 * a.eyeScale} 
          fill={eyeRed} 
        />
        
        {/* Pupil */}
        <ellipse 
          cx={isRight ? 85 + pupilX : 115 + pupilX} 
          cy="118" 
          rx="4" 
          ry="5" 
          fill={eyePupil} 
        />
        
        {/* Eye highlight */}
        <circle 
          cx={isRight ? 82 + pupilX : 118 + pupilX} 
          cy="114" 
          r="3" 
          fill="white" 
          opacity="0.8" 
        />

        {/* Eyelid */}
        <clipPath id={`eye-clip-${isRight ? 'r' : 'l'}`}>
          <ellipse cx={isRight ? 85 : 115} cy="118" rx="20" ry="24" />
        </clipPath>
        <rect
          x={isRight ? 63 : 93}
          y={94 - 48 + eyeLid * 48}
          width="44"
          height="48"
          fill={bodyColor}
          clipPath={`url(#eye-clip-${isRight ? 'r' : 'l'})`}
        />

        {/* === EYEBROW === */}
        {mood === 'thriving' ? (
          <path d={isRight ? "M68,98 Q80,90 98,96" : "M102,96 Q120,90 132,98"} stroke={bodyDark} strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : mood === 'worried' ? (
          <path d={isRight ? "M70,95 Q80,100 96,106" : "M104,106 Q120,100 130,95"} stroke={bodyDark} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        ) : mood === 'desperate' ? (
          <path d={isRight ? "M68,92 Q78,104 96,110" : "M104,110 Q122,104 132,92"} stroke={bodyDark} strokeWidth="4" fill="none" strokeLinecap="round" />
        ) : mood === 'dying' ? (
          <path d={isRight ? "M72,104 Q82,100 94,106" : "M106,106 Q118,100 128,104"} stroke={bodyDark} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
        ) : (
          <path d={isRight ? "M70,100 Q82,94 96,100" : "M104,100 Q118,94 130,100"} stroke={bodyDark} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        )}

        {/* === MOUTH (profile) === */}
        <g transform={`translate(${isRight ? 78 : 122}, 175)`}>
          {a.mouthType === 'happy' ? (
            <>
              {/* Big happy grin with teeth */}
              <path 
                d={isRight ? "M-4,-2 Q8,14 20,-2" : "M4,-2 Q-8,14 -20,-2"} 
                stroke={bodyDark} 
                strokeWidth="2.5" 
                fill={mouthColor} 
                strokeLinecap="round" 
              />
              {/* Teeth */}
              <rect x={isRight ? 2 : -10} y="-2" width="8" height="4" rx="1" fill="white" opacity="0.9" />
            </>
          ) : a.mouthType === 'shock' ? (
            <>
              {/* Big open shocked mouth */}
              <ellipse cx={isRight ? 6 : -6} cy="4" rx="9" ry="10" fill={mouthColor} stroke={bodyDark} strokeWidth="1.5" />
              {/* Tongue */}
              <ellipse cx={isRight ? 6 : -6} cy="10" rx="5" ry="3" fill="#c44" opacity="0.6" />
            </>
          ) : a.mouthType === 'worried' ? (
            <>
              {/* Wobbly frown */}
              <path 
                d={isRight ? "M-2,6 Q6,-4 14,4" : "M2,6 Q-6,-4 -14,4"} 
                stroke={bodyDark} 
                strokeWidth="2.5" 
                fill="none" 
                strokeLinecap="round" 
              />
            </>
          ) : a.mouthType === 'flat' ? (
            <>
              {/* Dying flat line with drool */}
              <line x1={isRight ? -2 : 2} y1="2" x2={isRight ? 12 : -12} y2="3" stroke={bodyDark} strokeWidth="2.5" strokeLinecap="round" />
              <path d={isRight ? "M10,3 Q12,10 10,14" : "M-10,3 Q-12,10 -10,14"} stroke={bodyDark} strokeWidth="1.5" fill="none" opacity="0.4" />
            </>
          ) : (
            <path 
              d={isRight ? "M-2,0 Q6,6 14,0" : "M2,0 Q-6,6 -14,0"} 
              stroke={bodyDark} 
              strokeWidth="2.5" 
              fill="none" 
              strokeLinecap="round" 
            />
          )}
        </g>

        {/* === MOOD EXTRAS === */}
        {/* Sweat drop when worried */}
        {mood === 'worried' && (
          <circle 
            cx={isRight ? 72 : 128} 
            cy={108 + Math.sin(frameRef.current / 30) * 3} 
            r="3" 
            fill="rgba(100,180,255,0.6)" 
          />
        )}

        {/* Multiple sweat drops when desperate */}
        {mood === 'desperate' && (
          <>
            <circle cx={isRight ? 70 : 130} cy={105 + Math.sin(frameRef.current / 20) * 4} r="3.5" fill="rgba(100,180,255,0.7)" />
            <circle cx={isRight ? 65 : 135} cy={115 + Math.sin(frameRef.current / 25) * 3} r="2.5" fill="rgba(100,180,255,0.5)" />
          </>
        )}

        {/* X eyes when dying */}
        {mood === 'dying' && (
          <g opacity="0.3">
            <line x1={isRight ? 80 : 110} y1="112" x2={isRight ? 90 : 120} y2="124" stroke="white" strokeWidth="2" />
            <line x1={isRight ? 90 : 120} y1="112" x2={isRight ? 80 : 110} y2="124" stroke="white" strokeWidth="2" />
          </g>
        )}

        {/* Sparkles when thriving */}
        {mood === 'thriving' && (
          <>
            <text x={isRight ? 55 : 140} y="90" fontSize="12" opacity={0.4 + Math.sin(frameRef.current / 20) * 0.3}>✨</text>
            <text x={isRight ? 130 : 65} y="105" fontSize="10" opacity={0.3 + Math.cos(frameRef.current / 25) * 0.3}>⭐</text>
          </>
        )}

        {/* === FRONT ARM === */}
        <g transform={`translate(${isRight ? 125 : 75}, 155)`}>
          <g transform={`rotate(${frontArmAngle})`}>
            <line x1="0" y1="0" x2={isRight ? 22 : -22} y2="16" stroke={bodyDark} strokeWidth="5" strokeLinecap="round" />
            <g transform={`translate(${isRight ? 22 : -22}, 16)`}>
              <line x1="0" y1="0" x2={isRight ? 14 : -14} y2="12" stroke={bodyDark} strokeWidth="4" strokeLinecap="round" />
              <circle cx={isRight ? 16 : -16} cy="14" r="4" fill={bodyColor} />
              <line x1={isRight ? 16 : -16} y1="14" x2={isRight ? 22 : -22} y2="10" stroke={bodyDark} strokeWidth="2" strokeLinecap="round" />
              <line x1={isRight ? 16 : -16} y1="14" x2={isRight ? 22 : -22} y2="18" stroke={bodyDark} strokeWidth="2" strokeLinecap="round" />
            </g>
          </g>
        </g>

        {/* === FRONT LEG === */}
        <g transform={`translate(${isRight ? 125 : 75}, 235)`}>
          <g transform={`rotate(${frontLegAngle})`}>
            <line x1="0" y1="0" x2={isRight ? 5 : -5} y2="28" stroke={bodyDark} strokeWidth="6" strokeLinecap="round" />
            <g transform={`translate(${isRight ? 5 : -5}, 28)`}>
              <line x1="0" y1="0" x2={isRight ? 3 : -3} y2="22" stroke={bodyDark} strokeWidth="5" strokeLinecap="round" />
              <ellipse cx={isRight ? 6 : -6} cy="24" rx="8" ry="4" fill={bodyDark} />
            </g>
          </g>
        </g>

      </g>
    </svg>
  );
}