import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config } from '../config';

const connection = new Connection(config.heliusRpcUrl, 'confirmed');

export async function getWalletBalance(): Promise<number> {
  const pubkey = new PublicKey(config.chumWalletAddress);
  const lamports = await connection.getBalance(pubkey);
  return lamports / LAMPORTS_PER_SOL;
}
