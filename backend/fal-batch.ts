import { generateVillainImageGeminiFal } from './src/services/gemini';
import { uploadVillainToStorage } from './src/services/storage';
import { insertVillain, getPoolCount } from './src/services/supabase';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const target = 300;
  let generated = 0;
  
  while (true) {
    const current = await getPoolCount();
    if (current >= target) {
      console.log(`Pool at ${current}, target ${target} reached!`);
      break;
    }
    
    try {
      const { imageBuffer, traits, rarityScore } = await generateVillainImageGeminiFal();
      const poolAddr = `pool-fal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { imageUrl } = await uploadVillainToStorage(imageBuffer, traits, poolAddr, rarityScore);
      await insertVillain(poolAddr, imageUrl, '', traits, 0, rarityScore);
      generated++;
      console.log(`[FAL-BATCH] +${generated} (pool: ${current + 1})`);
    } catch (err: any) {
      console.warn(`[FAL-BATCH] Failed at ${generated}: ${err.message}`);
      // If Gemini fails, wait 5s and retry (fal.ai might still work)
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  console.log(`Done! Generated ${generated} villains`);
}
main().catch(console.error);
