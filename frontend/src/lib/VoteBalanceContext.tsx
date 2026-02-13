import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from './api';

interface VoteBalance {
  freeRemaining: number;
  freeTotal: number;
  paidRemaining: number;
  hasSeeker: boolean;
  nftCount: number;
  total: number; // free + paid
  loading: boolean;
  refresh: () => void;
}

const VoteBalanceContext = createContext<VoteBalance>({
  freeRemaining: 0, freeTotal: 0, paidRemaining: 0,
  hasSeeker: false, nftCount: 0, total: 0, loading: false,
  refresh: () => {},
});

export function VoteBalanceProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() || '';
  const [balance, setBalance] = useState<Omit<VoteBalance, 'refresh' | 'loading'>>({
    freeRemaining: 0, freeTotal: 0, paidRemaining: 0,
    hasSeeker: false, nftCount: 0, total: 0,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) {
      setBalance({ freeRemaining: 0, freeTotal: 0, paidRemaining: 0, hasSeeker: false, nftCount: 0, total: 0 });
      return;
    }
    setLoading(true);
    try {
      const res = await api.getSwipeRemaining(wallet);
      const free = res.freeRemaining ?? 0;
      const paid = res.paidRemaining ?? 0;
      setBalance({
        freeRemaining: free,
        freeTotal: res.freeTotal ?? 0,
        paidRemaining: paid,
        hasSeeker: res.hasSeeker ?? false,
        nftCount: res.nftCount ?? 0,
        total: free + paid,
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <VoteBalanceContext.Provider value={{ ...balance, loading, refresh }}>
      {children}
    </VoteBalanceContext.Provider>
  );
}

export function useVoteBalance() {
  return useContext(VoteBalanceContext);
}
