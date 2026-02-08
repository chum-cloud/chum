#!/usr/bin/env node
// Pre-generate villain art pool
// Usage: GEMINI_API_KEY=xxx SUPABASE_URL=xxx SUPABASE_ANON_KEY=xxx node scripts/pregen-villains.js [count]

const { createClient } = require('@supabase/supabase-js');
const COUNT = parseInt(process.argv[2] || '10');

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!GEMINI_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Need GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BODY_COLORS = [
  { value: 'green', weight: 25 }, { value: 'red', weight: 15 }, { value: 'blue', weight: 15 },
  { value: 'purple', weight: 15 }, { value: 'orange', weight: 15 }, { value: 'yellow', weight: 15 },
];
const HATS = [
  { value: 'chef hat', weight: 20 }, { value: 'top hat', weight: 20 }, { value: 'pirate hat', weight: 20 },
  { value: 'helmet', weight: 20 }, { value: 'crown', weight: 10 },
];
const EYE_COLORS = [
  { value: 'yellow', weight: 25 }, { value: 'red', weight: 20 }, { value: 'blue', weight: 20 },
  { value: 'green', weight: 20 }, { value: 'pink', weight: 15 },
];
const ACCESSORIES = [
  { value: 'none', weight: 40 }, { value: 'monocle', weight: 15 }, { value: 'sunglasses', weight: 15 },
  { value: 'eyepatch', weight: 15 }, { value: 'scar', weight: 15 },
];
const EXPRESSIONS = [
  { value: 'evil grin', weight: 20 }, { value: 'angry', weight: 20 }, { value: 'scheming', weight: 20 },
  { value: 'confident', weight: 15 }, { value: 'happy', weight: 10 }, { value: 'worried', weight: 10 },
  { value: 'maniacal laugh', weight: 5 },
];
const BACKGROUNDS = ['dark', 'dark green', 'dark blue', 'dark red', 'dark purple', 'chum bucket'];

function weightedRandom(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) { r -= item.weight; if (r <= 0) return item.value; }
  return items[items.length - 1].value;
}

function generateTraits() {
  return {
    bodyColor: weightedRandom(BODY_COLORS), hat: weightedRandom(HATS), eyeColor: weightedRandom(EYE_COLORS),
    accessory: weightedRandom(ACCESSORIES), expression: weightedRandom(EXPRESSIONS),
    background: BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)],
  };
}

function buildPrompt(t) {
  const hatDesc = { 'chef hat': 'wearing a white chef hat', 'top hat': 'wearing a black top hat', 'pirate hat': 'wearing a black pirate hat with skull and crossbones', 'helmet': 'wearing a metallic helmet', 'crown': 'wearing a golden crown' }[t.hat] || '';
  let accDesc = '';
  if (t.accessory !== 'none') {
    accDesc = { monocle: 'wearing a monocle', sunglasses: 'wearing cool sunglasses', eyepatch: 'wearing an eyepatch', scar: 'with a scar across the face' }[t.accessory] || '';
  }
  const outfits = ['wearing a villain cape with high collar','wearing a lab coat with pens in pocket','wearing a leather jacket with studs','wearing a military uniform with medals','wearing a tuxedo with bow tie','wearing a trench coat with popped collar','wearing a striped prison outfit','wearing a fancy vest and dress shirt','wearing a Hawaiian shirt','wearing a hoodie','wearing a suit of armor','wearing a business suit with tie','wearing a bomber jacket','wearing a kimono robe','wearing a wrestling singlet','wearing overalls'];
  const outfit = outfits[Math.floor(Math.random() * outfits.length)];
  const poses = ['three-quarter view, one gloved hand raised waving, other hand behind back','leaning forward menacingly, gloved hands rubbing together in front','arms crossed over chest confidently, slight head tilt','pointing at viewer with one gloved hand, other hand on hip','laughing maniacally, one gloved hand covering mouth','scheming pose, one gloved hand stroking chin, other behind back','dynamic angle from below, both gloved fists raised in victory','slight dutch angle, one gloved hand adjusting hat','gloved hands on hips in a power pose, chest puffed out','one gloved hand holding a cane, other hand in pocket','one gloved fist raised triumphantly in the air','dramatic side profile, gloved hand reaching toward viewer'];
  const pose = poses[Math.floor(Math.random() * poses.length)];
  return `Half-body portrait of a 1930s Cuphead-style cartoon villain character. Oval bean-shaped ${t.bodyColor} head with ONE large ${t.eyeColor} cyclops eye, two thin antennae with ball tips on top. Human-like body with thin noodle limbs, white gloved hands, ${hatDesc}, ${outfit}. ${accDesc ? accDesc + '. ' : ''}${t.expression} expression. ${pose}. Rubber hose animation style, thick black outlines, muted vintage palette, solid dark background. Portrait composition.`;
}

async function generateImage(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_KEY}`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '1:1' } }) });
  const d = await r.json();
  if (!d.predictions?.[0]?.bytesBase64Encoded) throw new Error('No image: ' + JSON.stringify(d).slice(0, 200));
  return Buffer.from(d.predictions[0].bytesBase64Encoded, 'base64');
}

async function main() {
  console.log(`Pre-generating ${COUNT} villains...`);
  for (let i = 0; i < COUNT; i++) {
    const traits = generateTraits();
    const prompt = buildPrompt(traits);
    console.log(`\n[${i+1}/${COUNT}] ${traits.bodyColor} ${traits.hat} ${traits.expression}...`);
    
    const t = Date.now();
    const buf = await generateImage(prompt);
    console.log(`  Image: ${buf.length} bytes in ${((Date.now()-t)/1000).toFixed(1)}s`);

    // Upload to Supabase storage
    const filename = `villain-pool-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`;
    const { error: upErr } = await supabase.storage.from('villains').upload(filename, buf, { contentType: 'image/png' });
    if (upErr) throw new Error('Upload failed: ' + upErr.message);
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/villains/${filename}`;
    console.log(`  Uploaded: ${filename}`);

    // Insert with unique pool address
    const { data, error } = await supabase.from('villains').insert({
      wallet_address: `pool-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      image_url: imageUrl,
      metadata_url: '',
      traits,
      donation_amount: 0,
      rarity_score: Math.round(Math.random() * 200),
      is_minted: false,
    }).select().single();
    if (error) throw new Error('Insert failed: ' + error.message);
    console.log(`  DB: villain #${data.id} ✅`);
  }
  console.log('\nDone! 🎉');
}

main().catch(e => { console.error(e); process.exit(1); });
