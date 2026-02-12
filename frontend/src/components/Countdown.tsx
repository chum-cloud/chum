import { useState, useEffect } from 'react';

export default function Countdown({ targetTime }: { targetTime: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.max(0, Math.floor((targetTime - now) / 1000));
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="font-mono text-3xl text-chum-text tracking-widest text-center">
      {pad(h)}:{pad(m)}:{pad(s)}
    </div>
  );
}
