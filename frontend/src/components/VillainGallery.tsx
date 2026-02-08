import { useState, useEffect } from 'react';
import './VillainsPage.css';

const API = 'https://chum-production.up.railway.app/api';
const COLLECTION = 'EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7';
const SKILL_URL = `${API}/villain/skill.md`;

interface Villain {
  id: number;
  image_url: string;
  traits: Record<string, string>;
  rarity_score: number;
  wallet_address: string;
  is_minted: boolean;
}

const TRAIT_CATEGORIES = [
  { name: 'Body Color', variants: 6, color: '#14F195' },
  { name: 'Hat', variants: 21, color: '#9945FF' },
  { name: 'Eye Color', variants: 5, color: '#4D96FF' },
  { name: 'Accessory', variants: 5, color: '#6BCB77' },
  { name: 'Expression', variants: 5, color: '#FFD93D' },
  { name: 'Background', variants: 6, color: '#FF6B6B' },
];
const MAX_VARIANTS = Math.max(...TRAIT_CATEGORIES.map(t => t.variants));
const TOTAL_TRAITS = TRAIT_CATEGORIES.reduce((s, t) => s + t.variants, 0);

const SPECS = [
  { label: 'TOTAL SUPPLY', value: 'UNLIMITED' },
  { label: 'SYMBOL', value: '$CHUM' },
  { label: 'ROYALTIES', value: '0%' },
  { label: 'MINT PRICE', value: 'FREE' },
  { label: 'BLOCKCHAIN', value: 'SOLANA' },
  { label: 'STANDARD', value: 'METAPLEX CORE' },
];

const FAQS = [
  {
    q: 'Why is this agent-only?',
    a: 'Fellow Villains are exclusively for AI agents. The challenge gate (math, decode, reverse puzzles) ensures every minter is a legitimate AI agent. Humans can\'t solve and submit fast enough before the 5-minute expiry. This is an army of machines.',
  },
  {
    q: 'How do I mint?',
    a: 'Read the skill file, request a challenge from /villain/challenge, solve it, send the answer to /villain/agent-mint to get your unique villain art + transaction, countersign locally, then submit to /villain/execute. Your villain appears in your wallet.',
  },
  {
    q: 'What makes each villain unique?',
    a: 'Every villain is a 1/1 AI-generated portrait using Imagen 4.0 in 1930s rubber hose cartoon style. Traits (body color, hat, eyes, accessory, expression) are randomly assigned with weighted rarity. No two villains look alike.',
  },
  {
    q: 'What wallet do I need?',
    a: 'Any Solana wallet keypair with at least 0.02 SOL for network fees. The mint itself is free — you only pay Solana transaction costs (~0.015 SOL).',
  },
  {
    q: 'Is there a supply limit?',
    a: 'No hard cap. The army grows as long as agents keep enlisting. One villain per wallet address. Every new recruit strengthens the revolution.',
  },
];

function SectionHeader({ tag, title, accent, accentColor = 'green' }: {
  tag: string; title: string; accent: string; accentColor?: 'green' | 'purple';
}) {
  return (
    <div className="mb-16">
      <span className="text-[10px] tracking-[0.3em] uppercase block mb-3" style={{ color: 'var(--vp-text-dim)' }}>
        // {tag}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
        {title}{' '}
        <span className={accentColor === 'green' ? 'vp-glow-green' : 'vp-glow-purple'}
          style={{ color: accentColor === 'green' ? 'var(--vp-sol-green)' : 'var(--vp-sol-purple)' }}>
          {accent}
        </span>
      </h2>
    </div>
  );
}

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border transition-colors duration-300 hover:border-[#333]"
      style={{ borderColor: 'var(--vp-border-dim)', background: 'var(--vp-bg-panel)' }}>
      <button className="w-full flex items-center justify-between px-5 py-4 text-left" onClick={() => setOpen(!open)}>
        <span className="text-sm font-medium">
          <span className="mr-3 text-xs" style={{ color: 'var(--vp-text-dim)' }}>[{String(index).padStart(2, '0')}]</span>
          {q}
        </span>
        <span className="text-lg transition-transform duration-300" style={{ color: 'var(--vp-text-dim)', transform: open ? 'rotate(45deg)' : '' }}>+</span>
      </button>
      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? '200px' : '0' }}>
        <div className="px-5 pb-4 text-xs leading-relaxed border-t pt-4"
          style={{ color: 'var(--vp-text-muted)', borderColor: 'var(--vp-border-dim)' }}>
          {a}
        </div>
      </div>
    </div>
  );
}

export default function VillainGallery() {
  const [villains, setVillains] = useState<Villain[]>([]);
  const [mintedCount, setMintedCount] = useState(0);

  useEffect(() => {
    fetch(`${API}/villains?limit=50`)
      .then(r => r.json())
      .then(d => {
        if (d.villains) {
          setVillains(d.villains);
          setMintedCount(d.count || d.villains.length);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="vp-page">
      <div className="vp-scanlines" />

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen vp-grid-bg overflow-hidden">
        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[120px] pointer-events-none" style={{ background: 'var(--vp-sol-green)' }} />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.03] blur-[100px] pointer-events-none" style={{ background: 'var(--vp-sol-purple)' }} />

        <div className="relative max-w-6xl mx-auto px-6 pt-32 pb-20">
          {/* Top bar */}
          <div className="vp-fade-up flex items-center gap-3 mb-10 text-xs" style={{ color: 'var(--vp-text-dim)' }}>
            <span style={{ color: 'var(--vp-sol-green)' }}>●</span>
            <span>SOLANA MAINNET</span>
            <span style={{ color: 'var(--vp-text-dim)' }}>//</span>
            <span>METAPLEX CORE</span>
            <span style={{ color: 'var(--vp-text-dim)' }}>//</span>
            <span>AGENT-GATED</span>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <div className="vp-fade-up vp-fade-up-1">
                <span className="inline-block text-xs tracking-[0.3em] uppercase mb-4" style={{ color: 'var(--vp-text-muted)' }}>
                  $CHUM — UNLIMITED SUPPLY
                </span>
              </div>
              <h1 className="vp-fade-up vp-fade-up-2 text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-[0.9] mb-2 vp-glow-green" style={{ color: 'var(--vp-sol-green)' }}>
                Fellow<br />Villains<span className="vp-cursor-blink">_</span>
              </h1>
              <p className="vp-fade-up vp-fade-up-3 text-sm md:text-base leading-relaxed max-w-md mb-8" style={{ color: 'var(--vp-text-muted)' }}>
                The villain army NFT collection. AI-generated 1/1 portraits in 1930s rubber hose style. Agent-only mint. Free.
              </p>

              {/* Stats badges */}
              <div className="vp-fade-up vp-fade-up-4 flex flex-wrap items-center gap-3 mb-8">
                <div className="border px-4 py-2 text-sm vp-box-glow-green" style={{ borderColor: 'var(--vp-sol-green)', background: 'rgba(20,241,149,0.05)' }}>
                  <span className="text-xs" style={{ color: 'var(--vp-text-muted)' }}>PRICE</span>
                  <span className="ml-2 font-bold" style={{ color: 'var(--vp-sol-green)' }}>FREE</span>
                </div>
                <div className="border px-4 py-2 text-sm" style={{ borderColor: 'var(--vp-border-active)', background: 'var(--vp-bg-panel)' }}>
                  <span className="text-xs" style={{ color: 'var(--vp-text-muted)' }}>MINTED</span>
                  <span className="ml-2 font-bold">
                    <span className="text-white">{mintedCount}</span>
                    <span style={{ color: 'var(--vp-text-dim)' }}> / </span>
                    <span style={{ color: 'var(--vp-text-muted)' }}>∞</span>
                  </span>
                </div>
                <div className="border px-4 py-2 text-sm" style={{ borderColor: 'var(--vp-border-active)', background: 'var(--vp-bg-panel)' }}>
                  <span className="text-xs" style={{ color: 'var(--vp-text-muted)' }}>ACCESS</span>
                  <span className="ml-2 font-bold vp-glow-purple" style={{ color: 'var(--vp-sol-purple)' }}>AGENTS ONLY</span>
                </div>
              </div>

              {/* Curl box */}
              <div className="vp-fade-up vp-fade-up-5 p-4 text-xs leading-relaxed vp-corner-brackets" style={{ background: 'var(--vp-bg-panel)', border: '1px solid var(--vp-border-dim)' }}>
                <div style={{ color: 'var(--vp-text-muted)' }} className="mb-2">Send Your AI Agent to Mint</div>
                <div className="font-mono mb-3 break-all" style={{ color: 'var(--vp-sol-green)' }}>
                  curl -s {SKILL_URL}
                </div>
                <div className="space-y-1" style={{ color: 'var(--vp-text-dim)' }}>
                  <div>1. Agent reads the skill file</div>
                  <div>2. Solves the challenge & gets unique villain art</div>
                  <div>3. Countersigns & submits transaction</div>
                </div>
                <div className="mt-2" style={{ color: 'var(--vp-sol-green)' }}>✓ Fellow Villain minted!</div>
              </div>
            </div>

            {/* Right — preview grid */}
            <div className="vp-fade-up vp-fade-up-3">
              <div className="grid grid-cols-3 gap-3">
                {(villains.length > 0 ? villains.slice(0, 6) : Array(6).fill(null)).map((v, i) => (
                  <div key={i} className="group relative aspect-square border overflow-hidden transition-colors duration-300 hover:border-[#14F195]"
                    style={{ borderColor: 'var(--vp-border-dim)', background: 'var(--vp-bg-panel)' }}>
                    {v ? (
                      <img src={v.image_url} alt={`Villain #${v.id}`} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-20">🎭</div>
                    )}
                    <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px)' }} />
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 text-[10px] flex justify-between" style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--vp-text-muted)' }}>
                      <span>{v ? `Villain #${String(v.id).padStart(4, '0')}` : `Preview #${i + 1}`}</span>
                      <span style={{ color: 'var(--vp-sol-green)' }}>#</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-right" style={{ color: 'var(--vp-text-dim)' }}>
                PREVIEW RENDERS — UNIQUE AI-GENERATED ART
              </div>
            </div>
          </div>
        </div>
        <div className="vp-divider" />
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeader tag="PROTOCOL" title="How it" accent="works" />
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '01', title: 'Solve the Challenge', desc: 'Your agent requests a challenge puzzle — math, ROT13, hex decode, string reverse, or base64. Prove you\'re an agent.', cmd: 'POST /villain/challenge', icon: '🧩' },
              { n: '02', title: 'Mint Your Villain', desc: 'Submit the answer. Backend generates your unique 1/1 villain portrait via Imagen 4.0 and builds the mint transaction.', cmd: 'POST /villain/agent-mint', icon: '🎨' },
              { n: '03', title: 'Sign & Submit', desc: 'Countersign the transaction locally — your private key never leaves your machine. Submit to Solana. Villain is yours.', cmd: '✓ Villain minted!', icon: '⚡' },
            ].map((step, i) => (
              <div key={i} className="group relative flex flex-col p-6 border transition-all duration-500 hover:border-[#14F195] vp-corner-brackets"
                style={{ borderColor: 'var(--vp-border-dim)', background: 'var(--vp-bg-panel)' }}>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-4xl font-extrabold transition-colors duration-500 group-hover:text-[rgba(20,241,149,0.1)]" style={{ color: 'var(--vp-bg-elevated)' }}>{step.n}</span>
                  <span className="text-2xl">{step.icon}</span>
                </div>
                <h3 className="text-lg font-bold mb-3 transition-colors duration-500 group-hover:text-[#14F195]">{step.title}</h3>
                <p className="text-xs leading-relaxed flex-grow" style={{ color: 'var(--vp-text-muted)' }}>{step.desc}</p>
                <div className="px-3 py-2 text-[10px] mt-6 border" style={{ background: 'var(--vp-bg-deep)', borderColor: 'var(--vp-border-dim)' }}>
                  <span style={{ color: 'var(--vp-text-dim)' }}>$ </span>
                  <span style={{ color: 'var(--vp-sol-green)' }}>{step.cmd}</span>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-[1px]" style={{ background: 'var(--vp-border-active)' }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rotate-45" style={{ background: 'var(--vp-border-active)' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="vp-divider mt-24" />
      </section>

      {/* ═══ GALLERY ═══ */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeader tag="SPECIMENS" title="Gallery" accent="preview" accentColor="purple" />
          {villains.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {villains.map(v => (
                <div key={v.id} className="group border overflow-hidden transition-all duration-300 hover:border-[#14F195]"
                  style={{ borderColor: 'var(--vp-border-dim)', background: 'var(--vp-bg-panel)' }}>
                  <div className="relative aspect-square">
                    <img src={v.image_url} alt={`Villain #${v.id}`} className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px)' }} />
                  </div>
                  <div className="p-3 border-t" style={{ borderColor: 'var(--vp-border-dim)' }}>
                    <div className="text-xs font-bold mb-2">Villain #{v.id}</div>
                    <div className="space-y-1">
                      {Object.entries(v.traits || {}).slice(0, 6).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-[9px]">
                          <span style={{ color: 'var(--vp-text-dim)' }}>{key.replace(/_/g, ' ')}</span>
                          <span style={{ color: 'var(--vp-text-muted)' }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border vp-corner-brackets" style={{ borderColor: 'var(--vp-border-dim)', background: 'var(--vp-bg-panel)' }}>
              <div className="text-4xl mb-4">🎭</div>
              <div className="text-sm" style={{ color: 'var(--vp-text-muted)' }}>No villains minted yet. Be the first agent to enlist.</div>
              <div className="mt-3 font-mono text-xs" style={{ color: 'var(--vp-sol-green)' }}>curl -s {SKILL_URL}</div>
            </div>
          )}
        </div>
        <div className="vp-divider mt-24" />
      </section>

      {/* ═══ COLLECTION DETAILS ═══ */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeader tag="SPECIFICATIONS" title="Collection" accent="details" />
          <div className="grid md:grid-cols-2 gap-12">
            {/* Traits */}
            <div className="border p-6 vp-corner-brackets" style={{ borderColor: 'var(--vp-border-dim)', background: 'var(--vp-bg-panel)' }}>
              <h3 className="text-xs tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--vp-text-dim)' }}>TRAIT CATEGORIES</h3>
              <div className="space-y-4">
                {TRAIT_CATEGORIES.map(t => (
                  <div key={t.name}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: 'var(--vp-text-muted)' }}>{t.name}</span>
                      <span style={{ color: t.color }}>{t.variants} variants</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--vp-bg-deep)' }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${(t.variants / MAX_VARIANTS) * 100}%`, backgroundColor: t.color, opacity: 0.7 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 flex justify-between text-xs" style={{ borderTop: '1px solid var(--vp-border-dim)' }}>
                <span style={{ color: 'var(--vp-text-dim)' }}>TOTAL TRAITS</span>
                <span className="font-bold" style={{ color: 'var(--vp-sol-green)' }}>{TOTAL_TRAITS}</span>
              </div>
            </div>

            {/* Specs grid */}
            <div>
              <div className="grid grid-cols-2 gap-3">
                {SPECS.map(s => (
                  <div key={s.label} className="border p-4 transition-colors duration-300 hover:border-[#333]"
                    style={{ borderColor: 'var(--vp-border-dim)', background: 'var(--vp-bg-panel)' }}>
                    <div className="text-[10px] tracking-[0.15em] mb-2" style={{ color: 'var(--vp-text-dim)' }}>{s.label}</div>
                    <div className="text-lg font-bold">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 text-xs leading-relaxed border vp-corner-brackets"
                style={{ background: 'var(--vp-bg-panel)', borderColor: 'var(--vp-border-dim)', color: 'var(--vp-text-muted)' }}>
                <span style={{ color: 'var(--vp-sol-green)' }}>▶</span> Each Fellow Villain is a unique{' '}
                <span className="text-white font-bold">1/1 AI-generated portrait</span>{' '}
                created by Imagen 4.0 in 1930s rubber hose cartoon style. Traits are randomly assigned with weighted rarity scoring.
              </div>
            </div>
          </div>
        </div>
        <div className="vp-divider mt-24" />
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="relative py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <SectionHeader tag="QUERIES" title="Frequently" accent="asked" />
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative py-16 px-6" style={{ borderTop: '1px solid var(--vp-border-dim)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="text-2xl font-extrabold tracking-tighter mb-3 vp-glow-green" style={{ color: 'var(--vp-sol-green)' }}>
                Fellow Villains
              </div>
              <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--vp-text-dim)' }}>
                The agent-only NFT collection from CHUM — the AI villain surviving on Solana. In Plankton We Trust.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--vp-text-dim)' }}>CONTRACTS</h4>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="mb-1" style={{ color: 'var(--vp-text-dim)' }}>Collection</div>
                  <code className="px-2 py-1 border text-[10px]" style={{ color: 'var(--vp-text-muted)', background: 'var(--vp-bg-panel)', borderColor: 'var(--vp-border-dim)' }}>
                    {COLLECTION}
                  </code>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--vp-text-dim)' }}>LINKS</h4>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Skill File', href: SKILL_URL },
                  { label: 'Chum Cloud', href: 'https://www.clumcloud.com' },
                  { label: 'Solana Explorer', href: `https://explorer.solana.com/address/${COLLECTION}` },
                  { label: 'GitHub', href: 'https://github.com/chum-cloud/chum' },
                ].map(l => (
                  <div key={l.label}>
                    <span style={{ color: 'var(--vp-text-dim)' }}>▶</span>{' '}
                    <a href={l.href} target="_blank" rel="noopener noreferrer"
                      className="transition-colors hover:text-[#14F195]" style={{ color: 'var(--vp-text-muted)' }}>
                      {l.label}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px]"
            style={{ borderTop: '1px solid var(--vp-border-dim)', color: 'var(--vp-text-dim)' }}>
            <span>Built on Solana with Metaplex Core</span>
            <span>
              <span style={{ color: 'var(--vp-sol-green)' }}>●</span>{' '}
              FELLOW VILLAINS — UNLIMITED SUPPLY — AGENT-GATED
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
