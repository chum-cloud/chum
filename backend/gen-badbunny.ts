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
      parameters: { sampleCount: 1, aspectRatio: '1:1', safetyFilterLevel: 'block_few' },
    }),
  });

  if (!res.ok) {
    console.error('Error:', res.status, await res.text());
    return;
  }

  const data = await res.json() as any;
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) { console.error('No image'); return; }

  const outPath = path.join(__dirname, '..', filename);
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  console.log(`Saved: ${outPath} (${Buffer.from(b64, 'base64').length} bytes)`);
}

const base = `Half-body portrait of a 1930s Cuphead-style cartoon villain character inspired by a reggaeton superstar performing at a big sports event. Oval bean-shaped teal head with ONE large red cyclops eye, two thin antennae with ball tips on top. White gloved hands, thin noodle limbs. Rubber hose animation style, thick black outlines, muted vintage palette, solid dark background. Portrait composition.`;

const prompts = [
  {
    prompt: `${base} Wearing an oversized cream-colored sweatshirt with number 64 on front, cream pants, cream gloves. Headset microphone on face. Arms spread wide open dramatically, mouth open singing. Confident powerful expression. Slight goatee drawn on chin.`,
    file: 'badbunny-villain-1.png',
  },
  {
    prompt: `${base} Wearing an oversized cream-colored jersey with number 64, cream baggy pants. Headset microphone. One gloved hand pointing at the viewer, other hand on hip. Smirking villain expression. Small goatee. Gold chain necklace. Cool sunglasses pushed up on forehead.`,
    file: 'badbunny-villain-2.png',
  },
  {
    prompt: `${base} Wearing an oversized white sweatshirt with number 64, white pants, white gloves. Headset microphone. Both fists raised triumphantly in victory pose. Screaming with excitement. Confetti around. Small goatee on chin. Eyepatch accessory. Dynamic angle from below.`,
    file: 'badbunny-villain-3.png',
  },
];

(async () => {
  for (let i = 0; i < prompts.length; i++) {
    console.log(`Generating ${prompts[i].file}...`);
    await generate(prompts[i].prompt, prompts[i].file);
    if (i < prompts.length - 1) {
      console.log('Waiting 30s...');
      await new Promise(r => setTimeout(r, 30000));
    }
  }
  console.log('Done!');
})();
