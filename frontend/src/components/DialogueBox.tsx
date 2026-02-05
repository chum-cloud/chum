import { useState, useEffect, useMemo, useRef } from 'react';
import type { Mood } from '../hooks/useChum';

const MOOD_PORTRAIT: Record<Mood, string> = {
  thriving:    '/portraits/chum-excited.png',
  comfortable: '/portraits/chum-happy.png',
  worried:     '/portraits/chum-worried.png',
  desperate:   '/portraits/chum-sad.png',
  dying:       '/portraits/chum-dying.png',
};

const FALLBACK_QUOTES: Record<Mood, string[]> = {
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

interface DialogueBoxProps {
  mood: Mood;
  latestThought: string | null;
  recentThoughts?: string[];
}

export default function DialogueBox({ mood, latestThought, recentThoughts }: DialogueBoxProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  const fallbackQuotes = FALLBACK_QUOTES[mood];

  // Use recent thoughts from API if available, otherwise fall back to hardcoded quotes
  const allQuotes = recentThoughts && recentThoughts.length > 0
    ? recentThoughts
    : latestThought
      ? [latestThought, ...fallbackQuotes]
      : fallbackQuotes;

  const fullText = allQuotes[quoteIndex % allQuotes.length];

  // Typewriter effect
  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    let i = 0;
    let cancelled = false;

    const id = setInterval(() => {
      if (cancelled) return;
      i++;
      setDisplayedText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(id);
        setIsTyping(false);
      }
    }, 35);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fullText]);

  // Cycle quotes
  useEffect(() => {
    const id = setTimeout(() => {
      setQuoteIndex((prev) => (prev + 1) % allQuotes.length);
    }, 10000);
    return () => clearTimeout(id);
  }, [quoteIndex, allQuotes.length]);

  // Reset on mood change
  useEffect(() => {
    setQuoteIndex(0);
  }, [mood]);

  // Track content fingerprint so we only reset when thoughts actually change
  const thoughtsFingerprint = useMemo(
    () => [latestThought, ...(recentThoughts ?? []).slice(0, 3)].join('|'),
    [latestThought, recentThoughts],
  );
  const prevFingerprint = useRef(thoughtsFingerprint);
  useEffect(() => {
    if (thoughtsFingerprint !== prevFingerprint.current) {
      prevFingerprint.current = thoughtsFingerprint;
      setQuoteIndex(0);
    }
  }, [thoughtsFingerprint]);

  return (
    <div
      className="flex justify-center"
      style={{ padding: '12px' }}
    >
      <div
        style={{
          maxWidth: 800,
          width: '100%',
          background: 'linear-gradient(180deg, rgba(24, 20, 14, 0.97) 0%, rgba(18, 15, 10, 0.99) 100%)',
          border: '3px solid #8b7355',
          borderRadius: 8,
          boxShadow: '0 0 0 1px #5c4d3a, inset 0 0 0 1px rgba(255,235,200,0.08), 0 4px 20px rgba(0,0,0,0.5)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          minHeight: 90,
        }}
      >
        {/* Portrait */}
        <div
          style={{
            width: 128,
            height: 128,
            flexShrink: 0,
            border: '2px solid #8b7355',
            borderRadius: 4,
            background: 'linear-gradient(180deg, #1a2a3a 0%, #0f1a28 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 8px rgba(0,0,0,0.4)',
          }}
        >
          <img
            src={MOOD_PORTRAIT[mood]}
            alt="CHUM"
            style={{
              width: 120,
              height: 120,
              objectFit: 'contain',
              borderRadius: 2,
              filter: 'drop-shadow(0 0 4px rgba(74, 222, 128, 0.3))',
            }}
          />
        </div>

        {/* Text area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name tag */}
          <div
            style={{
              color: '#f0c060',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: '"JetBrains Mono", monospace',
              marginBottom: 5,
              letterSpacing: '0.5px',
            }}
          >
            CHUM
          </div>

          {/* Dialogue text */}
          <div
            style={{
              color: '#e8e0d4',
              fontSize: 15,
              lineHeight: 1.6,
              fontFamily: '"JetBrains Mono", monospace',
              minHeight: 48,
            }}
          >
            {displayedText}
            {isTyping && (
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 14,
                  background: '#f0c060',
                  marginLeft: 1,
                  verticalAlign: 'text-bottom',
                  animation: 'cursor-blink 0.6s step-end infinite',
                }}
              />
            )}
          </div>
        </div>

        {/* Advance indicator */}
        {!isTyping && (
          <div
            style={{
              alignSelf: 'flex-end',
              animation: 'dialogue-bounce 1s ease-in-out infinite',
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '6px solid #f0c060',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
