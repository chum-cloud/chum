import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  port: parseInt(optional('PORT', '3001'), 10),

  apiBaseUrl: optional('API_BASE_URL', 'https://api.chumcoin.me'),

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || required('SUPABASE_ANON_KEY'),

  heliusApiKey: required('HELIUS_API_KEY'),
  get heliusRpcUrl() {
    return process.env.SOLANA_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`;
  },

  chumWalletAddress: optional(
    'CHUM_WALLET_ADDRESS',
    'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T'
  ),

  // Signing keypair (base58 or JSON array) — used for NFT minting, transfers, auction ops
  chumSigningKey: required('CHUM_SIGNING_KEY'),

  // FairScale API for reputation scoring
  fairscaleApiKey: process.env.FAIRSCALE_API_KEY || '',

  // Wallet addresses for fee routing
  teamWallet: optional('TEAM_WALLET', 'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T'),
  treasuryWallet: optional('TREASURY_WALLET', 'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T'),

  // Fellow Villains collection for free vote verification
  fellowVillainsCollection: optional('VILLAIN_COLLECTION_ADDRESS', 'EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7'),
} as const;
