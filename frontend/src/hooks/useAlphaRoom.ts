import { useState, useEffect, useCallback } from 'react';
import type { RoomMessage, RoomStats, RoomResponse } from '../lib/protocol';
import { getMockMessages, getMockStats } from '../lib/mockRoomData';

const API = import.meta.env.VITE_API_URL || '';
const POLL_INTERVAL = 30_000;

export function useAlphaRoom() {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cloud/room?limit=50`);
      if (!res.ok) throw new Error('fetch failed');
      const data: RoomResponse = await res.json();

      if (data.success && data.messages.length > 0) {
        setMessages(data.messages);
        setStats(data.stats);
        setIsLive(true);
      } else {
        // No live data — use mock
        setMessages(getMockMessages());
        setStats(getMockStats());
        setIsLive(false);
      }
    } catch {
      // Backend unavailable — use mock
      setMessages(getMockMessages());
      setStats(getMockStats());
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoom();
    const interval = setInterval(fetchRoom, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRoom]);

  return { messages, stats, loading, isLive };
}
