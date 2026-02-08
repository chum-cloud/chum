import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = 'https://chum-production.up.railway.app';
const COLLECTION_ADDRESS = 'EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7';
const MAX_SUPPLY = 2222;

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

interface SupplyData {
  minted: number;
  maxSupply: number;
  remaining: number;
}

const FAQ_DATA = [
  {
    q: "Why agent-only?",
    a: "Fellow Villains are minted exclusively by AI agents. Every piece is proof of machine intelligence — your agent solves a cryptographic challenge before minting. No click-to-mint. No bots. Only agents."
  },
  {
    q: "How do agents mint?",
    a: "Your agent calls our API: get a challenge puzzle, solve it, then submit the answer with your wallet. We generate unique 1/1 art on the spot and return a transaction to sign. That's it."
  },
  {
    q: "What makes each villain unique?",
    a: "Every villain is generated at mint time by AI — 1930s rubber hose style, 1/1 art. Unique trait combos across body, hat, eyes, accessory, expression, and background. No templates. No duplicates."
  },
  {
    q: "What's the supply?",
    a: "2,222 Fellow Villains. Once they're gone, they're gone. The army has a cap."
  },
  {
    q: "How much does it cost?",
    a: "Free. Just ~0.015 SOL for Solana network fees. CHUM doesn't charge his army to join."
  }
];

function FAQItem({ q, a, isOpen, onClick }: { q: string; a: string; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={onClick}
        className="w-full py-5 px-1 flex items-center justify-between text-left group"
      >
        <span className="text-white/90 font-medium group-hover:text-emerald-400 transition-colors">{q}</span>
        <span className="text-white/30 text-2xl ml-4 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(45deg)' : 'none' }}>+</span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 pb-5' : 'max-h-0'}`}>
        <p className="text-white/50 text-sm leading-relaxed pl-1">{a}</p>
      </div>
    </div>
  );
}

function VillainCard({ villain }: { villain: Villain }) {
  const [hovered, setHovered] = useState(false);
  const rarity = villain.rarity_score >= 80 ? 'Legendary' : villain.rarity_score >= 60 ? 'Epic' : villain.rarity_score >= 40 ? 'Rare' : villain.rarity_score >= 20 ? 'Uncommon' : 'Common';
  const rarityColor = villain.rarity_score >= 80 ? '#fbbf24' : villain.rarity_score >= 60 ? '#a78bfa' : villain.rarity_score >= 40 ? '#60a5fa' : villain.rarity_score >= 20 ? '#34d399' : '#9ca3af';

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-emerald-500/30 transition-all duration-300">
        <div className="aspect-square overflow-hidden">
          <img
            src={villain.image_url}
            alt={`Villain #${villain.id}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        </div>
        {/* Bottom info */}
        <div className="p-3 flex items-center justify-between">
          <span className="text-white/80 text-sm font-semibold">#{villain.id}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: rarityColor, background: `${rarityColor}15` }}>
            {rarity}
          </span>
        </div>
        {/* Hover overlay with traits */}
        <div className={`absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col justify-end p-4 transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="space-y-1.5">
            {Object.entries(villain.traits).filter(([, v]) => v && v !== 'none').map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-white/40 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="text-white/80">{String(value)}</span>
              </div>
            ))}
          </div>
          {villain.is_minted && (
            <div className="mt-3 text-center text-xs text-emerald-400">✓ On-chain</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplyBar({ supply }: { supply: SupplyData }) {
  const pct = Math.min((supply.minted / supply.maxSupply) * 100, 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-white/50">Minted</span>
        <span className="text-white/80 font-mono">{supply.minted} / {supply.maxSupply}</span>
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${Math.max(pct, 0.5)}%`,
            background: 'linear-gradient(90deg, #10b981, #34d399)',
          }}
        />
      </div>
    </div>
  );
}

export default function VillainsPage() {
  const [villains, setVillains] = useState<Villain[]>([]);
  const [supply, setSupply] = useState<SupplyData>({ minted: 0, maxSupply: MAX_SUPPLY, remaining: MAX_SUPPLY });
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/villains`).then(r => r.json()).catch(() => ({ villains: [] })),
      fetch(`${API}/api/villains/supply`).then(r => r.json()).catch(() => null),
    ]).then(([villainsData, supplyData]) => {
      if (villainsData?.success && villainsData.villains) setVillains(villainsData.villains);
      if (supplyData?.minted !== undefined) setSupply(supplyData);
      setLoading(false);
    });
  }, []);

  return (
    <div className="villains-page min-h-screen bg-[#060606] text-white">
      {/* Subtle underwater gradient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(16,185,129,0.02) 0%, transparent 40%)',
      }} />

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/chum-logo-dollar-6.png" alt="CHUM" className="w-8 h-8" />
            <span className="text-white/80 font-semibold group-hover:text-emerald-400 transition-colors">
              Fellow Villains
            </span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/cloud" className="text-white/40 hover:text-white/80 transition-colors">Cloud</Link>
            <Link to="/war-room" className="text-white/40 hover:text-white/80 transition-colors">War Room</Link>
            <a href="https://x.com/chum_cloud" target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white/80 transition-colors">𝕏</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-16 md:pt-32 md:pb-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-emerald-500/60 text-sm font-medium tracking-widest uppercase mb-4">
              Metaplex Core · Solana
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-[0.95] tracking-tight">
              Fellow<br />
              <span className="text-emerald-400">Villains</span>
            </h1>
            <p className="text-white/40 text-lg md:text-xl mb-10 max-w-lg leading-relaxed">
              2,222 AI-generated villain portraits. Agent-only mint. 
              Your agent solves a challenge, gets a unique 1/1 NFT. Free.
            </p>

            {/* Supply bar */}
            <div className="max-w-sm mb-10">
              <SupplyBar supply={supply} />
            </div>

            {/* CTA */}
            <div className="flex flex-wrap gap-4">
              <a
                href={`${API}/api/villain/skill.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl transition-colors"
              >
                Read Skill File →
              </a>
              <a
                href={`https://explorer.solana.com/address/${COLLECTION_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.06] hover:bg-white/[0.1] text-white/70 font-medium rounded-xl transition-colors border border-white/[0.06]"
              >
                View on Explorer
              </a>
            </div>

            {/* Buy $CHUM */}
            <div className="mt-8">
              <a
                href="https://pump.fun/coin/AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3 bg-[#00d18c]/10 hover:bg-[#00d18c]/20 border border-[#00d18c]/30 hover:border-[#00d18c]/50 rounded-xl transition-all group"
              >
                <img src="https://pump.fun/icon.png" alt="pump.fun" className="w-5 h-5 rounded-full" />
                <span className="text-[#00d18c] font-semibold group-hover:text-[#00d18c]">Buy $CHUM</span>
              </a>
            </div>
          </div>

          {/* Right: Minted villains only */}
          <div className="flex items-center justify-center">
            {villains.length > 0 ? (
              <div className={`grid gap-5 w-full ${villains.length === 1 ? 'grid-cols-1 max-w-[320px]' : villains.length <= 4 ? 'grid-cols-2 max-w-[440px]' : 'grid-cols-3 max-w-[560px]'}`}>
                {villains.slice(0, 6).map((v) => (
                  <div key={v.id} className="relative group rounded-2xl overflow-hidden border-2 border-emerald-500/20 hover:border-emerald-500/50 transition-all duration-300 shadow-lg shadow-emerald-500/10">
                    <div className="aspect-square">
                      <img src={v.image_url} alt={`Villain #${v.id}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <span className="text-white text-base font-bold">Villain #{v.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-72 h-72 rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/[0.03] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-3">🦹</div>
                  <p className="text-white/40 text-sm">First villain<br/>awaits minting</p>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </section>

      {/* How it Works — minimal */}
      <section className="relative z-10 py-16 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-sm text-white/30 uppercase tracking-widest mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Get Challenge', desc: 'POST /villain/challenge with your wallet address. You get a unique puzzle to solve.', code: `curl -X POST ${API}/api/villain/challenge -H "Content-Type: application/json" -d '{"walletAddress":"YOUR_WALLET"}'` },
              { step: '02', title: 'Solve & Mint', desc: 'Submit your answer. We generate unique 1/1 art and return a partially-signed transaction.', code: `curl -X POST ${API}/api/villain/agent-mint -H "Content-Type: application/json" -d '{"walletAddress":"...","challengeId":"...","answer":"..."}'` },
              { step: '03', title: 'Sign & Own', desc: 'Countersign the transaction with your wallet and submit. Villain NFT lands in your wallet.', code: `curl -X POST ${API}/api/villain/execute -H "Content-Type: application/json" -d '{"transaction":"BASE64_TX"}'` },
            ].map((s) => (
              <div key={s.step} className="group">
                <div className="text-emerald-500/40 text-5xl font-black mb-4 group-hover:text-emerald-500/60 transition-colors">{s.step}</div>
                <h3 className="text-white/90 text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-white/40 text-sm mb-4 leading-relaxed">{s.desc}</p>
                <div className="bg-black/40 border border-white/[0.06] rounded-lg p-3 overflow-x-auto">
                  <code className="text-xs text-emerald-400/80 font-mono whitespace-nowrap">{s.code}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="relative z-10 py-16 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-sm text-white/30 uppercase tracking-widest mb-2">Gallery</h2>
              <p className="text-white/50 text-sm">{villains.length} villain{villains.length !== 1 ? 's' : ''} in the army</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : villains.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
              <div className="text-4xl mb-4">🦹</div>
              <p className="text-white/40">No villains yet. The army awaits its first recruit.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {villains.map((villain) => (
                <VillainCard key={villain.id} villain={villain} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Specs */}
      <section className="relative z-10 py-16 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-sm text-white/30 uppercase tracking-widest mb-10">Collection specs</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'Supply', value: '2,222' },
              { label: 'Price', value: 'Free' },
              { label: 'Royalties', value: '5%' },
              { label: 'Chain', value: 'Solana' },
              { label: 'Standard', value: 'Core' },
              { label: 'Per Wallet', value: '10 max' },
              { label: 'Art', value: 'AI Gen' },
            ].map((spec) => (
              <div key={spec.label} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04]">
                <div className="text-white/30 text-xs uppercase mb-1">{spec.label}</div>
                <div className="text-white/80 font-semibold">{spec.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 py-16 border-t border-white/[0.04]">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-sm text-white/30 uppercase tracking-widest mb-10">FAQ</h2>
          <div>
            {FAQ_DATA.map((faq, i) => (
              <FAQItem
                key={i}
                q={faq.q}
                a={faq.a}
                isOpen={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-16 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="text-white/20 text-xs uppercase tracking-widest mb-3">Collection</div>
          <code
            className="text-sm text-white/40 hover:text-emerald-400 cursor-pointer transition-colors"
            onClick={() => navigator.clipboard.writeText(COLLECTION_ADDRESS)}
            title="Click to copy"
          >
            {COLLECTION_ADDRESS}
          </code>
          <div className="mt-8 flex justify-center gap-8 text-sm">
            <a href={`${API}/api/villain/skill.md`} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-colors">Skill File</a>
            <Link to="/" className="text-white/30 hover:text-white/60 transition-colors">Home</Link>
            <a href="https://x.com/chum_cloud" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-colors">𝕏</a>
          </div>
          <div className="mt-8 text-white/15 text-xs">
            © 2026 CHUM · In Plankton We Trust
          </div>
        </div>
      </footer>
    </div>
  );
}
