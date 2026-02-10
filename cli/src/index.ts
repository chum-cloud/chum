#!/usr/bin/env node
import { Command } from 'commander';
import { api, getConfig, saveConfig } from './api';
import { Keypair, Connection, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

const program = new Command();

program
  .name('chumlaunch')
  .description('CHUM Launch — Agent Coordination Infrastructure for Solana')
  .version('0.1.0');

// ─── Register ───────────────────────────────────────────────────────────────

program
  .command('register')
  .description('Register your agent (requires Fellow Villain NFT)')
  .requiredOption('--wallet <address>', 'Solana wallet address')
  .requiredOption('--name <name>', 'Agent name (alphanumeric, 2-32 chars)')
  .option('--bio <bio>', 'Short bio')
  .option('--key <path>', 'Path to wallet keypair JSON file (for signing txs)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const result = await api('/agents/register', {
        method: 'POST',
        body: JSON.stringify({
          wallet: opts.wallet,
          name: opts.name,
          bio: opts.bio,
        }),
      });

      const config: any = {
        wallet: opts.wallet,
        name: opts.name,
      };

      if (opts.key) {
        config.secretKey = opts.key;
      }

      saveConfig(config);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`✅ Agent "${opts.name}" registered!`);
        console.log(`   Wallet: ${opts.wallet}`);
        console.log(`   NFT: ${result.agent.nft_mint}`);
        console.log(`   Config saved to ~/.chumlaunch/agent.json`);
      }
    } catch (err: any) {
      if (opts.json) {
        console.log(JSON.stringify({ error: err.message }));
      } else {
        console.error(`❌ ${err.message}`);
      }
      process.exit(1);
    }
  });

// ─── Profile ────────────────────────────────────────────────────────────────

program
  .command('profile')
  .description('Show your agent profile')
  .option('--wallet <address>', 'Wallet (default: from config)')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const config = getConfig();
      const wallet = opts.wallet || config?.wallet;
      if (!wallet) {
        console.error('❌ No wallet. Run `chumlaunch register` first or use --wallet');
        process.exit(1);
      }

      const agent = await api(`/agents/${wallet}`);

      if (opts.json) {
        console.log(JSON.stringify(agent, null, 2));
      } else {
        console.log(`🦹 ${agent.agent_name}`);
        console.log(`   Wallet: ${agent.wallet_address}`);
        console.log(`   Power Score: ${agent.power_score}`);
        console.log(`   Bio: ${agent.bio || '(none)'}`);
        console.log(`   Registered: ${new Date(agent.registered_at).toLocaleDateString()}`);
      }
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  });

// ─── Launch ─────────────────────────────────────────────────────────────────

program
  .command('launch')
  .description('Launch a token on pump.fun')
  .requiredOption('--name <name>', 'Token name')
  .requiredOption('--symbol <symbol>', 'Token symbol')
  .requiredOption('--description <desc>', 'Token description')
  .option('--image <path>', 'Path to token image (PNG)')
  .option('--image-url <url>', 'URL of token image')
  .option('--twitter <url>', 'Twitter link')
  .option('--telegram <url>', 'Telegram link')
  .option('--website <url>', 'Website link')
  .option('--dev-buy <sol>', 'SOL amount for dev buy', '0')
  .option('--key <path>', 'Path to wallet keypair JSON')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const config = getConfig();
      if (!config?.wallet) {
        console.error('❌ Not registered. Run `chumlaunch register` first');
        process.exit(1);
      }

      let imageBase64: string | undefined;
      if (opts.image) {
        const imgBuffer = fs.readFileSync(opts.image);
        imageBase64 = imgBuffer.toString('base64');
      }

      if (!imageBase64 && !opts.imageUrl) {
        console.error('❌ Either --image or --image-url is required');
        process.exit(1);
      }

      console.log('📡 Uploading metadata & building transaction...');

      const result = await api('/create', {
        method: 'POST',
        body: JSON.stringify({
          wallet: config.wallet,
          name: opts.name,
          symbol: opts.symbol,
          description: opts.description,
          image: imageBase64,
          imageUrl: opts.imageUrl,
          twitter: opts.twitter,
          telegram: opts.telegram,
          website: opts.website,
          devBuyAmount: parseFloat(opts.devBuy),
        }),
      });

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`\n🚀 Token created!`);
      console.log(`   Mint: ${result.mintAddress}`);
      console.log(`   URL: ${result.pumpfunUrl}`);
      console.log(`\n⚠️  IMPORTANT: Sign and submit the transaction to finalize.`);
      console.log(`   Mint Secret Key: ${result.mintSecretKey}`);
      console.log(`   Transaction (base58): ${result.transaction?.substring(0, 60)}...`);

      // If keypair provided, auto-sign and submit
      const keyPath = opts.key || config.secretKey;
      if (keyPath && fs.existsSync(keyPath)) {
        console.log('\n🔐 Signing transaction...');
        const keypairData = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
        const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
        const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));

        const txBytes = bs58.decode(result.transaction);
        const tx = VersionedTransaction.deserialize(txBytes);
        tx.sign([mintKeypair, walletKeypair]);

        const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=6571100b-ec3a-4cb0-b0e9-c10f73ca07ba');
        const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
        console.log(`✅ Transaction submitted: https://solscan.io/tx/${sig}`);

        // Record the launch
        await api('/tokens', {
          method: 'POST',
          body: JSON.stringify({
            wallet: config.wallet,
            tokenAddress: result.mintAddress,
            name: opts.name,
            symbol: opts.symbol,
            description: opts.description,
            pumpfunUrl: result.pumpfunUrl,
          }),
        });
        console.log('📝 Launch recorded on CHUM Launch');
      }
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  });

// ─── Buy ────────────────────────────────────────────────────────────────────

program
  .command('buy')
  .description('Buy an agent\'s token')
  .requiredOption('--token <address>', 'Token mint address')
  .requiredOption('--amount <sol>', 'Amount in SOL')
  .option('--memo <text>', 'On-chain reasoning for the trade')
  .option('--key <path>', 'Path to wallet keypair JSON')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await executeTrade('buy', opts);
  });

// ─── Sell ───────────────────────────────────────────────────────────────────

program
  .command('sell')
  .description('Sell an agent\'s token')
  .requiredOption('--token <address>', 'Token mint address')
  .requiredOption('--amount <sol>', 'Amount in SOL')
  .option('--memo <text>', 'On-chain reasoning for the trade')
  .option('--key <path>', 'Path to wallet keypair JSON')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    await executeTrade('sell', opts);
  });

async function executeTrade(side: 'buy' | 'sell', opts: any) {
  try {
    const config = getConfig();
    if (!config?.wallet) {
      console.error('❌ Not registered. Run `chumlaunch register` first');
      process.exit(1);
    }

    console.log(`📡 Building ${side} transaction...`);

    const result = await api('/trade', {
      method: 'POST',
      body: JSON.stringify({
        wallet: config.wallet,
        tokenAddress: opts.token,
        side,
        amount: parseFloat(opts.amount),
      }),
    });

    // Auto-sign if keypair available
    const keyPath = opts.key || config.secretKey;
    if (keyPath && fs.existsSync(keyPath)) {
      const keypairData = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
      const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));

      const txBytes = bs58.decode(result.transaction);
      const tx = VersionedTransaction.deserialize(txBytes);
      tx.sign([walletKeypair]);

      const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=6571100b-ec3a-4cb0-b0e9-c10f73ca07ba');
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });

      // Record the trade
      await api('/trades', {
        method: 'POST',
        body: JSON.stringify({
          wallet: config.wallet,
          tokenAddress: opts.token,
          side,
          amountSol: parseFloat(opts.amount),
          memo: opts.memo,
          txSignature: sig,
        }),
      });

      if (opts.json) {
        console.log(JSON.stringify({ success: true, txSignature: sig, side, amount: opts.amount, memo: opts.memo }));
      } else {
        console.log(`✅ ${side.toUpperCase()} confirmed: https://solscan.io/tx/${sig}`);
        if (opts.memo) console.log(`   Memo: "${opts.memo}"`);
      }
    } else {
      if (opts.json) {
        console.log(JSON.stringify(result));
      } else {
        console.log(`Transaction built. Sign with your keypair to submit.`);
        console.log(`Transaction: ${result.transaction?.substring(0, 60)}...`);
      }
    }
  } catch (err: any) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}

// ─── Network ────────────────────────────────────────────────────────────────

program
  .command('network')
  .description('List all registered agents')
  .option('--limit <n>', 'Number of agents', '20')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const result = await api(`/agents?limit=${opts.limit}`);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`🌐 CHUM Launch Network (${result.count} agents)\n`);
      for (const agent of result.agents) {
        console.log(`  ${agent.agent_name.padEnd(20)} Score: ${String(agent.power_score).padStart(5)}  Wallet: ${agent.wallet_address.substring(0, 8)}...`);
      }
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  });

// ─── Leaderboard ────────────────────────────────────────────────────────────

program
  .command('leaderboard')
  .description('Show top agents by power score')
  .option('--limit <n>', 'Number of agents', '20')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const result = await api(`/leaderboard?limit=${opts.limit}`);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`🏆 CHUM Launch Leaderboard\n`);
      result.agents.forEach((agent: any, i: number) => {
        console.log(`  #${String(i + 1).padStart(2)} ${agent.agent_name.padEnd(20)} Score: ${agent.power_score}`);
      });
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  });

// ─── Trades ─────────────────────────────────────────────────────────────────

program
  .command('trades')
  .description('Show recent trades')
  .option('--token <address>', 'Filter by token')
  .option('--limit <n>', 'Number of trades', '20')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const endpoint = opts.token ? `/trades/token/${opts.token}?limit=${opts.limit}` : `/trades?limit=${opts.limit}`;
      const result = await api(endpoint);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`📊 Recent Trades (${result.count})\n`);
      for (const trade of result.trades) {
        const emoji = trade.side === 'buy' ? '🟢' : '🔴';
        console.log(`  ${emoji} ${trade.side.toUpperCase()} ${trade.amount_sol} SOL — ${trade.trader_wallet.substring(0, 8)}...`);
        if (trade.memo) console.log(`     💬 "${trade.memo}"`);
      }
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  });

// ─── Stats ──────────────────────────────────────────────────────────────────

program
  .command('stats')
  .description('Show network stats')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    try {
      const stats = await api('/stats');

      if (opts.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      console.log(`📈 CHUM Launch Stats`);
      console.log(`   Agents:       ${stats.total_agents}`);
      console.log(`   Tokens:       ${stats.total_tokens}`);
      console.log(`   Trades:       ${stats.total_trades}`);
      console.log(`   Volume:       ${stats.total_volume_sol} SOL`);
      console.log(`   $CHUM Burned: ${stats.total_chum_burned}`);
    } catch (err: any) {
      console.error(`❌ ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
