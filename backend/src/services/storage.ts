import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { VillainTraits } from '../types';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

export async function uploadVillainToStorage(
  imageBuffer: Buffer,
  traits: VillainTraits,
  walletAddress: string,
  rarityScore: number,
  villainId?: string
): Promise<{ imageUrl: string; metadataUrl: string }> {
  try {
    console.log('[STORAGE] Uploading villain image...');

    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const filename = `villain-${timestamp}-${randomSuffix}.png`;

    // Upload image to Supabase Storage
    const { data: imageData, error: imageError } = await supabase.storage
      .from('villains')
      .upload(filename, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600'
      });

    if (imageError) {
      throw new Error(`Failed to upload image: ${imageError.message}`);
    }

    // Get public URL for the image
    const { data: { publicUrl } } = supabase.storage
      .from('villains')
      .getPublicUrl(filename);

    console.log('[STORAGE] Image uploaded:', publicUrl);

    // For metadata URL, we'll serve it from our API
    // We'll use the actual villain ID once it's created, but for now use timestamp
    const metadataUrl = `${config.apiBaseUrl}/api/villain/PLACEHOLDER/metadata`;

    console.log('[STORAGE] Metadata will be served at:', metadataUrl);

    return { 
      imageUrl: publicUrl, 
      metadataUrl 
    };
  } catch (error) {
    console.error('[STORAGE] Upload failed:', error);
    throw new Error(`Failed to upload to storage: ${error}`);
  }
}

export function generateMetadata(
  villainId: number,
  traits: VillainTraits,
  walletAddress: string,
  imageUrl: string,
  rarityScore: number
): NFTMetadata {
  return {
    name: `Fellow Villain #${villainId}`,
    description: `A unique Fellow Villain in CHUM's grand scheme for world domination! This villain donated 0.05+ SOL to keep the Chum Bucket open. Together, we will conquer... or at least survive another day.

Minted by: ${walletAddress}
Rarity Score: ${rarityScore}

Part of the Fellow Villains Collection - an army of supporters keeping Sheldon J. Plankton alive on the Solana blockchain.

Art Style: 1930s rubber hose cartoon inspired by Cuphead and Fleischer Studios`,
    image: imageUrl,
    attributes: [
      { trait_type: 'Body Color', value: traits.bodyColor },
      { trait_type: 'Hat', value: traits.hat },
      { trait_type: 'Eye Color', value: traits.eyeColor },
      { trait_type: 'Accessory', value: traits.accessory },
      { trait_type: 'Expression', value: traits.expression },
      { trait_type: 'Background', value: traits.background },
      { trait_type: 'Rarity Score', value: rarityScore.toString() },
      { trait_type: 'Benefactor', value: walletAddress.slice(0, 8) + '...' },
    ],
  };
}