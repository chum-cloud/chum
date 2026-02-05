import { useEffect, useState } from 'react';
import type { Villain } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function VillainGallery() {
  const [villains, setVillains] = useState<Villain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVillains();
  }, []);

  async function fetchVillains() {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/villains?limit=50`);
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

  if (loading) {
    return (
      <div className="rounded-xl border-2 border-chum-border bg-chum-surface p-8">
        <h2 className="text-2xl font-bold text-chum-accent mb-6 font-heading">
          🦹‍♂️ Fellow Villains Army
        </h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-chum-muted">Loading villains...</div>
        </div>
      </div>
    );
  }

  if (error || villains.length === 0) {
    return (
      <div className="rounded-xl border-2 border-chum-border bg-chum-surface p-8">
        <h2 className="text-2xl font-bold text-chum-accent mb-6 font-heading">
          🦹‍♂️ Fellow Villains Army
        </h2>
        <div className="text-center py-12">
          <div className="text-6xl mb-6">👑</div>
          <div className="text-xl text-chum-accent mb-4 font-bold">
            No villains yet — be the first to enlist!
          </div>
          <div className="text-chum-muted mb-6 max-w-md mx-auto">
            Join Plankton's army of world domination. Every donation makes you a Fellow Villain 
            with your own unique NFT identity.
          </div>
          <div className="text-sm text-chum-accent font-mono border border-chum-border rounded-lg px-4 py-2 inline-block">
            Enlistment Fee: 0.05+ SOL
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-chum-border bg-chum-surface p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-chum-accent font-heading">
          🦹‍♂️ Fellow Villains Army
        </h2>
        <div className="text-sm text-chum-muted">
          {villains.length} villain{villains.length !== 1 ? 's' : ''} recruited
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {villains.map((villain) => (
          <VillainCard key={villain.id} villain={villain} />
        ))}
      </div>
    </div>
  );
}

function VillainCard({ villain }: { villain: Villain }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="group relative rounded-lg border border-chum-border bg-chum-bg overflow-hidden hover:border-chum-accent transition-all duration-300 hover:scale-105">
      {/* Image */}
      <div className="aspect-square bg-chum-bg relative">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-chum-muted text-xs">Loading...</div>
          </div>
        )}
        <img
          src={villain.image_url}
          alt={`Villain #${villain.id}`}
          className={`w-full h-full object-cover pixelated transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
        />
      </div>

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-between">
        <div className="text-xs space-y-1">
          <div className="text-chum-accent font-bold">#{villain.id}</div>
          <div className="text-chum-text">
            <span className="text-chum-muted">Body:</span> {villain.traits.bodyColor}
          </div>
          <div className="text-chum-text">
            <span className="text-chum-muted">Hat:</span> {villain.traits.hat}
          </div>
          <div className="text-chum-text">
            <span className="text-chum-muted">Eye:</span> {villain.traits.eyeColor}
          </div>
          {villain.traits.accessory !== 'none' && (
            <div className="text-chum-text">
              <span className="text-chum-muted">Accessory:</span> {villain.traits.accessory}
            </div>
          )}
          <div className="text-chum-text">
            <span className="text-chum-muted">Mood:</span> {villain.traits.expression}
          </div>
        </div>
        <div className="text-xs text-chum-accent font-mono">
          {villain.donation_amount} SOL
        </div>
      </div>
    </div>
  );
}
