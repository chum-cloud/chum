import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import App from './App';
import './index.css';
import '@solana/wallet-adapter-react-ui/styles.css';

const RPC_ENDPOINT = import.meta.env.VITE_SOLANA_RPC || 'https://mainnet.helius-rpc.com/?api-key=06cda3a9-32f3-4ad9-a203-9d7274299837';

function Root() {
  const endpoint = useMemo(() => RPC_ENDPOINT || clusterApiUrl('mainnet-beta'), []);
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
