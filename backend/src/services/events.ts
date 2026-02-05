import { EventEmitter } from 'events';

export type EventType = 'DONATION' | 'VILLAIN_CREATED' | 'QUIET' | 'PERIODIC';

export interface DonationEvent {
  type: 'DONATION';
  timestamp: number;
  amount: number;
  sender: string;
  signature?: string;
}

export interface VillainCreatedEvent {
  type: 'VILLAIN_CREATED';
  timestamp: number;
  walletAddress: string;
  donationAmount: number;
  villainId: number;
  imageUrl: string;
}

export interface QuietEvent {
  type: 'QUIET';
  timestamp: number;
  minutesSinceLastEvent: number;
}

export interface PeriodicEvent {
  type: 'PERIODIC';
  timestamp: number;
}

export type ChumEvent = DonationEvent | VillainCreatedEvent | QuietEvent | PeriodicEvent;

class ChumEventEmitter extends EventEmitter {
  private thoughtTimestamps: number[] = [];
  private lastEventTime: number = Date.now();

  private static readonly MAX_THOUGHTS_PER_MIN = 20;
  private static readonly MIN_GAP_MS = 3000;

  canEmitThought(): boolean {
    const now = Date.now();

    // Enforce minimum 3s gap
    const last = this.thoughtTimestamps[this.thoughtTimestamps.length - 1];
    if (last && now - last < ChumEventEmitter.MIN_GAP_MS) {
      return false;
    }

    // Enforce max 20/min
    const oneMinAgo = now - 60_000;
    const recentCount = this.thoughtTimestamps.filter((t) => t > oneMinAgo).length;
    return recentCount < ChumEventEmitter.MAX_THOUGHTS_PER_MIN;
  }

  recordThought(): void {
    const now = Date.now();
    this.thoughtTimestamps.push(now);
    // Keep only last 60s of timestamps
    const oneMinAgo = now - 60_000;
    this.thoughtTimestamps = this.thoughtTimestamps.filter((t) => t > oneMinAgo);
  }

  emitEvent(event: ChumEvent): void {
    this.lastEventTime = Date.now();
    this.emit('event', event);
    console.log(`[EVENT] ${event.type} emitted`);
  }

  getLastEventTime(): number {
    return this.lastEventTime;
  }
}

export const eventBus = new ChumEventEmitter();
