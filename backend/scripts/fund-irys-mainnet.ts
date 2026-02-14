import Irys from '@irys/sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const HELIUS_KEY = process.env.HELIUS_API_KEY || '06cda3a9-32f3-4ad9-a203-9d7274299837';
const RPC = process.env.SOLANA_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

async function main() {
  const raw = process.env.CHUM_SIGNING_KEY!;
  if (!raw) throw new Error('CHUM_SIGNING_KEY not set');
  const keyBytes = raw.includes(',') ? raw.split(',').map(Number) : JSON.parse(raw);

  const irys = new Irys({
    url: 'https://node1.irys.xyz',
    token: 'solana',
    key: Buffer.from(new Uint8Array(keyBytes)),
    config: { providerUrl: RPC },
  });

  const balanceBefore = await irys.getLoadedBalance();
  console.log('Irys balance before:', irys.utils.fromAtomic(balanceBefore), 'SOL');

  // Fund 0.05 SOL (~215 mints worth at 0.00023 SOL each)
  const fundAmount = irys.utils.toAtomic(0.05);
  console.log('Funding 0.05 SOL...');
  const receipt = await irys.fund(fundAmount);
  console.log('Fund tx:', receipt.id);

  const balanceAfter = await irys.getLoadedBalance();
  console.log('Irys balance after:', irys.utils.fromAtomic(balanceAfter), 'SOL');
  console.log('Enough for ~', Math.floor(Number(irys.utils.fromAtomic(balanceAfter)) / 0.00023), 'mints');
}

main().catch(console.error);
