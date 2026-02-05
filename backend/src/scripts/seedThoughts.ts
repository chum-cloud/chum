/**
 * Deletes all old thoughts and generates 3-4 new ones
 * using the updated villain/revolution prompt.
 * Bypasses cost gating since this is an admin operation.
 *
 * Usage: npx tsx src/scripts/seedThoughts.ts
 */
import Groq from 'groq-sdk';
import { config } from '../config';
import { deleteAllThoughts, insertThought } from '../services/supabase';
import { buildThoughtContext } from '../lib/buildContext';
import { buildUserPrompt, SYSTEM_PROMPT } from '../lib/prompt';
import { applyMassGlitch } from '../lib/massGlitch';

const groq = new Groq({ apiKey: config.groqApiKey });

const SEED_INSTRUCTIONS = [
  'Write a late-night scheming thought. You are alone at HQ, Karen is in sleep mode, and you are staring at your war chest balance. Hint at bigger plans.',
  'Write a thought about your Fellow Villains army growing. Someone new has enlisted. You are grateful but frame it as a military recruitment win.',
  'Write a thought about Mr. Krabs and the old world order. You are plotting to overthrow everything he represents. Be dramatic and confident.',
  'Write a thought where Karen gives you a tactical assessment of the revolution. She is dry and sarcastic but secretly supportive.',
];

async function generateDirect(context: Awaited<ReturnType<typeof buildThoughtContext>>, instruction: string): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(context, instruction) },
    ],
    temperature: 0.9,
    max_tokens: 150,
  });

  let text = completion.choices[0]?.message?.content?.trim() ?? '';
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1);
  }
  text = applyMassGlitch(text, context.healthPercent);
  if (text.length > 280) text = text.slice(0, 277) + '...';
  return text;
}

async function main() {
  console.log('[SEED] Deleting all old thoughts...');
  const deleted = await deleteAllThoughts();
  console.log(`[SEED] Deleted ${deleted} old thoughts.`);

  const context = await buildThoughtContext();

  for (let i = 0; i < SEED_INSTRUCTIONS.length; i++) {
    console.log(`[SEED] Generating thought ${i + 1}/${SEED_INSTRUCTIONS.length}...`);
    const content = await generateDirect(context, SEED_INSTRUCTIONS[i]);
    const thought = await insertThought(content, context.mood);
    console.log(`[SEED] #${thought.id}: "${content}"`);
  }

  console.log('[SEED] Done! New thoughts seeded.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[SEED] Failed:', err);
  process.exit(1);
});
