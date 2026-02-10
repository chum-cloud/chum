import 'dotenv/config';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity } from '@metaplex-foundation/umi';
import { updateV1 } from '@metaplex-foundation/mpl-core';
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters';
import { Keypair } from '@solana/web3.js';
import { publicKey } from '@metaplex-foundation/umi';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
const supabaseUrl = process.env.SUPABASE_URL!.startsWith('http') ? process.env.SUPABASE_URL! : `https://${process.env.SUPABASE_URL}.supabase.co`;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY!);
const COLLECTION = 'EK9CvmCfP7ZmRWAfYxEpSM8267ozXD8SYzwSafkcm8M7';

const TO_FIX = [
  'GMdBRm2RV2eaRqLEko8E1Kehpw44US2zQXGKigmvcR7w',
  'GCNKwQt2NdWQTesWFjdt4Z8ddMHzUix1TaB15hoNtw6k',
  'FY6y4yWq1mMsub5y3yYyWXu6AssbULkyqY8NU3vpevhn',
  'FAQ6Xi8qApXMLTuJWK3nWhySFGZC5Gr4or59VmwdTDTz',
  'EkKCLDJphaxjZHPcnwsQCihvQHNAtxeSjUBzSXYY5hbC',
  'EXeq3AhgbYWPMVJ1M74XfLPXBHGWN54sPfGjyRpwypYT',
  'E5bTx9Awbri6xZ1PA2d7zFZW69DigAdqNybQSqppzFPd',
  'D2YMo63B2UuV2DidvargJNnmEPfQRv8N7UoPnZ7JRunc',
  'D2TCYnxSoDEsYKHj1VDKvEQKe97tjY5vAzUpoF3sB7qh',
  'CpQRKZCVacR9TnFSHg5Ryea8YwWyUStsWnPMSJwcag1p',
  'CnNveHC97ySweTk2LD7vSJ7yyhW2xeiEDGgaTJss7uFp',
  'CdXM6525XKALxtArPry4x9BT3mG219UUitiXZTBKGUsj',
  'C9rrgSvEiFjejFo9epS3Q4Gh6BLXQjE7XyrCSoN58FQ2',
  'BwvSsfqJiwm6HNrx87izVmkzD8EaedAvRzvDX38iAmZx',
  'H5G81XbhFSPByXRvpicSF3EidaXHLsfddKXcbGcbZix5',
  'FqtSh9iZ5o5K5DuXCosZ3F6GLbHci4hdbf57hMkR5Rho',
  'FSiQLgjxVh5c2AwEAGHEcJX5suffACMRAwhwBhM42Zu6',
  'EzkcJVQXFhxxWMWtoa2JttL6GdZre4gLC1m6yViv7SXT',
  'Eibu1f3kvSvNk6qE4pUBH7hNjNUvLrauLDxhn2VTxupk',
  'EQzB2tprx7JCFNKfxe142wANsD8Ru5VjAJFaqUc2NKxy',
];

async function claimPoolVillain() {
  const { count } = await supabase
    .from('villains')
    .select('*', { count: 'exact', head: true })
    .like('wallet_address', 'pool%');
  if (!count || count === 0) throw new Error('Pool empty');
  const offset = Math.floor(Math.random() * count);
  const { data, error } = await supabase
    .from('villains')
    .select('*')
    .like('wallet_address', 'pool%')
    .range(offset, offset);
  if (error || !data?.[0]) throw new Error('Failed to claim');
  return data[0];
}

async function main() {
  let keyBytes: number[];
  if (process.env.SURVIVAL_WALLET_SECRET) {
    keyBytes = JSON.parse(process.env.SURVIVAL_WALLET_SECRET);
  } else {
    keyBytes = JSON.parse(readFileSync(join(__dirname, '../chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T.json'), 'utf-8'));
  }
  const authority = Keypair.fromSecretKey(Uint8Array.from(keyBytes));
  const umi = createUmi(HELIUS_RPC).use(keypairIdentity(fromWeb3JsKeypair(authority)));
  console.log(`Authority: ${authority.publicKey.toBase58()}`);

  let success = 0, fail = 0;
  for (const assetId of TO_FIX) {
    try {
      const pool = await claimPoolVillain();
      const newName = `Fellow Villain #${pool.id}`;
      const newUri = `https://chum-production.up.railway.app/api/villain/${pool.id}/metadata`;

      await updateV1(umi, {
        asset: publicKey(assetId),
        collection: publicKey(COLLECTION),
        newName,
        newUri,
      }).sendAndConfirm(umi);

      await supabase
        .from('villains')
        .update({ wallet_address: `repair-${assetId.slice(0, 8)}`, is_minted: true })
        .eq('id', pool.id);

      success++;
      console.log(`✅ [${success + fail}/${TO_FIX.length}] ${assetId.slice(0, 12)}... → #${pool.id}`);
    } catch (err: any) {
      fail++;
      console.error(`❌ [${success + fail}/${TO_FIX.length}] ${assetId.slice(0, 12)}... — ${err.message?.slice(0, 100)}`);
    }
  }
  console.log(`\nDone: ${success} fixed, ${fail} failed`);
}

main().catch(console.error);
