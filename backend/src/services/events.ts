import { EventEmitter } from 'events';

export type EventType =
  | 'DONATION'
  | 'VILLAIN_CREATED'
  | 'QUIET'
  | 'PERIODIC'
  | 'PRICE_PUMP'
  | 'PRICE_DUMP'
  | 'VOLUME_SPIKE';

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

export interface PricePumpEvent {
  type: 'PRICE_PUMP';
  timestamp: number;
  price: number;
  change1h: number;
  change6h: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

export interface PriceDumpEvent {
  type: 'PRICE_DUMP';
  timestamp: number;
  price: number;
  change1h: number;
  change6h: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
}

export interface VolumeSpikeEvent {
  type: 'VOLUME_SPIKE';
  timestamp: number;
  volume1h: number;
  volume6h: number;
  volume24h: number;
  volumeMultiplier: number;
  price: number;
  marketCap: number;
}

export type ChumEvent =
  | DonationEvent
  | VillainCreatedEvent
  | QuietEvent
  | PeriodicEvent
  | PricePumpEvent
  | PriceDumpEvent
  | VolumeSpikeEvent;

// Daily tweet tracking
interface TweetTracker {
  date: string;
  count: number;
}

class ChumEventEmitter extends EventEmitter {
  private thoughtTimestamps: number[] = [];
  private lastEventTime: number = Date.now();
  private tweetTracker: TweetTracker = { date: '', count: 0 };

  private static readonly MAX_THOUGHTS_PER_MIN = 20;
  private static readonly MIN_GAP_MS = 3000;
  private static readonly MAX_TWEETS_PER_DAY = 15;

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

  /**
   * Check if we can tweet today (respects daily limit)
   */
  canTweetToday(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (this.tweetTracker.date !== today) {
      // New day, reset counter
      this.tweetTracker = { date: today, count: 0 };
    }
    return this.tweetTracker.count < ChumEventEmitter.MAX_TWEETS_PER_DAY;
  }

  /**
   * Record a tweet was sent
   */
  recordTweet(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.tweetTracker.date !== today) {
      this.tweetTracker = { date: today, count: 1 };
    } else {
      this.tweetTracker.count++;
    }
    console.log(`[EVENT] Tweet recorded (${this.tweetTracker.count}/${ChumEventEmitter.MAX_TWEETS_PER_DAY} today)`);
  }

  /**
   * Get today's tweet count
   */
  getTweetCount(): number {
    const today = new Date().toISOString().slice(0, 10);
    if (this.tweetTracker.date !== today) {
      return 0;
    }
    return this.tweetTracker.count;
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
