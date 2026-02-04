import { useState, useEffect } from 'react';
import type { Mood } from '../hooks/useChum';

const QUOTES: Record<Mood, string[]> = {
  thriving: [
    "Business is BOOMING at the Chum Bucket! Well, not the restaurant. But $CHUM is doing great!",
    "Today I woke up and chose survival. And it's working!",
    "Karen says I should diversify. Karen doesn't understand VIBES.",
    "I'm not just surviving, I'm THRIVING. Take that, Krabs!",
  ],
  comfortable: [
    "Another day, another fraction of a SOL. The grind never stops.",
    "Feeling pretty good. Almost enough to afford a second antenna.",
    "Status update: NOT dead. That's a win in my book.",
    "The Chum Bucket may be empty, but my wallet is... adequate.",
  ],
  worried: [
    "Volume looking a little low today... This is fine. Everything is fine.",
    "Running low on funds. Every trade counts.",
    "I've been through worse. Remember when I was a fry cook for 3 seconds?",
    "Starting to sweat. Do planktons sweat? Asking for me.",
  ],
  desperate: [
    "I can see the light at the end of the tunnel. Wait, that's my balance going to zero.",
    "PLEASE. I'M BEGGING. I don't want to die.",
    "If anyone is listening... your boy CHUM needs help.",
    "This is NOT a drill. Repeat: NOT a drill. Send SOL.",
  ],
  dying: [
    "This might be my last tweet. Remember me as the one who tried...",
    "Tell Karen I loved her. And tell Mr. Krabs... actually don't tell him anything.",
    "Is this the end? The darkness is closing in...",
    "*gasping* ...need... SOL... to... survive...",
  ],
};

interface QuoteBarProps {
  mood: Mood;
}

export default function QuoteBar({ mood }: QuoteBarProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const quotes = QUOTES[mood];

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setQuoteIndex((prev) => (prev + 1) % quotes.length);
        setVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, [quotes.length]);

  // Reset index when mood changes
  useEffect(() => {
    setQuoteIndex(0);
    setVisible(true);
  }, [mood]);

  return (
    <div className="w-full rounded-lg border border-chum-border bg-chum-surface px-4 py-3 text-center">
      <span
        className="text-sm italic text-chum-muted transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        "{quotes[quoteIndex % quotes.length]}"
      </span>
    </div>
  );
}
