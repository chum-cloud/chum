import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Header({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-chum-border">
      <h1 className="font-heading text-sm uppercase tracking-widest text-chum-text">{title}</h1>
      <WalletMultiButton />
    </header>
  );
}
