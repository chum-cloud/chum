import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

const SA_PATH = path.join(__dirname, '..', 'vertex-sa.json');
const saKey = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));

async function generate(prompt: string, filename: string) {
  const auth = new GoogleAuth({
    credentials: saKey,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const projectId = saKey.project_id;
  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-generate-001:predict`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '16:9',
        safetyFilterLevel: 'block_few',
      },
    }),
  });

  if (!res.ok) {
    console.error('Error:', res.status, await res.text());
    return;
  }

  const data = await res.json() as any;
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) {
    console.error('No image in response');
    return;
  }

  const outPath = path.join(__dirname, '..', filename);
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  console.log(`Saved: ${outPath} (${Buffer.from(b64, 'base64').length} bytes)`);
}

// Match exact character style from the NFT collection — mix of muscular and skinny
const prompt = `Group illustration of 8 cartoon villain characters standing together holding a large waving flag that reads "IN CHUM WE TRUST" in bold gold letters. 1930s Cuphead rubber hose animation style. Each character has an oval bean-shaped head with ONE large cyclops eye, two thin antennae with ball tips on top, white gloved hands. Mix of body types: some are massively muscular bodybuilders with huge arms and barrel chests, others are thin and skinny with noodle limbs. Different body colors: blue, teal, red, green, gold, purple, coral. Each wearing different outfits: villain cape with high collar, lab coat, leather jacket, tuxedo with bow tie, Hawaiian shirt, military uniform, trench coat, hoodie. Various hats: wizard hat with stars, pirate hat with skull, top hat, chef hat, viking helmet, fedora. Some have accessories: monocle, eyepatch, sunglasses, scar. Rubber hose animation style, thick black outlines, muted vintage palette. Solid dark background, NO vignette, NO gradient borders. Portrait group composition, characters visible from waist up.`;

(async () => {
  console.log('Generating flag illustration...');
  await generate(prompt, 'chum-flag-final.png');
})();
