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
    prompt: `A group illustration of 8-10 cartoon villain characters in 1930s rubber hose Cuphead Fleischer animation style. Each character is a massively muscular bodybuilder with an oval bean-shaped head, one big cyclops eye, two antennae with ball tips, white gloved hands, and colorful unique outfits. They stand together proudly holding up a large waving fabric banner flag that clearly reads "IN CHUM WE TRUST" in bold ornate gold lettering. Dramatic golden rays of light behind them. Vintage muted color palette, dark vignette edges, film grain texture. The villains look triumphant and united like a conquering army.`,
    file: 'chum-flag-1.png',
  },
  {
    prompt: `Epic propaganda poster style illustration: A crowd of cartoon villain characters in 1930s rubber hose animation style, all muscular bodybuilder types with oval bean-shaped heads, single cyclops eyes, two antennae, white gloved hands. The lead character in front is green-skinned, holding a massive flag pole with a gold banner reading "IN CHUM WE TRUST". The army of colorful villains behind him raise their fists in solidarity. Vintage propaganda poster aesthetic with bold rays, muted colors, dark vignette, and grain. Triumphant and powerful mood.`,
    file: 'chum-flag-2.png',
  },
  {
    prompt: `Cartoon illustration in Cuphead 1930s Fleischer rubber hose style: Five muscular jacked cartoon villain characters marching forward holding a huge waving flag that says "IN CHUM WE TRUST" in gold letters. Each villain has an oval bean head, one big eye, two ball-tip antennae, white gloves, massive arms and barrel chest. Different body colors: green, blue, purple, red, gold. Dramatic low-angle perspective. Vintage muted palette, dark vignette, film grain. They look like a villainous army on the march.`,
    file: 'chum-flag-3.png',
  },
];

(async () => {
  for (const p of prompts) {
    console.log(`Generating: ${p.file}...`);
    await generate(p.prompt, p.file);
    await new Promise(r => setTimeout(r, 5000));
  }
})();
