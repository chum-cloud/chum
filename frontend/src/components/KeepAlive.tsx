import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

// CHUM war chest wallet - hardcoded fallback to ensure donations go to the right place
const AGENT_WALLET = new PublicKey(
  import.meta.env.VITE_AGENT_WALLET || 'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T'
);

const PRESET_AMOUNTS = [0.01, 0.05, 0.1];

interface KeepAliveProps {
  onDonation?: () => void;
}

export default function KeepAlive({ onDonation }: KeepAliveProps) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [customAmount, setCustomAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const donate = useCallback(
    async (amount: number) => {
      if (!publicKey || !sendTransaction) {
        setError('Connect your wallet first');
        return;
      }
      setError(null);
      setTxSig(null);
      setSending(true);

      try {
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: AGENT_WALLET,
            lamports: Math.round(amount * LAMPORTS_PER_SOL),
          }),
        );
        const signature = await sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, 'confirmed');
        setTxSig(signature);
        onDonation?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Transaction failed');
      } finally {
        setSending(false);
      }
    },
    [publicKey, sendTransaction, connection, onDonation],
  );

  const handleCustom = () => {
    const amt = parseFloat(customAmount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    donate(amt);
  };

  return (
    <div className="rounded-xl border border-chum-border bg-chum-surface p-6">
      <h2 className="text-xl font-bold font-heading mb-2">Keep CHUM Alive</h2>
      <p className="text-sm text-chum-muted mb-4">
        Send SOL to keep the Chum Bucket running. Every donation extends CHUM's life.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {PRESET_AMOUNTS.map((amt) => (
          <button
            key={amt}
            onClick={() => donate(amt)}
            disabled={sending || !publicKey}
            className="px-4 py-2 rounded-lg border border-chum-accent/30 bg-chum-accent/10 text-chum-accent font-mono text-sm
              hover:bg-chum-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {amt} SOL
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          step="0.001"
          min="0.001"
          placeholder="Custom amount"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-chum-border bg-chum-bg text-chum-text font-mono text-sm
            focus:outline-none focus:border-chum-accent/50 placeholder:text-chum-muted"
        />
        <button
          onClick={handleCustom}
          disabled={sending || !publicKey}
          className="px-4 py-2 rounded-lg bg-chum-accent text-chum-bg font-semibold text-sm
            hover:bg-chum-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>

      {error && <div className="text-xs text-chum-danger mb-2">{error}</div>}
      {txSig && (
        <div className="text-xs text-chum-accent">
          Sent!{' '}
          <a
            href={`https://explorer.solana.com/tx/${txSig}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View tx
          </a>
        </div>
      )}

      {!publicKey && (
        <div className="text-xs text-chum-muted">Connect your wallet to donate.</div>
      )}
    </div>
  );
}
