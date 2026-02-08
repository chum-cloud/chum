import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useConnection } from '@solana/wallet-adapter-react';
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const API = import.meta.env.VITE_API_URL || 'https://chum-production.up.railway.app';
const CHUM_WALLET = 'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T';
const MINT_PRICE = 0.05; // SOL

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

function getRarityLabel(score: number): { label: string; color: string } {
  if (score >= 200) return { label: 'Legendary', color: '#FFD700' };
  if (score >= 160) return { label: 'Epic', color: '#A855F7' };
  if (score >= 120) return { label: 'Rare', color: '#3B82F6' };
  if (score >= 80) return { label: 'Uncommon', color: '#22C55E' };
  return { label: 'Common', color: '#9CA3AF' };
}

function TraitBadge({ label, value }: { label: string; value: string }) {
  if (value === 'none') return null;
  return (
    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-white/10 text-gray-300 mr-1 mb-1">
      {label}: {value}
    </span>
  );
}

function VillainCard({ villain, onClick }: { villain: Villain; onClick: () => void }) {
  const rarity = getRarityLabel(villain.rarity_score);
  return (
    <div
      onClick={onClick}
      className="bg-gray-900/80 border border-gray-700 rounded-xl overflow-hidden cursor-pointer hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 group"
    >
      <div className="aspect-square overflow-hidden bg-black">
        <img
          src={villain.image_url}
          alt={`Fellow Villain #${villain.id}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white font-bold text-sm">Villain #{villain.id}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: rarity.color, border: `1px solid ${rarity.color}40` }}>
            {rarity.label}
          </span>
        </div>
        <div className="flex flex-wrap mt-1">
          <TraitBadge label="Body" value={villain.traits.bodyColor} />
          <TraitBadge label="Hat" value={villain.traits.hat} />
          <TraitBadge label="Eye" value={villain.traits.eyeColor} />
          <TraitBadge label="Acc" value={villain.traits.accessory} />
        </div>
        {villain.is_minted && (
          <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
            ✓ Minted
          </div>
        )}
      </div>
    </div>
  );
}

function MintWidget() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [step, setStep] = useState<'idle' | 'generating' | 'ready' | 'minting' | 'done' | 'error'>('idle');
  const [villain, setVillain] = useState<Villain | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = useCallback(async () => {
    if (!publicKey) return;
    setStep('generating');
    setError('');

    try {
      // Step 1: Generate villain art
      const genRes = await fetch(`${API}/api/villain/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toString() }),
      });
      const genData = await genRes.json();
      if (!genData.success) throw new Error(genData.error || 'Generation failed');

      setVillain(genData.villain);
      setStep('ready');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  }, [publicKey]);

  const handleMint = useCallback(async () => {
    if (!publicKey || !villain || !sendTransaction) return;
    setStep('minting');
    setError('');

    try {
      // Send 0.05 SOL to CHUM wallet
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(CHUM_WALLET),
          lamports: MINT_PRICE * LAMPORTS_PER_SOL,
        })
      );

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Confirm mint
      await fetch(`${API}/api/villain/${villain.id}/confirm-mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mintSignature: signature,
          assetAddress: '',
        }),
      });

      setStep('done');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  }, [publicKey, villain, sendTransaction, connection]);

  const reset = () => {
    setStep('idle');
    setVillain(null);
    setError('');
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-green-900/30 border border-green-500/30 rounded-2xl p-6 md:p-8 max-w-lg mx-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 text-center">
        🦹 Enlist as a Fellow Villain
      </h2>
      <p className="text-gray-400 text-center mb-6 text-sm">
        Mint your unique 1/1 villain PFP. Join CHUM's army for world domination.
      </p>

      {!connected ? (
        <div className="text-center">
          <p className="text-gray-400 mb-4">Connect your wallet to begin</p>
          <WalletMultiButton className="!bg-green-600 hover:!bg-green-700 !rounded-xl" />
        </div>
      ) : step === 'idle' ? (
        <div className="text-center">
          <div className="bg-black/40 rounded-xl p-4 mb-4">
            <div className="text-3xl mb-2">🫙</div>
            <p className="text-green-400 font-bold text-lg">{MINT_PRICE} SOL</p>
            <p className="text-gray-500 text-xs">+ ~0.015 SOL rent</p>
          </div>
          <button
            onClick={handleGenerate}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors text-lg"
          >
            Mint My Villain
          </button>
          <p className="text-gray-600 text-xs mt-2">Unique traits generated for your wallet</p>
        </div>
      ) : step === 'generating' ? (
        <div className="text-center py-8">
          <div className="animate-spin text-4xl mb-4">🧪</div>
          <p className="text-green-400 font-semibold">Minting your villain identity...</p>
          <p className="text-gray-500 text-sm mt-1">This takes ~10 seconds</p>
        </div>
      ) : step === 'ready' && villain ? (
        <div className="text-center">
          <div className="rounded-xl overflow-hidden mb-4 max-w-xs mx-auto border-2 border-green-500/50">
            <img src={villain.image_url} alt="Your Villain" className="w-full" />
          </div>
          <div className="mb-4">
            <p className="text-white font-bold">Fellow Villain #{villain.id}</p>
            <p className="text-sm" style={{ color: getRarityLabel(villain.rarity_score).color }}>
              {getRarityLabel(villain.rarity_score).label} — Score: {villain.rarity_score}
            </p>
            <div className="flex flex-wrap justify-center gap-1 mt-2">
              <TraitBadge label="Body" value={villain.traits.bodyColor} />
              <TraitBadge label="Hat" value={villain.traits.hat} />
              <TraitBadge label="Eye" value={villain.traits.eyeColor} />
              <TraitBadge label="Acc" value={villain.traits.accessory} />
              <TraitBadge label="Exp" value={villain.traits.expression} />
            </div>
          </div>
          <button
            onClick={handleMint}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors text-lg"
          >
            Mint for {MINT_PRICE} SOL
          </button>
        </div>
      ) : step === 'minting' ? (
        <div className="text-center py-8">
          <div className="animate-pulse text-4xl mb-4">⚡</div>
          <p className="text-green-400 font-semibold">Minting your villain...</p>
          <p className="text-gray-500 text-sm mt-1">Confirm the transaction in your wallet</p>
        </div>
      ) : step === 'done' ? (
        <div className="text-center py-4">
          <div className="text-5xl mb-4">🦹</div>
          <p className="text-green-400 font-bold text-xl mb-2">Welcome to the army, soldier!</p>
          <p className="text-gray-400 text-sm mb-4">
            Your Fellow Villain NFT has been minted. Check your wallet.
          </p>
          <p className="text-green-300 text-xs italic">"In Plankton We Trust."</p>
          <button
            onClick={reset}
            className="mt-4 text-gray-500 hover:text-gray-300 text-sm underline"
          >
            Mint another
          </button>
        </div>
      ) : step === 'error' ? (
        <div className="text-center py-4">
          <div className="text-4xl mb-3">💀</div>
          <p className="text-red-400 font-semibold mb-2">Something went wrong</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={reset}
            className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-xl transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function VillainGallery() {
  const [villains, setVillains] = useState<Villain[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Villain | null>(null);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<'newest' | 'rarity'>('newest');

  useEffect(() => {
    fetch(`${API}/api/villains?limit=100`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setVillains(d.villains);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = villains
    .filter((v) => {
      if (filter === 'all') return true;
      if (filter === 'legendary') return v.rarity_score >= 200;
      if (filter === 'epic') return v.rarity_score >= 160 && v.rarity_score < 200;
      if (filter === 'rare') return v.rarity_score >= 120 && v.rarity_score < 160;
      return v.rarity_score < 120;
    })
    .sort((a, b) =>
      sort === 'rarity'
        ? b.rarity_score - a.rarity_score
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-green-900/40 to-transparent">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <a href="/" className="text-gray-500 hover:text-gray-300 text-sm mb-4 inline-block">
            ← Back to HQ
          </a>
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            🦹 Fellow Villains
          </h1>
          <p className="text-gray-400 text-lg">
            {villains.length} villains enlisted in CHUM's army
          </p>
        </div>
      </div>

      {/* Mint Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <MintWidget />
      </div>

      {/* Gallery */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 className="text-2xl font-bold">The Army</h2>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300"
            >
              <option value="all">All Rarities</option>
              <option value="legendary">Legendary</option>
              <option value="epic">Epic</option>
              <option value="rare">Rare</option>
              <option value="common">Common</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'newest' | 'rarity')}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300"
            >
              <option value="newest">Newest</option>
              <option value="rarity">Rarity</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin text-4xl mb-4">🧪</div>
            <p className="text-gray-500">Loading the army...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">👆</div>
            <p className="text-gray-400 text-lg">No villains yet. Be the first to enlist!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((v) => (
              <VillainCard key={v.id} villain={v} onClick={() => setSelected(v)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={selected.image_url} alt={`Villain #${selected.id}`} className="w-full" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-white">Fellow Villain #{selected.id}</h3>
                <span
                  className="text-sm font-semibold px-3 py-1 rounded-full"
                  style={{
                    color: getRarityLabel(selected.rarity_score).color,
                    border: `1px solid ${getRarityLabel(selected.rarity_score).color}`,
                  }}
                >
                  {getRarityLabel(selected.rarity_score).label}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Body</span>
                  <span className="text-white capitalize">{selected.traits.bodyColor}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Hat</span>
                  <span className="text-white capitalize">{selected.traits.hat}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Eye</span>
                  <span className="text-white capitalize">{selected.traits.eyeColor}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Accessory</span>
                  <span className="text-white capitalize">{selected.traits.accessory}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Expression</span>
                  <span className="text-white capitalize">{selected.traits.expression}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Rarity Score</span>
                  <span className="text-white">{selected.rarity_score}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-gray-600 text-xs truncate">
                  Owner: {selected.wallet_address}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
