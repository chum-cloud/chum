import { useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import Header from '../components/Header';
import { POOL, randomPiece, type PoolPiece } from '../lib/pool';
import { api } from '../lib/api';
import { signAndSend } from '../lib/tx';

type Stage = 'idle' | 'generating' | 'ready' | 'minting' | 'success' | 'error';

export default function MintPage() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [piece, setPiece] = useState<PoolPiece>(POOL[0]);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [mintedAsset, setMintedAsset] = useState('');
  const [mintedSig, setMintedSig] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const generate = () => {
    setStage('generating');
    setError('');
    setTimeout(() => {
      const p = randomPiece();
      setPiece(p);
      setStage('ready');
      // Reset video
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch(() => {});
      }
    }, 600);
  };

  const mint = async () => {
    if (!publicKey || !signTransaction) return;
    setStage('minting');
    setError('');
    try {
      const wallet = publicKey.toBase58();
      const name = `CHUM #${piece.piece_id.slice(-4)}`;
      const uri = piece.mp4_url;

      const { transaction, assetAddress } = await api.mint(wallet, name, uri);
      const signature = await signAndSend(transaction, signTransaction, connection);
      await api.confirmMint(assetAddress, signature);

      setMintedAsset(assetAddress);
      setMintedSig(signature);
      setStage('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mint failed');
      setStage('error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-[56px]">
      <Header title="CHUM: Reanimation" />

      <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-[480px] mx-auto w-full">
        {/* Video Preview */}
        <div className="w-full aspect-square bg-chum-surface border border-chum-border relative overflow-hidden mb-6">
          {stage === 'generating' ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-2 border-chum-border border-t-chum-text animate-spin" />
            </div>
          ) : stage === 'success' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
              <div className="text-4xl">✓</div>
              <p className="font-mono text-sm text-chum-text text-center">MINTED SUCCESSFULLY</p>
              <a
                href={`https://explorer.solana.com/address/${mintedAsset}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-chum-accent-dim underline"
              >
                View on Explorer →
              </a>
              <p className="font-mono text-[10px] text-chum-muted break-all">{mintedSig}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={piece.mp4_url}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Info */}
        <div className="w-full mb-4 flex items-center justify-between px-1">
          <span className="font-mono text-xs text-chum-muted uppercase">{piece.collection}</span>
          <span className="font-mono text-xs text-chum-accent-dim">{piece.piece_id.slice(-8)}</span>
        </div>

        {/* Buttons */}
        <div className="w-full space-y-3">
          {stage !== 'success' && (
            <button
              onClick={generate}
              disabled={stage === 'generating' || stage === 'minting'}
              className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {stage === 'generating' ? 'GENERATING...' : 'GENERATE'}
            </button>
          )}

          {(stage === 'ready' || stage === 'error') && (
            <button
              onClick={mint}
              disabled={!publicKey || !signTransaction}
              className="w-full min-h-[48px] bg-chum-text text-chum-bg font-mono text-sm uppercase tracking-wider hover:bg-chum-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!publicKey ? 'CONNECT WALLET' : 'MINT — 0.1 SOL'}
            </button>
          )}

          {stage === 'minting' && (
            <div className="w-full min-h-[48px] border border-chum-border flex items-center justify-center">
              <span className="font-mono text-xs text-chum-muted animate-pulse">SIGNING TRANSACTION...</span>
            </div>
          )}

          {stage === 'success' && (
            <button
              onClick={() => { setStage('idle'); generate(); }}
              className="w-full min-h-[48px] border border-chum-border text-chum-text font-mono text-sm uppercase tracking-wider hover:bg-chum-text hover:text-chum-bg transition-colors"
            >
              MINT ANOTHER
            </button>
          )}

          {error && (
            <p className="font-mono text-xs text-chum-danger text-center px-2">{error}</p>
          )}
        </div>
      </main>
    </div>
  );
}
