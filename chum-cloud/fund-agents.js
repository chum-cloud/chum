#!/usr/bin/env node

// Fund all 3 CHUM Cloud agent wallets with 0.01 SOL each.
// Usage:
//   node fund-agents.js                         (uses FUND_WALLET_KEY from .env)
//   node fund-agents.js <base58_private_key>    (uses provided key)

const path = require('path');
const fs = require('fs');
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = require(path.resolve(__dirname, '../backend/node_modules/@solana/web3.js'));
const bs58 = require(path.resolve(__dirname, '../backend/node_modules/bs58'));

const FUND_AMOUNT = 0.01 * LAMPORTS_PER_SOL; // 10_000_000 lamports
const KEYS_DIR = path.join(__dirname, 'keys');
const AGENT_FILES = ['whale-agent.json', 'volume-agent.json', 'momentum-agent.json'];

// Load .env manually (no dotenv dependency needed)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const rpcUrl = env.RPC_URL || 'https://api.mainnet-beta.solana.com';

  // Get funding wallet key
  const keyArg = process.argv[2] || env.FUND_WALLET_KEY;
  if (!keyArg) {
    console.error('Error: No funding wallet key provided.');
    console.error('Usage:  node fund-agents.js <base58_private_key>');
    console.error('   or:  Add FUND_WALLET_KEY to chum-cloud/.env');
    process.exit(1);
  }

  const funder = Keypair.fromSecretKey(bs58.decode(keyArg));
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('');
  console.log('CHUM Cloud — Fund Agents');
  console.log('════════════════════════════════════');
  console.log(`Funder:  ${funder.publicKey.toBase58()}`);
  console.log(`RPC:     ${rpcUrl.replace(/api-key=.*/, 'api-key=***')}`);
  console.log(`Amount:  ${FUND_AMOUNT / LAMPORTS_PER_SOL} SOL each`);
  console.log('');

  // Check funder balance
  const funderBalance = await connection.getBalance(funder.publicKey);
  const needed = FUND_AMOUNT * AGENT_FILES.length + 15000; // transfers + fees
  console.log(`Funder balance: ${(funderBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (funderBalance < needed) {
    console.error(`Error: Need at least ${(needed / LAMPORTS_PER_SOL).toFixed(4)} SOL, have ${(funderBalance / LAMPORTS_PER_SOL).toFixed(4)}`);
    process.exit(1);
  }
  console.log('');

  // Fund each agent
  for (const file of AGENT_FILES) {
    const keyPath = path.join(KEYS_DIR, file);
    if (!fs.existsSync(keyPath)) {
      console.error(`  ✗ ${file} not found — run setup-agents.sh first`);
      continue;
    }

    const agentBytes = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    const agentKeypair = Keypair.fromSecretKey(new Uint8Array(agentBytes));
    const agentPubkey = agentKeypair.publicKey;
    const name = file.replace('.json', '');

    console.log(`  → Funding ${name} (${agentPubkey.toBase58()})...`);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: funder.publicKey,
        toPubkey: agentPubkey,
        lamports: FUND_AMOUNT,
      })
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [funder]);
    console.log(`    ✓ ${sig}`);
    console.log(`      https://solscan.io/tx/${sig}`);
  }

  console.log('');
  console.log('Balances after funding:');
  console.log('────────────────────────────────────');

  for (const file of AGENT_FILES) {
    const keyPath = path.join(KEYS_DIR, file);
    if (!fs.existsSync(keyPath)) continue;

    const agentBytes = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    const agentKeypair = Keypair.fromSecretKey(new Uint8Array(agentBytes));
    const balance = await connection.getBalance(agentKeypair.publicKey);
    const name = file.replace('.json', '');

    console.log(`  ${name}: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  }

  console.log('');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
