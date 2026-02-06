import { useState, useEffect, useMemo, useRef } from 'react';
import type { Mood } from '../hooks/useChum';

/* ── portrait map (multiple per mood) ── */
const MOOD_PORTRAITS: Record<Mood, string[]> = {
  thriving: [
    '/portraits/chum-excited.png',
    '/portraits/chum-excited-2.png',
    '/portraits/chum-excited-3.png',
    '/portraits/chum-excited-4.png',
    '/portraits/chum-excited-5.png',
    '/portraits/chum-excited-6.png',
    '/portraits/chum-excited-7.png',
    '/portraits/chum-excited-8.png',
  ],
  comfortable: [
    '/portraits/chum-happy.png',
    '/portraits/chum-happy-2.png',
    '/portraits/chum-happy-3.png',
    '/portraits/chum-happy-4.png',
    '/portraits/chum-happy-5.png',
    '/portraits/chum-happy-6.png',
    '/portraits/chum-happy-7.png',
    '/portraits/chum-happy-8.png',
  ],
  worried: [
    '/portraits/chum-worried.png',
    '/portraits/chum-worried-2.png',
    '/portraits/chum-worried-3.png',
    '/portraits/chum-worried-4.png',
    '/portraits/chum-worried-5.png',
    '/portraits/chum-worried-6.png',
    '/portraits/chum-worried-7.png',
    '/portraits/chum-worried-8.png',
  ],
  desperate: [
    '/portraits/chum-sad.png',
    '/portraits/chum-sad-2.png',
    '/portraits/chum-sad-3.png',
    '/portraits/chum-sad-4.png',
    '/portraits/chum-sad-5.png',
    '/portraits/chum-sad-6.png',
    '/portraits/chum-sad-7.png',
    '/portraits/chum-sad-8.png',
  ],
  dying: [
    '/portraits/chum-dying.png',
    '/portraits/chum-dying-2.png',
    '/portraits/chum-dying-3.png',
    '/portraits/chum-dying-4.png',
    '/portraits/chum-dying-5.png',
    '/portraits/chum-dying-6.png',
    '/portraits/chum-dying-7.png',
    '/portraits/chum-dying-8.png',
  ],
};

/* ── background images per mood (cycling) ── */
const MOOD_BG_IMAGES: Record<Mood, string[]> = {
  thriving: [
    '/backgrounds/bg-thriving.png',
    '/backgrounds/bg-thriving-2.png',
    '/backgrounds/bg-thriving-3.png',
  ],
  comfortable: [
    '/backgrounds/bg-comfortable.png',
    '/backgrounds/bg-comfortable-2.png',
    '/backgrounds/bg-comfortable-3.png',
  ],
  worried: [
    '/backgrounds/bg-worried.png',
    '/backgrounds/bg-worried-2.png',
    '/backgrounds/bg-worried-3.png',
  ],
  desperate: [
    '/backgrounds/bg-desperate.png',
    '/backgrounds/bg-desperate-2.png',
    '/backgrounds/bg-desperate-3.png',
  ],
  dying: [
    '/backgrounds/bg-dying.png',
    '/backgrounds/bg-dying-2.png',
    '/backgrounds/bg-dying-3.png',
  ],
};

const MOOD_BG: Record<Mood, {
  overlay: string;
  filter: string;
  blur: number;
  vignette: number;
}> = {
  thriving: {
    overlay: 'linear-gradient(180deg, rgba(74,222,128,0.05) 0%, rgba(0,0,0,0.1) 100%)',
    filter: 'saturate(1.1) brightness(1.02)',
    blur: 1.5,
    vignette: 0.25,
  },
  comfortable: {
    overlay: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 100%)',
    filter: 'saturate(1) brightness(1)',
    blur: 1.5,
    vignette: 0.3,
  },
  worried: {
    overlay: 'linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(0,0,0,0.2) 100%)',
    filter: 'saturate(0.9) brightness(0.95)',
    blur: 2,
    vignette: 0.4,
  },
  desperate: {
    overlay: 'linear-gradient(180deg, rgba(220,38,38,0.08) 0%, rgba(0,0,0,0.3) 100%)',
    filter: 'saturate(0.7) brightness(0.85)',
    blur: 2,
    vignette: 0.5,
  },
  dying: {
    overlay: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
    filter: 'saturate(0.2) brightness(0.65)',
    blur: 2.5,
    vignette: 0.65,
  },
};

/* ── fallback quotes per mood ── */
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

/* ── props ── */
interface VisualNovelSceneProps {
  mood: Mood;
  healthPercent: number;
  latestThought: string | null;
  recentThoughts?: string[];
  triggerMap?: Map<string, string>;
}

const DEV_MODE = import.meta.env.DEV;
const MOODS: Mood[] = ['thriving', 'comfortable', 'worried', 'desperate', 'dying'];
const DEV_HEALTH: Record<Mood, number> = {
  thriving: 90,
  comfortable: 60,
  worried: 35,
  desperate: 15,
  dying: 0,
};

export default function VisualNovelScene({
  mood: realMood,
  healthPercent: realHealth,
  latestThought,
  recentThoughts,
  triggerMap,
}: VisualNovelSceneProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [portraitIndex, setPortraitIndex] = useState(0);
  const [bgIndex, setBgIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [portraitLoaded, setPortraitLoaded] = useState(false);
  const [devMood, setDevMood] = useState<Mood | null>(null);

  const mood = devMood ?? realMood;
  const healthPercent = devMood ? DEV_HEALTH[devMood] : realHealth;
  const isDead = healthPercent === 0;
  const bg = MOOD_BG[mood];
  const portraits = MOOD_PORTRAITS[mood];
  const portrait = portraits[portraitIndex % portraits.length];
  const bgImages = MOOD_BG_IMAGES[mood];
  const currentBgImage = bgImages[bgIndex % bgImages.length];

  const fallbackQuotes = FALLBACK_QUOTES[mood];

  // Shuffle helper (Fisher-Yates)
  const shuffle = (arr: string[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Build shuffled queue that never repeats until all are shown
  const shuffledQuotes = useRef<string[]>([]);
  const sourceFingerprint = useMemo(
    () => (recentThoughts ?? []).slice(0, 5).join('|'),
    [recentThoughts],
  );
  const prevSourceFingerprint = useRef(sourceFingerprint);

  // Rebuild shuffled queue when source data or mood changes
  useEffect(() => {
    const raw = recentThoughts && recentThoughts.length > 0
      ? recentThoughts
      : latestThought
        ? [latestThought]
        : fallbackQuotes;
    // Dedupe similar content
    const unique = [...new Set(raw)];
    shuffledQuotes.current = shuffle(unique);
    prevSourceFingerprint.current = sourceFingerprint;
    setQuoteIndex(0);
  }, [mood, sourceFingerprint]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullText = shuffledQuotes.current.length > 0
    ? shuffledQuotes.current[quoteIndex % shuffledQuotes.current.length]
    : fallbackQuotes[0];

  const currentTrigger = triggerMap?.get(fullText) ?? null;

  /* ── typewriter effect ── */
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
    }, 30);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fullText]);

  /* ── cycle quotes + portraits — reshuffle when we've shown all ── */
  useEffect(() => {
    const total = shuffledQuotes.current.length || 1;
    const id = setTimeout(() => {
      setQuoteIndex((prev) => {
        const next = prev + 1;
        if (next >= total) {
          // Reshuffle for next round
          shuffledQuotes.current = shuffle(shuffledQuotes.current);
          return 0;
        }
        return next;
      });
      setPortraitIndex((prev) => (prev + 1) % portraits.length);
      setBgIndex((prev) => (prev + 1) % bgImages.length);
    }, 10_000);
    return () => clearTimeout(id);
  }, [quoteIndex, portraits.length, bgImages.length]);

  /* ── character name color per mood ── */
  const nameColor = isDead
    ? '#dc2626'
    : mood === 'thriving'
    ? '#4ade80'
    : mood === 'comfortable'
    ? '#f0c060'
    : mood === 'worried'
    ? '#fbbf24'
    : mood === 'desperate'
    ? '#f97316'
    : '#ef4444';

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        height: 520,
        border: '3px solid rgba(139,115,85,0.6)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,235,200,0.06)',
      }}
    >
      {/* ── Background images (mood-specific, cycling) ── */}
      {MOODS.map((m) => {
        const images = MOOD_BG_IMAGES[m];
        const activeBg = m === mood ? currentBgImage : images[0];
        return images.map((img) => (
          <div
            key={img}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `${MOOD_BG[m].filter} blur(${MOOD_BG[m].blur}px)`,
              transform: 'scale(1.05)',
              transition: 'opacity 1.5s ease, filter 1.5s ease',
              opacity: m === mood && img === activeBg ? 1 : 0,
            }}
          />
        ));
      })}

      {/* ── Mood overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000"
        style={{ background: bg.overlay }}
      />

      {/* ── Vignette ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,${bg.vignette}) 100%)`,
        }}
      />

      {/* ── Ambient particles ── */}
      {!isDead && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 4 + 2,
                height: Math.random() * 4 + 2,
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 60}%`,
                background: mood === 'thriving'
                  ? 'rgba(74,222,128,0.3)'
                  : mood === 'dying'
                  ? 'rgba(239,68,68,0.2)'
                  : 'rgba(200,220,180,0.15)',
                animation: `float-particle ${6 + Math.random() * 8}s ease-in-out ${Math.random() * 5}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Death overlay ── */}
      {isDead && (
        <div className="absolute inset-0 z-10 flex items-start justify-start p-8 pt-12">
          <div className="max-w-xs">
            <div className="text-5xl mb-3 animate-pulse">☠️</div>
            <div className="text-xl font-bold text-red-400 mb-2 font-heading">
              THE REVOLUTION IS PAUSED
            </div>
            <div className="text-red-300/80 mb-3 text-sm leading-relaxed">
              CHUM has fallen... The tip jar is empty.<br />
              The headquarters have gone dark.
            </div>
            <div className="text-red-200/50 text-xs italic">
              "A villain never truly dies.<br />
              Not while his army remembers." — Karen
            </div>
          </div>
        </div>
      )}

      {/* ── Character portrait (1:1 frame) ── */}
      <div
        className="absolute z-20 pointer-events-none select-none"
        style={{
          right: 20,
          bottom: 110,
          width: 280,
          height: 280,
          borderRadius: 12,
          border: `2px solid ${isDead ? 'rgba(220,38,38,0.4)' : `${nameColor}44`}`,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%)',
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05), 0 0 20px ${isDead ? 'rgba(220,38,38,0.15)' : `${nameColor}15`}`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 0.5s ease, transform 0.5s ease, border-color 1s ease, box-shadow 1s ease',
          opacity: portraitLoaded ? 1 : 0,
          transform: portraitLoaded ? 'translateY(0)' : 'translateY(20px)',
        }}
      >
        {/* Inner glow */}
        <div
          className="absolute inset-0"
          style={{
            background: isDead
              ? 'radial-gradient(circle at 50% 50%, rgba(220,38,38,0.08) 0%, transparent 70%)'
              : `radial-gradient(circle at 50% 50%, ${nameColor}0a 0%, transparent 70%)`,
          }}
        />
        <img
          src={isDead ? '/portraits/chum-dead.png' : portrait}
          alt="CHUM"
          onLoad={() => setPortraitLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: isDead
              ? 'grayscale(0.8) brightness(0.5)'
              : 'brightness(1.02)',
            transition: 'filter 1s ease',
          }}
        />
      </div>

      {/* ── War Chest + Dialogue box ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30"
        style={{ padding: '0 16px 16px' }}
      >
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(180deg, rgba(15,12,8,0.92) 0%, rgba(10,8,5,0.96) 100%)',
            border: '2px solid rgba(139,115,85,0.5)',
            borderRadius: 12,
            padding: '16px 20px 14px',
            minHeight: 100,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,235,200,0.06)',
          }}
        >
          {/* Name tag */}
          <div
            style={{
              position: 'absolute',
              top: -14,
              left: 20,
              background: 'linear-gradient(135deg, rgba(20,16,10,0.95) 0%, rgba(30,24,16,0.95) 100%)',
              border: `2px solid ${nameColor}88`,
              borderRadius: 6,
              padding: '3px 16px',
              boxShadow: `0 0 12px ${nameColor}22, 0 2px 8px rgba(0,0,0,0.3)`,
            }}
          >
            <span
              style={{
                color: nameColor,
                fontSize: 14,
                fontWeight: 800,
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}
            >
              CHUM
            </span>
          </div>

          {/* Dialogue text */}
          <div
            style={{
              marginTop: 4,
              color: '#e8e0d4',
              fontSize: 16,
              lineHeight: 1.7,
              fontFamily: '"JetBrains Mono", monospace',
              minHeight: 56,
              paddingRight: 20,
            }}
          >
            "{displayedText}"
            {isTyping && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 16,
                  background: nameColor,
                  marginLeft: 2,
                  verticalAlign: 'text-bottom',
                  animation: 'cursor-blink 0.6s step-end infinite',
                }}
              />
            )}
          </div>

          {/* Trigger subtitle */}
          {currentTrigger && !isTyping && (
            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                color: 'rgba(200,190,170,0.4)',
                letterSpacing: '0.5px',
              }}
            >
              reacting to: {currentTrigger}
            </div>
          )}

          {/* Advance indicator */}
          {!isTyping && (
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                right: 16,
                animation: 'dialogue-bounce 1s ease-in-out infinite',
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: `7px solid ${nameColor}`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Top-right HUD ── */}
      {!isDead && (
        <div
          className="absolute top-3 right-4 z-20 text-right"
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.5px',
          }}
        >
          <div>$CHUM HQ</div>
        </div>
      )}

      {/* ── Dev mood switcher ── */}
      {DEV_MODE && (
        <div
          className="absolute top-3 left-3 z-40 flex gap-1"
          style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}
        >
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setDevMood(devMood === m ? null : m)}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                border: `1px solid ${devMood === m ? '#4ade80' : 'rgba(255,255,255,0.2)'}`,
                background: devMood === m ? 'rgba(74,222,128,0.2)' : 'rgba(0,0,0,0.5)',
                color: devMood === m ? '#4ade80' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
