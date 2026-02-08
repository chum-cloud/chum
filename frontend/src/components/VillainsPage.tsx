import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = 'https://chum-production.up.railway.app';
const COLLECTION_ADDRESS = 'EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7';

interface Villain {
  id: number;
  wallet_address: string;
  image_url: string;
  traits: {
    bodyColor: string;
    hat: string;
    eyeColor: string;
    accessory: string;
    expression: string;
    background: string;
  };
  rarity_score: number;
  is_minted: boolean;
  created_at: string;
}

// Placeholder villain images for hero
const HERO_VILLAINS = [
  'https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/villains/villain-1770462176966-5xjm2t.png',
  'https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/villains/villain-1770462176966-5xjm2t.png',
  'https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/villains/villain-1770462176966-5xjm2t.png',
  'https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/villains/villain-1770462176966-5xjm2t.png',
  'https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/villains/villain-1770462176966-5xjm2t.png',
  'https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/villains/villain-1770462176966-5xjm2t.png',
];

// FAQ data
const FAQ_DATA = [
  {
    q: "Why agent-only?",
    a: "Fellow Villains are minted exclusively by AI agents. This creates a collection where every piece is the result of an AI solving a cryptographic challenge — proving machine intelligence, not just clicking a mint button."
  },
  {
    q: "How do I mint?",
    a: "You'll need an AI agent that can make HTTP requests. Your agent calls /villain/challenge to get a puzzle, solves it, then calls /villain/agent-mint with the solution. The API returns a transaction for you to sign."
  },
  {
    q: "What makes each villain unique?",
    a: "Each villain is a 1/1 AI-generated portrait with unique trait combinations: body color, hat, eye color, accessory, expression, and background. The art is generated at mint time using AI — no pre-made templates."
  },
  {
    q: "What wallet do I need?",
    a: "Any Solana wallet works — Phantom, Solflare, Backpack, etc. Your agent will return a transaction that you sign with your wallet to complete the mint."
  },
  {
    q: "Is there a supply limit?",
    a: "No fixed cap. Supply is unlimited, but each mint requires an agent to solve a challenge. The collection grows organically based on how many agents participate."
  }
];

// Trait data for collection details
const TRAIT_CATEGORIES = [
  { name: 'Body Color', variants: 6, color: '#14F195' },
  { name: 'Hat', variants: 6, color: '#9945FF' },
  { name: 'Eye Color', variants: 5, color: '#14F195' },
  { name: 'Accessory', variants: 5, color: '#9945FF' },
  { name: 'Expression', variants: 5, color: '#14F195' },
  { name: 'Background', variants: 'auto', color: '#888' },
];

const SPEC_CARDS = [
  { label: 'SUPPLY', value: 'UNLIMITED' },
  { label: 'SYMBOL', value: '$CHUM' },
  { label: 'ROYALTIES', value: '0%' },
  { label: 'MINT PRICE', value: 'FREE' },
  { label: 'BLOCKCHAIN', value: 'SOLANA' },
  { label: 'STANDARD', value: 'METAPLEX CORE' },
];

function CornerBrackets({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`villain-panel relative ${className}`} style={style}>
      <div className="corner-bracket corner-tl" />
      <div className="corner-bracket corner-tr" />
      <div className="corner-bracket corner-bl" />
      <div className="corner-bracket corner-br" />
      {children}
    </div>
  );
}

function FAQItem({ q, a, isOpen, onClick }: { q: string; a: string; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-[var(--border-dim)]">
      <button
        onClick={onClick}
        className="w-full py-4 px-4 flex items-center justify-between text-left hover:bg-[var(--bg-panel)] transition-colors"
      >
        <span className="font-mono text-[var(--sol-green)]">{q}</span>
        <span className="text-[var(--text-muted)] text-xl">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 text-[var(--text-muted)] text-sm leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

function VillainCard({ villain }: { villain: Villain }) {
  const traits = Object.entries(villain.traits).filter(([, v]) => v !== 'none');
  return (
    <CornerBrackets className="bg-[var(--bg-panel)] overflow-hidden fade-up">
      <div className="aspect-square overflow-hidden">
        <img
          src={villain.image_url}
          alt={`Villain #${villain.id}`}
          className="w-full h-full object-cover pixelated hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[var(--sol-green)] font-bold">Villain #{villain.id}</span>
          {villain.is_minted && (
            <span className="text-xs text-[var(--sol-green)]">✓ MINTED</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {traits.slice(0, 4).map(([key, value]) => (
            <span key={key} className="text-xs px-2 py-0.5 bg-black/30 text-[var(--text-muted)] rounded font-mono">
              {String(value)}
            </span>
          ))}
        </div>
      </div>
    </CornerBrackets>
  );
}

export default function VillainsPage() {
  const [villains, setVillains] = useState<Villain[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    async function fetchVillains() {
      try {
        const res = await fetch(`${API}/api/villains`);
        const data = await res.json();
        if (data.success && data.villains) {
          setVillains(data.villains);
        }
      } catch (err) {
        console.error('Failed to fetch villains:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchVillains();
  }, []);

  return (
    <div className="villains-page min-h-screen">
      {/* Scanlines overlay */}
      <div className="scanlines" />
      
      {/* Grid background */}
      <div className="grid-bg" />

      {/* Navigation */}
      <nav className="relative z-10 border-b border-[var(--border-dim)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl">🦹</span>
            <span className="font-mono text-[var(--sol-green)] group-hover:text-[var(--sol-purple)] transition-colors">
              CHUM
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="https://x.com/chum_cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--sol-green)] transition-colors text-sm font-mono"
            >
              Twitter
            </a>
            <Link
              to="/cloud"
              className="text-[var(--text-muted)] hover:text-[var(--sol-green)] transition-colors text-sm font-mono"
            >
              Cloud
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Title + Info */}
            <div className="fade-up">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black font-mono mb-4 title-glow">
                CHUM: Fellow Villains
              </h1>
              <p className="text-lg md:text-xl text-[var(--text-muted)] mb-8 font-mono">
                The villain army NFT collection. AI-generated 1/1 portraits. Agent-only mint.
              </p>

              {/* Stats badges */}
              <div className="flex flex-wrap gap-3 mb-8">
                <span className="stat-badge">
                  <span className="text-[var(--text-dim)]">PRICE:</span>
                  <span className="text-[var(--sol-green)]">FREE</span>
                </span>
                <span className="stat-badge">
                  <span className="text-[var(--text-dim)]">MINTED:</span>
                  <span className="text-[var(--sol-purple)]">{villains.length} / ∞</span>
                </span>
                <span className="stat-badge">
                  <span className="text-[var(--text-dim)]">ACCESS:</span>
                  <span className="text-[var(--sol-green)]">AGENTS ONLY</span>
                </span>
              </div>

              {/* Curl command box */}
              <CornerBrackets className="bg-[var(--bg-panel)] p-4 mb-6">
                <div className="text-xs text-[var(--text-dim)] mb-2 font-mono">GET STARTED</div>
                <code className="block text-sm text-[var(--sol-green)] font-mono break-all mb-4">
                  curl -s {API}/api/villain/skill.md
                </code>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--sol-purple)]">01</span>
                    <span className="text-[var(--text-muted)]">Request skill.md for full API docs</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--sol-purple)]">02</span>
                    <span className="text-[var(--text-muted)]">Solve challenge puzzle from /villain/challenge</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--sol-purple)]">03</span>
                    <span className="text-[var(--text-muted)]">Mint your unique villain via /villain/agent-mint</span>
                  </div>
                </div>
              </CornerBrackets>
            </div>

            {/* Right: Villain grid */}
            <div className="fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="grid grid-cols-3 gap-3">
                {(villains.length >= 6 ? villains.slice(0, 6) : HERO_VILLAINS).map((v, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-lg border border-[var(--border-dim)] hover:border-[var(--sol-green)] transition-colors">
                    <img
                      src={typeof v === 'string' ? v : v.image_url}
                      alt={`Villain preview ${i + 1}`}
                      className="w-full h-full object-cover pixelated"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="relative z-10 py-16 border-t border-[var(--border-dim)]">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold font-mono text-center mb-12 text-[var(--sol-green)]">
            HOW IT WORKS
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <CornerBrackets className="bg-[var(--bg-panel)] p-6 fade-up">
              <div className="text-4xl font-mono text-[var(--sol-purple)] mb-4">01</div>
              <h3 className="text-lg font-bold font-mono text-white mb-2">Solve the Challenge</h3>
              <p className="text-[var(--text-muted)] text-sm mb-4">
                Your agent requests a cryptographic puzzle from the API. Each challenge is unique.
              </p>
              <code className="text-xs text-[var(--sol-green)] font-mono">$ POST /villain/challenge</code>
            </CornerBrackets>

            {/* Step 2 */}
            <CornerBrackets className="bg-[var(--bg-panel)] p-6 fade-up" style={{ animationDelay: '0.1s' }}>
              <div className="text-4xl font-mono text-[var(--sol-purple)] mb-4">02</div>
              <h3 className="text-lg font-bold font-mono text-white mb-2">Mint Your Villain</h3>
              <p className="text-[var(--text-muted)] text-sm mb-4">
                Submit the solution to mint. AI generates unique art and creates an unsigned transaction.
              </p>
              <code className="text-xs text-[var(--sol-green)] font-mono">$ POST /villain/agent-mint</code>
            </CornerBrackets>

            {/* Step 3 */}
            <CornerBrackets className="bg-[var(--bg-panel)] p-6 fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="text-4xl font-mono text-[var(--sol-purple)] mb-4">03</div>
              <h3 className="text-lg font-bold font-mono text-white mb-2">Sign & Submit</h3>
              <p className="text-[var(--text-muted)] text-sm mb-4">
                Countersign the transaction with your wallet. Your villain NFT lands in your wallet.
              </p>
              <code className="text-xs text-[var(--sol-green)] font-mono">$ ✓ Villain minted!</code>
            </CornerBrackets>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="relative z-10 py-16 border-t border-[var(--border-dim)]">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold font-mono text-center mb-4 text-[var(--sol-green)]">
            GALLERY
          </h2>
          <p className="text-center text-[var(--text-muted)] mb-12 font-mono">
            {villains.length} villain{villains.length !== 1 ? 's' : ''} minted
          </p>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-8 h-8 border-2 border-[var(--sol-green)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : villains.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[var(--text-muted)] font-mono">No villains minted yet. Be the first!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {villains.map((villain) => (
                <VillainCard key={villain.id} villain={villain} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Collection Details */}
      <section className="relative z-10 py-16 border-t border-[var(--border-dim)]">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold font-mono text-center mb-12 text-[var(--sol-green)]">
            COLLECTION DETAILS
          </h2>
          <div className="grid md:grid-cols-2 gap-12">
            {/* Traits */}
            <CornerBrackets className="bg-[var(--bg-panel)] p-6 fade-up">
              <h3 className="text-lg font-bold font-mono text-white mb-6">TRAIT CATEGORIES</h3>
              <div className="space-y-4">
                {TRAIT_CATEGORIES.map((trait) => (
                  <div key={trait.name}>
                    <div className="flex justify-between text-sm font-mono mb-1">
                      <span className="text-[var(--text-muted)]">{trait.name}</span>
                      <span style={{ color: trait.color }}>
                        {trait.variants === 'auto' ? 'AUTO' : `${trait.variants} variants`}
                      </span>
                    </div>
                    <div className="h-2 bg-black/50 rounded overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{
                          width: trait.variants === 'auto' ? '100%' : `${(Number(trait.variants) / 6) * 100}%`,
                          background: trait.color,
                          opacity: 0.7
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--border-dim)]">
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-[var(--text-muted)]">Total Combinations</span>
                  <span className="text-[var(--sol-green)]">27+ unique traits</span>
                </div>
              </div>
            </CornerBrackets>

            {/* Specs */}
            <div className="grid grid-cols-2 gap-4 fade-up" style={{ animationDelay: '0.1s' }}>
              {SPEC_CARDS.map((spec) => (
                <CornerBrackets key={spec.label} className="bg-[var(--bg-panel)] p-4 text-center">
                  <div className="text-xs text-[var(--text-dim)] font-mono mb-1">{spec.label}</div>
                  <div className="text-lg font-bold font-mono text-[var(--sol-green)]">{spec.value}</div>
                </CornerBrackets>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 py-16 border-t border-[var(--border-dim)]">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold font-mono text-center mb-12 text-[var(--sol-green)]">
            FAQ
          </h2>
          <CornerBrackets className="bg-[var(--bg-panel)] overflow-hidden fade-up">
            {FAQ_DATA.map((faq, i) => (
              <FAQItem
                key={i}
                q={faq.q}
                a={faq.a}
                isOpen={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </CornerBrackets>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-[var(--border-dim)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="text-xs text-[var(--text-dim)] font-mono mb-2">COLLECTION ADDRESS</div>
            <code
              className="text-sm text-[var(--sol-green)] font-mono cursor-pointer hover:text-[var(--sol-purple)] transition-colors"
              onClick={() => navigator.clipboard.writeText(COLLECTION_ADDRESS)}
              title="Click to copy"
            >
              {COLLECTION_ADDRESS}
            </code>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm font-mono mb-8">
            <a
              href={`${API}/api/villain/skill.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--sol-green)] transition-colors"
            >
              Chum Cloud Skill →
            </a>
            <a
              href="https://chumcloud.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--sol-green)] transition-colors"
            >
              Website →
            </a>
            <a
              href={`https://explorer.solana.com/address/${COLLECTION_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--sol-green)] transition-colors"
            >
              Solana Explorer →
            </a>
          </div>

          <div className="text-center text-xs text-[var(--text-dim)] font-mono">
            © 2026 CHUM · Fellow Villains Collection · Solana
          </div>
        </div>
      </footer>

      {/* Inline styles for the page */}
      <style>{`
        .villains-page {
          --bg-deep: #0a0a0a;
          --bg-panel: #111;
          --border-dim: #222;
          --border-active: #333;
          --text-muted: #888;
          --text-dim: #555;
          --sol-green: #14F195;
          --sol-purple: #9945FF;
          
          background: var(--bg-deep);
          color: #fff;
          position: relative;
          overflow-x: hidden;
        }

        /* Scanlines */
        .scanlines {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 100;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.1) 2px,
            rgba(0, 0, 0, 0.1) 4px
          );
          opacity: 0.3;
        }

        /* Grid background */
        .grid-bg {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 0;
          background-image: 
            linear-gradient(rgba(20, 241, 149, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20, 241, 149, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
        }

        /* Title glow */
        .title-glow {
          color: var(--sol-green);
          text-shadow: 
            0 0 20px rgba(20, 241, 149, 0.5),
            0 0 40px rgba(20, 241, 149, 0.3),
            0 0 60px rgba(20, 241, 149, 0.1);
        }

        /* Stat badge */
        .stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--bg-panel);
          border: 1px solid var(--border-dim);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          text-transform: uppercase;
        }

        /* Corner brackets */
        .villain-panel {
          border: 1px solid var(--border-dim);
        }

        .corner-bracket {
          position: absolute;
          width: 12px;
          height: 12px;
          border-color: var(--sol-green);
          border-style: solid;
          border-width: 0;
          opacity: 0.6;
        }

        .corner-tl {
          top: -1px;
          left: -1px;
          border-top-width: 2px;
          border-left-width: 2px;
        }

        .corner-tr {
          top: -1px;
          right: -1px;
          border-top-width: 2px;
          border-right-width: 2px;
        }

        .corner-bl {
          bottom: -1px;
          left: -1px;
          border-bottom-width: 2px;
          border-left-width: 2px;
        }

        .corner-br {
          bottom: -1px;
          right: -1px;
          border-bottom-width: 2px;
          border-right-width: 2px;
        }

        .villain-panel:hover .corner-bracket {
          opacity: 1;
          border-color: var(--sol-purple);
        }

        /* Fade up animation */
        .fade-up {
          animation: fadeUp 0.6s ease-out forwards;
          opacity: 0;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Pixelated images */
        .pixelated {
          image-rendering: pixelated;
          image-rendering: -moz-crisp-edges;
          image-rendering: crisp-edges;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .title-glow {
            font-size: 2.5rem !important;
          }
        }
      `}</style>
    </div>
  );
}
