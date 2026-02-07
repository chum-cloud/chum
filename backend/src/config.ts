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

  groqApiKey: required('GROQ_API_KEY'),

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || required('SUPABASE_ANON_KEY'),

  heliusApiKey: required('HELIUS_API_KEY'),
  get heliusRpcUrl() {
    return `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`;
  },

  chumWalletAddress: optional(
    'CHUM_WALLET_ADDRESS',
    'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T'
  ),

  twitterApiKey: required('TWITTER_API_KEY'),
  twitterApiSecret: required('TWITTER_API_SECRET'),
  twitterAccessToken: required('TWITTER_ACCESS_TOKEN'),
  twitterAccessSecret: required('TWITTER_ACCESS_SECRET'),

  // Message signing keypair (for verifiable CHUM identity)
  chumSigningKey: process.env.CHUM_SIGNING_KEY || '',

  // FairScale API for reputation scoring
  fairscaleApiKey: process.env.FAIRSCALE_API_KEY || '',
} as const;
