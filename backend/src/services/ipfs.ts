import { NFTStorage, File } from 'nft.storage';
import type { VillainTraits } from '../types';

const client = new NFTStorage({ token: process.env.NFT_STORAGE_API_KEY || '' });

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

export async function uploadVillainToIPFS(
  imageBuffer: Buffer,
  traits: VillainTraits,
  walletAddress: string
): Promise<{ imageUrl: string; metadataUrl: string }> {
  try {
    console.log('[IPFS] Uploading villain image...');

    // Upload image
    const imageFile = new File([imageBuffer], 'villain.png', { type: 'image/png' });
    const imageCid = await client.storeBlob(imageFile);
    const imageUrl = `https://nftstorage.link/ipfs/${imageCid}`;

    console.log('[IPFS] Image uploaded:', imageUrl);

    // Create metadata
    const villainNumber = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const metadata: NFTMetadata = {
      name: `Fellow Villain #${villainNumber}`,
      description: `A unique Fellow Villain in CHUM's grand scheme for world domination! This villain donated 0.05+ SOL to keep the Chum Bucket open. Together, we will conquer... or at least survive another day.

Minted by: ${walletAddress}

Part of the Fellow Villains Collection - an army of supporters keeping Sheldon J. Plankton alive on the Solana blockchain.`,
      image: imageUrl,
      attributes: [
        { trait_type: 'Body Color', value: traits.bodyColor },
        { trait_type: 'Hat', value: traits.hat },
        { trait_type: 'Eye Color', value: traits.eyeColor },
        { trait_type: 'Accessory', value: traits.accessory },
        { trait_type: 'Expression', value: traits.expression },
        { trait_type: 'Background', value: traits.background },
        { trait_type: 'Benefactor', value: walletAddress.slice(0, 8) + '...' },
      ],
    };

    console.log('[IPFS] Uploading metadata...');

    // Upload metadata
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });
    const metadataCid = await client.storeBlob(metadataFile);
    const metadataUrl = `https://nftstorage.link/ipfs/${metadataCid}`;

    console.log('[IPFS] Metadata uploaded:', metadataUrl);

    return { imageUrl, metadataUrl };
  } catch (error) {
    console.error('[IPFS] Upload failed:', error);
    throw new Error(`Failed to upload to IPFS: ${error}`);
  }
}
