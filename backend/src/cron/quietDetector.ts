import { eventBus } from '../services/events';

const CHECK_INTERVAL_MS = 4 * 60 * 1000;    // 4 minutes
const QUIET_THRESHOLD_MS = 8 * 60 * 1000;    // 8 minutes
const POST_QUIET_MIN_MS = 5 * 60 * 1000;     // 5 minutes
const POST_QUIET_MAX_MS = 10 * 60 * 1000;    // 10 minutes

let timer: ReturnType<typeof setTimeout> | null = null;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function scheduleCheck(delayMs: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(checkQuiet, delayMs);
  const mins = (delayMs / 60_000).toFixed(1);
  console.log(`[QUIET] Next check in ${mins} min`);
}

function checkQuiet(): void {
  const elapsed = Date.now() - eventBus.getLastEventTime();

  if (elapsed >= QUIET_THRESHOLD_MS) {
    const minutesSince = Math.floor(elapsed / 60_000);
    console.log(`[QUIET] ${minutesSince} min since last event, emitting QUIET`);

    eventBus.emitEvent({
      type: 'QUIET',
      timestamp: Date.now(),
      minutesSinceLastEvent: minutesSince,
    });

    // After emitting, wait longer before next check
    scheduleCheck(randomBetween(POST_QUIET_MIN_MS, POST_QUIET_MAX_MS));
  } else {
    // Activity was recent, check again in 5 min
    scheduleCheck(CHECK_INTERVAL_MS);
  }
}

export function startQuietDetector(): void {
  console.log('[QUIET] Detector started');

  // First periodic thought after 30s (like old thoughtLoop)
  setTimeout(() => {
    eventBus.emitEvent({
      type: 'PERIODIC',
      timestamp: Date.now(),
    });
  }, 30_000);

  // Start quiet detection after 5 minutes
  scheduleCheck(CHECK_INTERVAL_MS);
}
