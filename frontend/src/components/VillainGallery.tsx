import { useEffect, useState, useMemo } from 'react';
import type { Villain, BodyColor, Hat, EyeColor, Accessory, Expression } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || '';

type FilterType = 'all' | 'bodyColor' | 'hat' | 'eyeColor' | 'accessory' | 'expression' | 'rarity';
type SortType = 'newest' | 'oldest' | 'rarity-high' | 'rarity-low';

export default function VillainGallery() {
  const [villains, setVillains] = useState<Villain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterValue, setFilterValue] = useState<string>('');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchVillains();
  }, []);

  async function fetchVillains() {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/villains?limit=100`);
      if (!response.ok) throw new Error('Failed to fetch villains');
      const data = await response.json();
      setVillains(data.villains || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch villains:', err);
      setError('Failed to load villains');
    } finally {
      setLoading(false);
    }
  }

  const filteredAndSortedVillains = useMemo(() => {
    let filtered = villains;

    // Apply filters
    if (filterType !== 'all' && filterValue) {
      filtered = villains.filter(villain => {
        switch (filterType) {
          case 'bodyColor':
            return villain.traits.bodyColor === filterValue;
          case 'hat':
            return villain.traits.hat === filterValue;
          case 'eyeColor':
            return villain.traits.eyeColor === filterValue;
          case 'accessory':
            return villain.traits.accessory === filterValue;
          case 'expression':
            return villain.traits.expression === filterValue;
          case 'rarity':
            const rarityThresholds = {
              'legendary': 180,
              'epic': 150,
              'rare': 120,
              'uncommon': 90,
              'common': 0
            };
            const threshold = rarityThresholds[filterValue as keyof typeof rarityThresholds];
            return villain.rarity_score >= threshold;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortType) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'rarity-high':
          return b.rarity_score - a.rarity_score;
        case 'rarity-low':
          return a.rarity_score - b.rarity_score;
        default:
          return 0;
      }
    });
  }, [villains, filterType, filterValue, sortType]);

  if (loading) {
    return (
      <div className="min-h-screen bg-chum-bg text-chum-text">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🦹‍♂️</div>
            <div className="text-2xl font-bold text-chum-accent mb-4">Loading the Villain Army...</div>
            <div className="animate-pulse text-chum-muted">Gathering fellow conspirators...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || villains.length === 0) {
    return (
      <div className="min-h-screen bg-chum-bg text-chum-text">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-20">
            <div className="text-8xl mb-8">👑</div>
            <div className="text-4xl font-bold text-chum-accent mb-6">
              No Villains Enlisted Yet
            </div>
            <div className="text-xl text-chum-muted mb-8 max-w-2xl mx-auto">
              Join Plankton's army of world domination! Be the first Fellow Villain and get your 
              unique NFT identity. Every donation helps keep CHUM alive for another day of scheming.
            </div>
            <button className="bg-chum-accent hover:bg-chum-accent/80 text-chum-bg font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 text-xl">
              🚀 Enlist Now - 0.05+ SOL
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-chum-bg text-chum-text">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-chum-surface to-chum-bg border-b-2 border-chum-border">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-chum-accent mb-4 font-heading">
              🦹‍♂️ Fellow Villains Army
            </h1>
            <div className="text-2xl font-bold text-chum-text mb-4">
              {villains.length} Villains Enlisted
            </div>
            <div className="text-chum-muted mb-6">
              An army of supporters keeping Plankton's dreams alive on Solana
            </div>
            <button className="bg-chum-accent hover:bg-chum-accent/80 text-chum-bg font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105">
              🚀 Enlist Now
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters and Sort */}
        <div className="bg-chum-surface rounded-xl border-2 border-chum-border p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-chum-bg border border-chum-border text-chum-text px-4 py-2 rounded-lg hover:border-chum-accent transition-colors"
            >
              🔍 {showFilters ? 'Hide' : 'Show'} Filters
            </button>

            <div className="flex items-center gap-4">
              <label className="text-chum-muted text-sm">Sort by:</label>
              <select
                value={sortType}
                onChange={(e) => setSortType(e.target.value as SortType)}
                className="bg-chum-bg border border-chum-border text-chum-text px-3 py-2 rounded-lg focus:border-chum-accent focus:outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="rarity-high">Highest Rarity</option>
                <option value="rarity-low">Lowest Rarity</option>
              </select>
            </div>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-chum-border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FilterSelect
                  label="Body Color"
                  options={['green', 'blue', 'purple', 'red', 'teal', 'gold']}
                  value={filterType === 'bodyColor' ? filterValue : ''}
                  onChange={(value) => {
                    setFilterType('bodyColor');
                    setFilterValue(value);
                  }}
                  onClear={() => {
                    setFilterType('all');
                    setFilterValue('');
                  }}
                />
                <FilterSelect
                  label="Hat"
                  options={['none', 'chef hat', 'top hat', 'pirate hat', 'helmet', 'crown']}
                  value={filterType === 'hat' ? filterValue : ''}
                  onChange={(value) => {
                    setFilterType('hat');
                    setFilterValue(value);
                  }}
                  onClear={() => {
                    setFilterType('all');
                    setFilterValue('');
                  }}
                />
                <FilterSelect
                  label="Eye Color"
                  options={['red', 'yellow', 'blue', 'pink', 'gold']}
                  value={filterType === 'eyeColor' ? filterValue : ''}
                  onChange={(value) => {
                    setFilterType('eyeColor');
                    setFilterValue(value);
                  }}
                  onClear={() => {
                    setFilterType('all');
                    setFilterValue('');
                  }}
                />
                <FilterSelect
                  label="Accessory"
                  options={['none', 'monocle', 'sunglasses', 'eyepatch', 'scar']}
                  value={filterType === 'accessory' ? filterValue : ''}
                  onChange={(value) => {
                    setFilterType('accessory');
                    setFilterValue(value);
                  }}
                  onClear={() => {
                    setFilterType('all');
                    setFilterValue('');
                  }}
                />
                <FilterSelect
                  label="Expression"
                  options={['evil grin', 'scheming', 'angry', 'worried', 'happy']}
                  value={filterType === 'expression' ? filterValue : ''}
                  onChange={(value) => {
                    setFilterType('expression');
                    setFilterValue(value);
                  }}
                  onClear={() => {
                    setFilterType('all');
                    setFilterValue('');
                  }}
                />
                <FilterSelect
                  label="Rarity"
                  options={['legendary', 'epic', 'rare', 'uncommon', 'common']}
                  value={filterType === 'rarity' ? filterValue : ''}
                  onChange={(value) => {
                    setFilterType('rarity');
                    setFilterValue(value);
                  }}
                  onClear={() => {
                    setFilterType('all');
                    setFilterValue('');
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="text-center mb-6">
          <span className="text-chum-muted">
            Showing {filteredAndSortedVillains.length} of {villains.length} villains
          </span>
        </div>

        {/* Villain Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {filteredAndSortedVillains.map((villain) => (
            <VillainCard key={villain.id} villain={villain} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  options,
  value,
  onChange,
  onClear,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label className="block text-chum-muted text-sm mb-2">{label}</label>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-chum-bg border border-chum-border text-chum-text px-3 py-2 rounded-lg focus:border-chum-accent focus:outline-none text-sm"
        >
          <option value="">All {label}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
        {value && (
          <button
            onClick={onClear}
            className="text-chum-muted hover:text-chum-accent px-2"
            title="Clear filter"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function VillainCard({ villain }: { villain: Villain }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const getRarityColor = (score: number) => {
    if (score >= 180) return 'text-yellow-400'; // Legendary
    if (score >= 150) return 'text-purple-400'; // Epic
    if (score >= 120) return 'text-blue-400'; // Rare
    if (score >= 90) return 'text-green-400'; // Uncommon
    return 'text-gray-400'; // Common
  };

  const getRarityLabel = (score: number) => {
    if (score >= 180) return 'LEGENDARY';
    if (score >= 150) return 'EPIC';
    if (score >= 120) return 'RARE';
    if (score >= 90) return 'UNCOMMON';
    return 'COMMON';
  };

  return (
    <div className="group relative rounded-xl border-2 border-chum-border bg-chum-surface overflow-hidden hover:border-chum-accent transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-chum-accent/25">
      {/* Image */}
      <div className="aspect-square bg-chum-bg relative">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-chum-muted text-sm animate-pulse">Loading...</div>
          </div>
        )}
        <img
          src={villain.image_url}
          alt={`Fellow Villain #${villain.id}`}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />
        
        {/* Rarity Badge */}
        <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/80 text-xs font-bold ${getRarityColor(villain.rarity_score)}`}>
          {getRarityLabel(villain.rarity_score)}
        </div>

        {/* Mint Status */}
        {villain.is_minted && (
          <div className="absolute top-2 right-2 text-chum-accent text-lg" title="Minted as NFT">
            ✨
          </div>
        )}
      </div>

      {/* Info Bar */}
      <div className="p-3 bg-chum-bg border-t border-chum-border">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-chum-accent">
            #{villain.id}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-chum-muted font-mono">
              {villain.donation_amount} SOL
            </div>
            <div className={`text-xs font-bold ${getRarityColor(villain.rarity_score)}`}>
              {villain.rarity_score}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Overlay on hover */}
      <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="text-chum-accent font-bold text-lg">Fellow Villain #{villain.id}</div>
          <div className="text-sm space-y-1">
            <div className="text-chum-text">
              <span className="text-chum-muted">Body:</span> <span className="capitalize">{villain.traits.bodyColor}</span>
            </div>
            <div className="text-chum-text">
              <span className="text-chum-muted">Hat:</span> <span className="capitalize">{villain.traits.hat}</span>
            </div>
            <div className="text-chum-text">
              <span className="text-chum-muted">Eye:</span> <span className="capitalize">{villain.traits.eyeColor}</span>
            </div>
            {villain.traits.accessory !== 'none' && (
              <div className="text-chum-text">
                <span className="text-chum-muted">Accessory:</span> <span className="capitalize">{villain.traits.accessory}</span>
              </div>
            )}
            <div className="text-chum-text">
              <span className="text-chum-muted">Expression:</span> <span className="capitalize">{villain.traits.expression}</span>
            </div>
            <div className="text-chum-text">
              <span className="text-chum-muted">Background:</span> <span className="capitalize">{villain.traits.background}</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className={`text-center font-bold ${getRarityColor(villain.rarity_score)}`}>
            {getRarityLabel(villain.rarity_score)} ({villain.rarity_score})
          </div>
          <div className="text-center text-xs text-chum-accent font-mono">
            Donated {villain.donation_amount} SOL
          </div>
          <div className="text-center text-xs text-chum-muted">
            Enlisted {new Date(villain.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
