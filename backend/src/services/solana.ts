import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config } from '../config';

const connection = new Connection(config.heliusRpcUrl, 'confirmed');

export async function getWalletBalance(): Promise<number> {
  const pubkey = new PublicKey(config.chumWalletAddress);
  const lamports = await connection.getBalance(pubkey);
  return lamports / LAMPORTS_PER_SOL;
}

export interface RecentTransaction {
  signature: string;
  sender: string;
  amount: number;
  timestamp: number;
}

export async function getRecentTransactions(limit: number = 10): Promise<RecentTransaction[]> {
  try {
    const pubkey = new PublicKey(config.chumWalletAddress);
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit });

    const transactions: RecentTransaction[] = [];

    for (const signatureInfo of signatures) {
      try {
        const tx = await connection.getParsedTransaction(signatureInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta || tx.meta.err) continue;

        // Find transfers to our wallet
        const preBalances = tx.meta.preBalances;
        const postBalances = tx.meta.postBalances;
        const accountKeys = tx.transaction.message.accountKeys;

        // Find our account index
        const ourIndex = accountKeys.findIndex(
          (key) => key.pubkey.toString() === config.chumWalletAddress
        );

        if (ourIndex === -1) continue;

        const balanceChange = postBalances[ourIndex] - preBalances[ourIndex];

        // Only care about incoming transfers (positive balance change)
        if (balanceChange > 0) {
          // Find the sender (first account that lost money)
          let senderIndex = -1;
          for (let i = 0; i < preBalances.length; i++) {
            if (postBalances[i] < preBalances[i]) {
              senderIndex = i;
              break;
            }
          }

          if (senderIndex !== -1) {
            transactions.push({
              signature: signatureInfo.signature,
              sender: accountKeys[senderIndex].pubkey.toString(),
              amount: balanceChange / LAMPORTS_PER_SOL,
              timestamp: signatureInfo.blockTime || 0,
            });
          }
        }
      } catch (err) {
        console.error(`[SOLANA] Failed to parse transaction ${signatureInfo.signature}:`, err);
      }
    }

    return transactions;
  } catch (error) {
    console.error('[SOLANA] Failed to fetch recent transactions:', error);
    return [];
  }
}
