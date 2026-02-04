export type AnimationName =
  | 'running-8-frames'
  | 'walking-8-frames'
  | 'sad-walk'
  | 'breathing-idle'
  | 'falling-back-death'
  | 'backflip'
  | 'drinking'
  | 'flying-kick';

export type Direction = 'east' | 'west' | 'north' | 'south' | 'north-east' | 'north-west' | 'south-east' | 'south-west';

export const SPRITE_SIZE = 48;

export const ANIMATION_FRAMES: Record<AnimationName, number> = {
  'running-8-frames': 8,
  'walking-8-frames': 8,
  'sad-walk': 8,
  'breathing-idle': 4,
  'falling-back-death': 7,
  'backflip': 10,
  'drinking': 6,
  'flying-kick': 6,
};

const ANIMATION_DIRECTIONS: Record<AnimationName, Direction[]> = {
  'running-8-frames': ['east', 'west', 'north', 'south', 'north-east', 'north-west', 'south-east', 'south-west'],
  'walking-8-frames': ['east', 'west', 'north', 'south', 'north-east', 'north-west', 'south-east', 'south-west'],
  'sad-walk': ['east', 'west', 'north', 'south', 'north-east', 'north-west', 'south-east', 'south-west'],
  'breathing-idle': ['east', 'west', 'north', 'south', 'north-east', 'north-west', 'south-east', 'south-west'],
  'falling-back-death': ['east', 'west', 'south'],
  'backflip': ['east', 'west'],
  'drinking': ['south'],
  'flying-kick': ['east', 'west', 'south'],
};

export function getFramePath(animation: AnimationName, direction: Direction, frame: number): string {
  const paddedFrame = String(frame).padStart(3, '0');
  return `/sprites/animations/${animation}/${direction}/frame_${paddedFrame}.png`;
}

export function getStaticRotation(direction: Direction): string {
  return `/sprites/rotations/${direction}.png`;
}

export function hasDirection(animation: AnimationName, direction: Direction): boolean {
  return ANIMATION_DIRECTIONS[animation]?.includes(direction) ?? false;
}

export function getBestDirection(animation: AnimationName, desired: Direction): Direction {
  if (hasDirection(animation, desired)) return desired;
  if (desired === 'east' && hasDirection(animation, 'south-east')) return 'south-east';
  if (desired === 'west' && hasDirection(animation, 'south-west')) return 'south-west';
  return ANIMATION_DIRECTIONS[animation][0];
}

const imageCache = new Map<string, HTMLImageElement>();

export function preloadAnimation(animation: AnimationName, direction: Direction): void {
  const frames = ANIMATION_FRAMES[animation];
  for (let i = 0; i < frames; i++) {
    const path = getFramePath(animation, direction, i);
    if (!imageCache.has(path)) {
      const img = new Image();
      img.src = path;
      imageCache.set(path, img);
    }
  }
}

export function preloadAllUsedAnimations(): void {
  const usedCombos: [AnimationName, Direction][] = [
    ['running-8-frames', 'east'],
    ['running-8-frames', 'west'],
    ['walking-8-frames', 'east'],
    ['walking-8-frames', 'west'],
    ['sad-walk', 'east'],
    ['sad-walk', 'west'],
    ['breathing-idle', 'east'],
    ['breathing-idle', 'west'],
    ['falling-back-death', 'east'],
    ['falling-back-death', 'west'],
    ['backflip', 'east'],
    ['backflip', 'west'],
  ];
  for (const [anim, dir] of usedCombos) {
    preloadAnimation(anim, dir);
  }
}
