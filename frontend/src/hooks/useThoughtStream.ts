import { useState, useEffect, useRef, useCallback } from 'react';

export interface StreamedThought {
  id: number;
  content: string;
  mood: string;
  trigger: string | null;
  tweeted: boolean;
  created_at: string;
}

export function useThoughtStream() {
  const [thoughts, setThoughts] = useState<StreamedThought[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    const base = import.meta.env.VITE_API_URL || '';
    const es = new EventSource(`${base}/api/stream`);
    esRef.current = es;

    es.addEventListener('initial', (e) => {
      try {
        const data = JSON.parse(e.data) as StreamedThought[];
        setThoughts(data);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('thought', (e) => {
      try {
        const thought = JSON.parse(e.data) as StreamedThought;
        setThoughts((prev) => {
          // Dedupe by id
          if (prev.some((t) => t.id === thought.id)) return prev;
          // Prepend and cap at 20
          return [thought, ...prev].slice(0, 20);
        });
      } catch {
        // ignore parse errors
      }
    });

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      esRef.current = null;
      // Reconnect after 5s
      reconnectTimer.current = setTimeout(connect, 5000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return { thoughts, isConnected };
}
