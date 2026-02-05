/**
 * One-off script to generate CHUM mood portraits via Gemini.
 * Run: cd backend && npx tsx src/scripts/generatePortraits.ts
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const OUTPUT_DIR = path.resolve(__dirname, '../../../frontend/public/portraits');

const BASE_PROMPT = `Portrait of Sheldon J. Plankton from SpongeBob SquarePants.
- Small green oval body
- ONE large red eye taking up 80% of face (single cyclops eye - CRITICAL)
- Two thin antennae on top of head
- Tiny stick arms and legs
- Clean cartoon style, NOT pixel art
- Close-up portrait view, head and upper body
- Simple dark underwater background
- 512x512 resolution
- Smooth lines, vibrant colors

CRITICAL: Plankton has ONE EYE ONLY - a single large cyclops eye in the center. Do NOT give him two eyes.`;

interface PortraitSpec {
  file: string;
  expression: string;
}

const PORTRAITS: PortraitSpec[] = [
  {
    file: 'chum-neutral.png',
    expression: 'Calm, default expression. Normal-sized eye, relaxed posture. Slight confident smirk.',
  },
  {
    file: 'chum-happy.png',
    expression: 'Happy and hopeful expression. Bright sparkly eye, small genuine smile. Warm glow around him.',
  },
  {
    file: 'chum-sad.png',
    expression: 'Sad and droopy expression. Downcast eye with a single tear. Slumped posture, muted colors.',
  },
  {
    file: 'chum-worried.png',
    expression: 'Worried and anxious expression. Wide eye, visible sweat drop. Slightly trembling antennae.',
  },
  {
    file: 'chum-dying.png',
    expression: 'Near-death, fading expression. Half-closed eye, pale/faded colors. Dim eye glow, weak posture.',
  },
  {
    file: 'chum-excited.png',
    expression: 'Extremely excited expression. Huge dilated pupil, star sparkles around eye. Arms raised in triumph.',
  },
  {
    file: 'chum-scheming.png',
    expression: 'Scheming and devious expression. Narrowed eye with evil grin. Fingers tented, plotting pose.',
  },
  {
    file: 'chum-dead.png',
    expression: 'Dead/knocked out. X over eye instead of pupil. Grayscale/desaturated colors. Limp antennae drooping down.',
  },
];

async function generatePortrait(spec: PortraitSpec): Promise<void> {
  const fullPrompt = `${BASE_PROMPT}\n\nExpression: ${spec.expression}`;
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp-image-generation',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    } as any,
  });

  console.log(`[GENERATE] ${spec.file}...`);

  const result = await model.generateContent([fullPrompt]);
  const response = result.response;

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (part: any) => part.inlineData?.mimeType?.startsWith('image/')
  );

  if (!imagePart || !imagePart.inlineData) {
    throw new Error(`No image generated for ${spec.file}`);
  }

  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  const outPath = path.join(OUTPUT_DIR, spec.file);
  fs.writeFileSync(outPath, imageBuffer);
  console.log(`[SAVED] ${outPath} (${imageBuffer.length} bytes)`);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY in .env');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  for (const spec of PORTRAITS) {
    try {
      await generatePortrait(spec);
    } catch (err) {
      console.error(`[FAILED] ${spec.file}:`, err);
    }
    // Small delay between requests to avoid rate limits
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\nDone! Generated portraits in', OUTPUT_DIR);
}

main();
