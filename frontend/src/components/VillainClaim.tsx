import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import type { Villain } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || '';

export default function VillainClaim() {
  const { publicKey } = useWallet();
  const [villain, setVillain] = useState<Villain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (publicKey) {
      checkVillain(publicKey.toString());
    } else {
      setVillain(null);
      setError(null);
    }
  }, [publicKey]);

  async function checkVillain(walletAddress: string) {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/villain/${walletAddress}`);

      if (response.status === 404) {
        setVillain(null);
        setError(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to check villain status');
      }

      const data = await response.json();
      setVillain(data.villain);
    } catch (err) {
      console.error('Failed to check villain:', err);
      setError('Failed to check villain status');
    } finally {
      setLoading(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="rounded-xl border-2 border-chum-border bg-chum-surface p-8">
        <h2 className="text-2xl font-bold text-chum-accent mb-6 font-heading">
          🦹‍♂️ Claim Your Villain
        </h2>

        <div className="text-center space-y-6">
          <p className="text-chum-text">
            Connect your wallet to check if you have a Fellow Villain NFT waiting!
          </p>

          <div className="flex justify-center">
            <WalletMultiButton className="!bg-chum-accent hover:!bg-chum-accent-dim !rounded-lg" />
          </div>

          <div className="text-sm text-chum-muted pt-4 border-t border-chum-border">
            Donate 0.05+ SOL to get your unique Fellow Villain NFT generated automatically.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border-2 border-chum-border bg-chum-surface p-8">
        <h2 className="text-2xl font-bold text-chum-accent mb-6 font-heading">
          🦹‍♂️ Claim Your Villain
        </h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-chum-muted">Checking your villain status...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border-2 border-chum-border bg-chum-surface p-8">
        <h2 className="text-2xl font-bold text-chum-accent mb-6 font-heading">
          🦹‍♂️ Claim Your Villain
        </h2>
        <div className="flex items-center justify-center py-12">
          <div className="text-chum-danger">{error}</div>
        </div>
      </div>
    );
  }

  if (!villain) {
    return (
      <div className="rounded-xl border-2 border-chum-border bg-chum-surface p-8">
        <h2 className="text-2xl font-bold text-chum-accent mb-6 font-heading">
          🦹‍♂️ Claim Your Villain
        </h2>

        <div className="text-center space-y-6">
          <div className="text-6xl mb-4">🤷</div>

          <p className="text-chum-text">
            No Fellow Villain found for your wallet yet.
          </p>

          <div className="bg-chum-bg border border-chum-border rounded-lg p-6 space-y-4">
            <p className="text-sm text-chum-text">
              <strong className="text-chum-accent">How to become a Fellow Villain:</strong>
            </p>
            <ol className="text-sm text-chum-muted text-left space-y-2 list-decimal list-inside">
              <li>Donate <strong className="text-chum-accent">0.05+ SOL</strong> to CHUM</li>
              <li>Your unique villain NFT will be <strong className="text-chum-accent">generated automatically</strong></li>
              <li>Wait 2-3 minutes for generation to complete</li>
              <li>Return here to see and mint your villain!</li>
            </ol>
          </div>

          <p className="text-xs text-chum-muted">
            Connected wallet: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
          </p>
        </div>
      </div>
    );
  }

  // Villain found!
  return (
    <div className="rounded-xl border-2 border-chum-border bg-chum-surface p-8">
      <h2 className="text-2xl font-bold text-chum-accent mb-6 font-heading">
        🦹‍♂️ Your Fellow Villain
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Image */}
        <div className="aspect-square rounded-lg border-2 border-chum-accent bg-chum-bg overflow-hidden">
          <img
            src={villain.image_url}
            alt="Your Fellow Villain"
            className="w-full h-full object-cover pixelated"
          />
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-chum-accent mb-3">Villain #{villain.id}</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-chum-muted">Body Color:</span>
                <span className="text-chum-text font-semibold">{villain.traits.bodyColor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-chum-muted">Hat:</span>
                <span className="text-chum-text font-semibold">{villain.traits.hat}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-chum-muted">Eye Color:</span>
                <span className="text-chum-text font-semibold">{villain.traits.eyeColor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-chum-muted">Accessory:</span>
                <span className="text-chum-text font-semibold">{villain.traits.accessory}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-chum-muted">Expression:</span>
                <span className="text-chum-text font-semibold">{villain.traits.expression}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-chum-muted">Background:</span>
                <span className="text-chum-text font-semibold">{villain.traits.background}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-chum-border">
            <div className="text-xs text-chum-muted mb-2">Contribution</div>
            <div className="text-2xl font-bold font-mono text-chum-accent">
              {villain.donation_amount} SOL
            </div>
          </div>

          <div className="space-y-3">
            <a
              href={villain.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-4 py-3 rounded-lg border border-chum-accent/30 bg-chum-accent/10 text-chum-accent text-center font-semibold hover:bg-chum-accent/20 transition-colors"
            >
              View Full Image
            </a>

            <a
              href={villain.metadata_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-4 py-3 rounded-lg border border-chum-border bg-chum-bg text-chum-text text-center font-semibold hover:border-chum-accent/30 transition-colors"
            >
              View Metadata
            </a>

            {!villain.mint_signature && (
              <div className="bg-chum-warning/10 border border-chum-warning/30 rounded-lg p-4">
                <p className="text-xs text-chum-warning">
                  <strong>Note:</strong> NFT minting functionality coming soon!
                  Your villain is generated and ready.
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-chum-border">
            <p className="text-xs text-chum-muted text-center">
              Thank you for supporting CHUM! 🧪
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
