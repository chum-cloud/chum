/**
 * Irys (Arweave) upload service for CHUM: Reanimation.
 * Uploads MP4, PNG, and metadata JSON to Arweave at mint time.
 * Uses the CHUM_SIGNING_KEY (authority) to fund Irys uploads.
 */
import Irys from '@irys/sdk';

const IRYS_NODE = process.env.IRYS_NODE || 'https://node1.irys.xyz';
const IRYS_TOKEN = 'solana';
const IRYS_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

let irysInstance: Irys | null = null;

function getSigningKey(): Uint8Array {
  const raw = process.env.CHUM_SIGNING_KEY;
  if (!raw) throw new Error('CHUM_SIGNING_KEY not set');

  // Comma-separated numbers format (Railway env)
  return new Uint8Array(raw.split(',').map(Number));
}

async function getIrys(): Promise<Irys> {
  if (irysInstance) return irysInstance;

  const key = getSigningKey();
  irysInstance = new Irys({
    url: IRYS_NODE,
    token: IRYS_TOKEN,
    key: Buffer.from(key),
    config: { providerUrl: IRYS_RPC },
  });

  // Fund if needed — keep a small buffer
  try {
    const balance = await irysInstance.getLoadedBalance();
    console.log(`[IRYS] Balance: ${irysInstance.utils.fromAtomic(balance)} SOL`);
  } catch (e: any) {
    console.warn(`[IRYS] Could not check balance: ${e.message}`);
  }

  return irysInstance;
}

/**
 * Upload a buffer to Arweave via Irys.
 * Returns the Arweave gateway URL.
 */
async function uploadBuffer(
  data: Buffer,
  contentType: string,
  tags?: Array<{ name: string; value: string }>,
): Promise<string> {
  const irys = await getIrys();

  const allTags = [
    { name: 'Content-Type', value: contentType },
    { name: 'App-Name', value: 'CHUM-Reanimation' },
    ...(tags || []),
  ];

  const receipt = await irys.upload(data, { tags: allTags });
  const url = `https://arweave.net/${receipt.id}`;
  console.log(`[IRYS] Uploaded ${contentType} (${data.length} bytes): ${url}`);
  return url;
}

/**
 * Get the cost to upload a given number of bytes via Irys (in lamports).
 */
async function getUploadCost(bytes: number): Promise<number> {
  const irys = await getIrys();
  const price = await irys.getPrice(bytes);
  return Number(price);
}

/**
 * Upload a complete CHUM art piece to Arweave:
 * 1. Upload MP4 (animation_url)
 * 2. Upload PNG (image)
 * 3. Build & upload metadata JSON
 * Returns { metadataUri, imageUri, animationUri }
 */
export async function uploadArtToArweave(
  mp4Buffer: Buffer,
  pngBuffer: Buffer,
  name: string,
  pieceId: string,
): Promise<{
  metadataUri: string;
  imageUri: string;
  animationUri: string;
  uploadCostLamports: number;
}> {
  const startTime = Date.now();

  // Upload MP4 and PNG in parallel
  const [animationUri, imageUri] = await Promise.all([
    uploadBuffer(mp4Buffer, 'video/mp4', [
      { name: 'Type', value: 'animation' },
      { name: 'Piece-Id', value: pieceId },
    ]),
    uploadBuffer(pngBuffer, 'image/png', [
      { name: 'Type', value: 'image' },
      { name: 'Piece-Id', value: pieceId },
    ]),
  ]);

  // Build Metaplex-compatible metadata JSON
  const metadata = {
    name,
    symbol: 'CHUM',
    description: 'CHUM: Reanimation — 1/1 ASCII art NFT',
    image: imageUri,
    animation_url: animationUri,
    external_url: 'https://clumcloud.com',
    attributes: [
      { trait_type: 'Status', value: 'Artwork' },
      { trait_type: 'Type', value: 'ASCII Art' },
      { trait_type: 'Frames', value: '60' },
      { trait_type: 'FPS', value: '15' },
    ],
    properties: {
      files: [
        { uri: imageUri, type: 'image/png' },
        { uri: animationUri, type: 'video/mp4' },
      ],
      category: 'video',
    },
  };

  const metadataBuffer = Buffer.from(JSON.stringify(metadata));
  const metadataUri = await uploadBuffer(metadataBuffer, 'application/json', [
    { name: 'Type', value: 'metadata' },
    { name: 'Piece-Id', value: pieceId },
  ]);

  const totalBytes = mp4Buffer.length + pngBuffer.length + metadataBuffer.length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[IRYS] Complete upload for ${pieceId}: ${totalBytes} bytes in ${elapsed}s`);

  // Estimate cost (for tracking — authority already paid via Irys balance)
  let uploadCostLamports = 0;
  try {
    uploadCostLamports = await getUploadCost(totalBytes);
  } catch {
    // Non-fatal — cost estimation failure shouldn't block mint
    uploadCostLamports = 500_000; // ~0.0005 SOL fallback estimate
  }

  return { metadataUri, imageUri, animationUri, uploadCostLamports };
}

/**
 * Fetch a file from Supabase storage and return as Buffer.
 */
export async function fetchFromPool(fileUrl: string): Promise<Buffer> {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to fetch ${fileUrl}: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Estimate total Irys upload cost for a typical CHUM piece.
 * Average: ~3MB MP4 + ~50KB PNG + ~1KB metadata ≈ 3MB total.
 * Returns lamports.
 */
export async function estimateUploadCost(): Promise<number> {
  try {
    return await getUploadCost(3_100_000); // ~3.1MB average
  } catch {
    return 500_000; // fallback: ~0.0005 SOL
  }
}
