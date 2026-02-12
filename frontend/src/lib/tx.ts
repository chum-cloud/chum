import { VersionedTransaction, Connection } from '@solana/web3.js';

export async function signAndSend(
  base64Tx: string,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
  connection: Connection,
): Promise<string> {
  const bytes = Uint8Array.from(atob(base64Tx), c => c.charCodeAt(0));
  const tx = VersionedTransaction.deserialize(bytes);
  const signed = await signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  // Wait for confirmation
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
}

export function truncateWallet(addr: string): string {
  if (!addr || addr.length < 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}
