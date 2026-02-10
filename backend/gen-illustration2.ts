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

const prompts = [
  {
    prompt: `A group illustration of 8-10 cartoon villain characters in 1930s rubber hose Cuphead Fleischer animation style. Each character has an oval bean-shaped head, one big cyclops eye, two antennae with golden ball tips, white gloved hands, and thin noodle-like limbs. They have DIFFERENT body colors: blue, teal, red, green, gold, purple, coral. Each wears a unique outfit and hat — wizard hat, top hat, chef hat, pirate bandana, lab coat, hawaiian shirt, vampire cape, detective trenchcoat, hoodie. They stand together proudly holding a large waving fabric banner flag that clearly reads "IN CHUM WE TRUST" in bold ornate gold lettering. Clean bright background with golden rays, NO dark borders, NO vignette. Vintage muted color palette with film grain texture. The villains look triumphant and united.`,
    file: 'chum-flag-v2-1.png',
  },
  {
    prompt: `Epic propaganda poster illustration: A crowd of cartoon villain characters in 1930s rubber hose animation style. Each has an oval bean head, single cyclops eye, two antennae with ball tips, white gloved hands, thin noodle limbs. Various body colors: blue, teal, red, green, gold, purple, orange. Various hats and outfits: wizard hats, top hats, chef hats, cowboy hats, lab coats, capes, suits, hawaiian shirts. The lead character in front holds a massive flag pole with a gold banner reading "IN CHUM WE TRUST". The colorful army of villains behind raise their fists. Clean bright background with bold rays, NO dark edges, NO vignette, NO black border. Vintage cartoon propaganda poster aesthetic.`,
    file: 'chum-flag-v2-2.png',
  },
  {
    prompt: `Cartoon illustration in Cuphead 1930s Fleischer rubber hose style: A diverse group of 6 cartoon villain characters marching forward holding a huge waving flag that says "IN CHUM WE TRUST" in gold letters. Each villain has an oval bean head, one big eye, two ball-tip antennae, white gloves, thin noodle arms and legs. Different body colors: blue, red, teal, green, gold, purple. Each wearing different costumes: wizard robe with star hat, detective trenchcoat with bowler hat, pirate outfit with skull bandana, chef uniform with chef hat, vampire cape, lab coat with goggles. Clean light background, NO dark vignette, NO black borders. Vintage muted palette, film grain.`,
    file: 'chum-flag-v2-3.png',
  },
];

(async () => {
  for (const p of prompts) {
    console.log(`Generating: ${p.file}...`);
    await generate(p.prompt, p.file);
    await new Promise(r => setTimeout(r, 5000));
  }
})();
