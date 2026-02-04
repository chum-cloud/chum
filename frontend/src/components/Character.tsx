import { SPRITE_SIZE } from '../lib/sprites';

interface CharacterProps {
  frameSrc: string;
  x: number;
}

const SCALE = 3;

export default function Character({ frameSrc, x }: CharacterProps) {
  return (
    <div
      className="absolute bottom-6 transition-[left] duration-100 ease-linear"
      style={{
        left: `${x}%`,
        transform: 'translateX(-50%)',
      }}
    >
      <img
        src={frameSrc}
        alt="CHUM"
        width={SPRITE_SIZE * SCALE}
        height={SPRITE_SIZE * SCALE}
        className="image-rendering-pixelated"
        draggable={false}
        style={{
          imageRendering: 'pixelated',
          animation: 'glow-pulse 2s ease-in-out infinite',
        }}
      />
    </div>
  );
}
