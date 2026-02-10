import { useState, useEffect } from 'react';

const API = (import.meta as any).env?.VITE_API_URL || 'https://chum-production.up.railway.app';

export function useFetch<T>(endpoint: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/launch${endpoint}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, deps);

  return { data, loading, error };
}

export function getAPI() {
  return `${API}/api/launch`;
}
