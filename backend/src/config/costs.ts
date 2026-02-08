// Estimated USD costs per operation (based on paid-tier API pricing)
export const OPERATION_COSTS = {
  GROQ_THOUGHT: 0.002,        // Llama 3.3 70B, ~150 tokens
  GROQ_TWEET: 0.002,          // Same model, tweet generation
  VERTEX_THOUGHT: 0.0005,     // Gemini 2.0 Flash via Vertex AI, ~150 tokens
  VERTEX_CONTENT: 0.001,      // Gemini 2.0 Flash via Vertex AI, ~300 tokens
  GEMINI_IMAGE: 0.01,         // Gemini Flash image gen
  HELIUS_BALANCE_CHECK: 0.0001, // RPC getBalance
  HELIUS_TX_QUERY: 0.0002,    // RPC transaction parsing
  IPFS_UPLOAD: 0.005,         // NFT.Storage pin
  TWITTER_POST: 0.001,        // Rate-limited API slot
  SUPABASE_WRITE: 0.00002,    // DB insert/update
  GROQ_CLOUD_POST: 0.003,     // Llama 3.3 70B, ~300 tokens (Cloud posts + battle entries)
} as const;

export type OperationType = keyof typeof OPERATION_COSTS;

// Base daily cost: server hosting (Railway ~$5/month = $0.17/day)
// This is always incurred regardless of operations.
export const BASE_DAILY_COST_USD = 0.17;

// Default estimated daily operation burn when no expense history exists
// ~8 thoughts/day + 12 balance checks/day + misc
export const DEFAULT_DAILY_OPS_USD = 0.02;
