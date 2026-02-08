import { fal } from '@fal-ai/client';
import { generateRandomTraits, buildPrompt, calculateRarityScore } from './src/services/gemini';
import { uploadVillainToStorage } from './src/services/storage';
import { insertVillain, getPoolCount } from './src/services/supabase';
import dotenv from 'dotenv';
dotenv.config();

// Use second fal key
fal.config({ credentials: process.env.FAL_KEY_2 });

async function main() {
  const target = 300;
  let generated = 0;
  
  while (true) {
    const current = await getPoolCount();
    if (current >= target) {
      console.log(`Pool at ${current}, done!`);
      break;
    }
    
    try {
      const traits = generateRandomTraits();
      const prompt = buildPrompt(traits);
      const rarityScore = calculateRarityScore(traits);
      
      const result = await fal.subscribe('fal-ai/imagen4/preview', {
        input: { prompt, num_images: 1, aspect_ratio: '1:1', output_format: 'png' },
      }) as any;
      const imageUrl = result.data?.images?.[0]?.url;
      if (!imageUrl) throw new Error('No fal.ai image URL');
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) throw new Error(`Download failed: ${imgResp.status}`);
      const imageBuffer = Buffer.from(await imgResp.arrayBuffer());
      
      const poolAddr = `pool-fal2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { imageUrl: storedUrl } = await uploadVillainToStorage(imageBuffer, traits, poolAddr, rarityScore);
      await insertVillain(poolAddr, storedUrl, '', traits, 0, rarityScore);
      generated++;
      console.log(`[FAL2] +${generated} (pool: ${current + 1})`);
    } catch (err: any) {
      console.warn(`[FAL2] Failed: ${err.message}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.log(`Done! Generated ${generated}`);
}
main().catch(console.error);
