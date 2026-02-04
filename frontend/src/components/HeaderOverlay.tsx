import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function HeaderOverlay() {
  return (
    <div className="absolute top-0 left-0 right-0 z-30" style={{ pointerEvents: 'none' }}>
      {/* Gradient fade for readability */}
      <div
        className="absolute inset-0"
        style={{
          height: 80,
          background: 'linear-gradient(180deg, rgba(12,15,20,0.6) 0%, rgba(12,15,20,0.2) 60%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />
      <div className="relative flex items-center justify-between px-4 sm:px-6 py-4" style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold font-heading text-chum-accent">$CHUM</span>
          <span className="text-xs text-chum-muted hidden sm:inline">Keep the Plankton Alive</span>
        </div>
        <WalletMultiButton />
      </div>
    </div>
  );
}
