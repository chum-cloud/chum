import { VertexAI } from '@google-cloud/vertexai';

const PROJECT_ID = 'gen-lang-client-0281408352';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.0-flash';

let vertexClient: VertexAI | null = null;

function getVertexClient(): VertexAI {
  if (vertexClient) return vertexClient;

  // Support multiple env var names for service account credentials
  const raw = (
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    process.env.VERTEX_SA_KEY
  )?.trim();

  if (!raw) {
    throw new Error('Vertex AI not configured: set GOOGLE_SERVICE_ACCOUNT_JSON or VERTEX_SA_KEY');
  }

  let credentials: any;
  if (raw.startsWith('{')) {
    credentials = JSON.parse(raw);
  } else {
    // Base64-encoded JSON (safer for Railway env vars)
    credentials = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  }

  vertexClient = new VertexAI({
    project: credentials.project_id || PROJECT_ID,
    location: LOCATION,
    googleAuthOptions: { credentials },
  });

  return vertexClient;
}

/**
 * Generate text via Vertex AI (Gemini 2.0 Flash).
 * Used as primary LLM for CHUM thoughts, content, and chat.
 */
export async function generateVertexText(
  systemPrompt: string,
  userPrompt: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 150, temperature = 0.9 } = opts;

  const vertex = getVertexClient();
  const model = vertex.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  });

  const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Vertex AI returned empty response');
  }

  return text.trim();
}

/**
 * Multi-turn chat via Vertex AI (Gemini 2.0 Flash).
 * Used for interactive chat with conversation history.
 */
export async function generateVertexChat(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 300, temperature = 0.9 } = opts;

  const vertex = getVertexClient();
  const model = vertex.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  // Convert message history to Vertex AI format
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }));

  const result = await model.generateContent({ contents });

  const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Vertex AI chat returned empty response');
  }

  return text.trim();
}

/**
 * Check if Vertex AI is configured for text generation.
 */
export function isVertexConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.VERTEX_SA_KEY?.trim()
  );
}
