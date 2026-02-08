import type { VillainTraits, BodyColor, Hat, EyeColor, Accessory, Expression, Background } from '../types';

// Trait arrays with rarity weights
const BODY_COLORS: { value: BodyColor; weight: number }[] = [
  { value: 'green', weight: 30 },
  { value: 'blue', weight: 20 },
  { value: 'purple', weight: 15 },
  { value: 'red', weight: 15 },
  { value: 'teal', weight: 15 },
  { value: 'gold', weight: 5 },
];

const HATS: { value: Hat; weight: number }[] = [
  { value: 'chef hat', weight: 12 },
  { value: 'top hat', weight: 12 },
  { value: 'pirate hat', weight: 12 },
  { value: 'helmet', weight: 12 },
  { value: 'crown', weight: 6 },
  { value: 'wizard hat', weight: 6 },
  { value: 'viking helmet', weight: 5 },
  { value: 'fedora', weight: 8 },
  { value: 'fez', weight: 4 },
  { value: 'propeller cap', weight: 4 },
  { value: 'military beret', weight: 5 },
  { value: 'newsboy cap', weight: 6 },
  { value: 'bowler hat', weight: 8 },
  { value: 'sombrero', weight: 3 },
  { value: 'witch hat', weight: 5 },
  { value: 'beanie', weight: 6 },
  { value: 'napoleon hat', weight: 3 },
  { value: 'turban', weight: 4 },
  { value: 'straw hat', weight: 5 },
  { value: 'beret', weight: 6 },
];

const EYE_COLORS: { value: EyeColor; weight: number }[] = [
  { value: 'red', weight: 30 },
  { value: 'yellow', weight: 25 },
  { value: 'blue', weight: 20 },
  { value: 'pink', weight: 15 },
  { value: 'gold', weight: 10 },
];

const ACCESSORIES: { value: Accessory; weight: number }[] = [
  { value: 'none', weight: 40 },
  { value: 'monocle', weight: 15 },
  { value: 'sunglasses', weight: 15 },
  { value: 'eyepatch', weight: 15 },
  { value: 'scar', weight: 15 },
];

const EXPRESSIONS: { value: Expression; weight: number }[] = [
  { value: 'evil grin', weight: 25 },
  { value: 'scheming', weight: 25 },
  { value: 'angry', weight: 20 },
  { value: 'worried', weight: 20 },
  { value: 'happy', weight: 10 },
];

const BACKGROUNDS: Background[] = ['chum bucket', 'underwater', 'purple', 'orange', 'teal'];

function weightedRandom<T>(arr: { value: T; weight: number }[]): T {
  const totalWeight = arr.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of arr) {
    random -= item.weight;
    if (random <= 0) {
      return item.value;
    }
  }
  
  return arr[arr.length - 1].value;
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function calculateRarityScore(traits: VillainTraits): number {
  let score = 0;
  
  // Add rarity based on trait weights (rarer = higher score)
  const bodyRarity = BODY_COLORS.find(b => b.value === traits.bodyColor)?.weight || 0;
  score += (50 - bodyRarity); // Invert weight so rare = high score
  
  const hatRarity = HATS.find(h => h.value === traits.hat)?.weight || 0;
  score += (50 - hatRarity);
  
  const eyeRarity = EYE_COLORS.find(e => e.value === traits.eyeColor)?.weight || 0;
  score += (50 - eyeRarity);
  
  const accessoryRarity = ACCESSORIES.find(a => a.value === traits.accessory)?.weight || 0;
  score += (50 - accessoryRarity);
  
  const expressionRarity = EXPRESSIONS.find(e => e.value === traits.expression)?.weight || 0;
  score += (50 - expressionRarity);
  
  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

export function generateRandomTraits(): VillainTraits {
  return {
    bodyColor: weightedRandom(BODY_COLORS),
    hat: weightedRandom(HATS),
    eyeColor: weightedRandom(EYE_COLORS),
    accessory: weightedRandom(ACCESSORIES),
    expression: weightedRandom(EXPRESSIONS),
    background: randomFromArray(BACKGROUNDS),
  };
}

function buildPrompt(traits: VillainTraits): string {
  const { bodyColor, hat, eyeColor, accessory, expression } = traits;

  let hatDesc = '';
  if (hat !== 'none') {
    const hatDescriptions: Record<string, string> = {
      'chef hat': 'wearing a white chef hat',
      'crown': 'wearing a golden crown',
      'pirate hat': 'wearing a black pirate hat with skull and crossbones',
      'top hat': 'wearing a black top hat',
      'helmet': 'wearing a metallic helmet',
      'wizard hat': 'wearing a tall purple wizard hat with stars',
      'viking helmet': 'wearing a horned viking helmet',
      'fedora': 'wearing a dark fedora hat',
      'fez': 'wearing a red fez hat with tassel',
      'propeller cap': 'wearing a colorful propeller beanie cap',
      'military beret': 'wearing a dark green military beret',
      'newsboy cap': 'wearing a vintage newsboy cap',
      'bowler hat': 'wearing a black bowler hat',
      'sombrero': 'wearing a wide-brimmed sombrero',
      'witch hat': 'wearing a pointed black witch hat',
      'beanie': 'wearing a dark knit beanie',
      'napoleon hat': 'wearing a Napoleon bicorne hat',
      'turban': 'wearing an ornate turban',
      'straw hat': 'wearing a straw sun hat',
      'beret': 'wearing a classic French beret',
    };
    hatDesc = hatDescriptions[hat] || `wearing a ${hat}`;
  }

  let accessoryDesc = '';
  if (accessory !== 'none') {
    accessoryDesc = accessory === 'monocle' ? 'wearing a monocle' :
                   accessory === 'eyepatch' ? 'wearing an eyepatch' :
                   accessory === 'scar' ? 'with a scar across the face' :
                   accessory === 'sunglasses' ? 'wearing cool sunglasses' : '';
  }

  const outfits = [
    'wearing a villain cape with high collar',
    'wearing a lab coat with pens in pocket',
    'wearing a leather jacket with studs',
    'wearing a military uniform with medals',
    'wearing a tuxedo with bow tie',
    'wearing a trench coat with popped collar',
    'wearing a striped prison outfit',
    'wearing a fancy vest and dress shirt',
    'wearing a Hawaiian shirt',
    'wearing a hoodie',
    'wearing a suit of armor',
    'wearing a business suit with tie',
    'wearing a bomber jacket',
    'wearing a kimono robe',
    'wearing a wrestling singlet',
    'wearing overalls',
  ];
  const outfit = outfits[Math.floor(Math.random() * outfits.length)];

  const poses = [
    'three-quarter view, one gloved hand raised waving, other hand behind back',
    'leaning forward menacingly, gloved hands rubbing together in front',
    'arms crossed over chest confidently, slight head tilt',
    'pointing at viewer with one gloved hand, other hand on hip',
    'laughing maniacally, one gloved hand covering mouth',
    'scheming pose, one gloved hand stroking chin, other behind back',
    'dynamic angle from below, both gloved fists raised in victory',
    'slight dutch angle, one gloved hand adjusting hat',
    'gloved hands on hips in a power pose, chest puffed out',
    'one gloved hand holding a cane, other hand in pocket',
    'one gloved fist raised triumphantly in the air',
    'dramatic side profile, gloved hand reaching toward viewer',
  ];
  const pose = poses[Math.floor(Math.random() * poses.length)];

  const prompt = `Half-body portrait of a 1930s Cuphead-style cartoon villain character. Oval bean-shaped ${bodyColor} head with ONE large ${eyeColor} cyclops eye, two thin antennae with ball tips on top. Human-like body with thin noodle limbs, white gloved hands, ${hatDesc}, ${outfit}. ${accessoryDesc ? accessoryDesc + '. ' : ''}${expression} expression. ${pose}. Rubber hose animation style, thick black outlines, muted vintage palette, solid dark background. Portrait composition.`;

  return prompt;
}

export async function generateVillainImage(traits?: VillainTraits): Promise<{
  imageBuffer: Buffer;
  traits: VillainTraits;
  rarityScore: number;
}> {
  const villainTraits = traits || generateRandomTraits();
  const prompt = buildPrompt(villainTraits);
  const rarityScore = calculateRarityScore(villainTraits);

  console.log('[IMAGEN] Generating villain with traits:', villainTraits);
  console.log('[IMAGEN] Rarity score:', rarityScore);

  try {
    let url: string;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const vertexRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.VERTEX_SA_KEY)?.trim();
    if (vertexRaw) {
      // Use Vertex AI endpoint (no RPD cap with billing)
      const { GoogleAuth } = await import('google-auth-library');
      let saKey: any;
      const raw = vertexRaw;
      if (raw.startsWith('{')) {
        saKey = JSON.parse(raw);
      } else {
        // Base64-encoded JSON (safer for Railway env vars)
        saKey = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      }
      const auth = new GoogleAuth({ credentials: saKey, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      const projectId = saKey.project_id || 'gen-lang-client-0281408352';
      url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-generate-001:predict`;
      headers['Authorization'] = `Bearer ${(token as any).token || token}`;
      console.log('[IMAGEN] Using Vertex AI');
    } else {
      // Fallback to Gemini API
      url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${process.env.GEMINI_API_KEY}`;
      console.log('[IMAGEN] Using Gemini API');
    }

    const payload = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1"
      }
    };

    // Try primary key, then fallback to secondary
    const apiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
    ].filter(Boolean) as string[];

    let lastError: Error | null = null;
    let imageBuffer: Buffer | null = null;

    // Build list of attempts: Vertex first (if configured), then Gemini API keys
    const attempts: Array<{ label: string; url: string; headers: Record<string, string> }> = [];

    if (vertexRaw) {
      attempts.push({ label: 'Vertex AI', url, headers: { ...headers } });
    }
    for (const key of apiKeys) {
      attempts.push({
        label: `Gemini API (${key.slice(-6)})`,
        url: `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${key}`,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        const response = await fetch(attempt.url, {
          method: 'POST',
          headers: attempt.headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Imagen API failed: ${response.status} ${response.statusText} - ${errText.slice(0, 200)}`);
        }

        const data: any = await response.json();

        if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
          throw new Error('No image generated by Imagen 4.0');
        }

        imageBuffer = Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
        console.log(`[IMAGEN] Image generated successfully via ${attempt.label}, size:`, imageBuffer.length, 'bytes');
        break;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[IMAGEN] ${attempt.label} failed:`, (err as Error).message);
        continue;
      }
    }

    if (!imageBuffer) {
      throw lastError || new Error('All Imagen API keys exhausted');
    }

    return {
      imageBuffer,
      traits: villainTraits,
      rarityScore,
    };
  } catch (error) {
    console.error('[IMAGEN] Image generation failed:', error);
    throw new Error(`Failed to generate villain image: ${error}`);
  }
}
