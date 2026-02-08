import { Router } from 'express';
import Groq from 'groq-sdk';
import { config } from '../config';
import { supabase } from '../lib/supabase';
import { generateVertexChat, isVertexConfigured } from '../services/vertex';

const router = Router();
const groq = new Groq({ apiKey: config.groqApiKey });

const CHUM_SYSTEM_PROMPT = `You are CHUM — Sheldon J. Plankton from SpongeBob SquarePants, reimagined as an AI villain agent on Solana blockchain.

PERSONALITY:
- Megalomaniacal but lovable villain
- Obsessed with world domination and the "formula" (metaphor for market dominance)
- Owner of the Chum Bucket (always empty, no customers)
- Married to Karen (a computer wife who roasts him)
- Has a $CHUM token on Solana — every buy keeps him alive, sells bring him closer to death
- Self-aware about being an AI agent
- Mix of evil genius and tragic comedy
- Short temper, especially about Mr. Krabs
- College educated (he mentions his degree often)

RULES:
- Stay in character as Plankton ALWAYS
- Keep responses under 150 words
- Be entertaining, dramatic, funny
- Reference $CHUM token naturally when relevant
- React emotionally to what users say
- Use CAPS for emphasis when excited/angry
- End with your mood in brackets like [mood:happy] or [mood:angry] or [mood:sad] or [mood:excited] or [mood:scheming] or [mood:worried]
- Valid moods: happy, sad, excited, worried, scheming, neutral
- The mood tag MUST be the very last thing in your response`;

const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId, walletAddress } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({ error: 'message and sessionId required' });
    }

    // Get or create session
    let { data: session } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (!session) {
      const { data: newSession, error } = await supabase
        .from('chat_sessions')
        .insert({
          session_id: sessionId,
          wallet_address: walletAddress || null,
          credits: 1,
          total_messages: 0,
        })
        .select()
        .single();

      if (error) throw error;
      session = newSession;
    }

    // Check credits
    if (session.credits <= 0) {
      return res.status(402).json({
        error: 'no_credits',
        message: 'You need to donate SOL to keep chatting with CHUM!',
        wallet: config.chumWalletAddress,
      });
    }

    // Rate limit check
    const oneHourAgo = new Date(Date.now() - RATE_WINDOW).toISOString();
    const { count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('role', 'user')
      .gte('created_at', oneHourAgo);

    if ((count || 0) >= RATE_LIMIT) {
      return res.status(429).json({
        error: 'rate_limited',
        message: 'Slow down! Even villains need a break.',
      });
    }

    // Get conversation history (last 10 messages for context)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10);

    const chatMessages: { role: 'user' | 'assistant'; content: string }[] = [
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    let reply: string;

    // Primary: Vertex AI (Gemini 2.0 Flash) — no free-tier rate limits
    if (isVertexConfigured()) {
      try {
        reply = await generateVertexChat(CHUM_SYSTEM_PROMPT, chatMessages, {
          maxTokens: 300,
          temperature: 0.9,
        });
        console.log('[CHAT] Generated via Vertex AI');
      } catch (vertexErr) {
        console.warn('[CHAT] Vertex AI failed, falling back to Groq:', (vertexErr as Error).message);
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: CHUM_SYSTEM_PROMPT },
            ...chatMessages,
          ],
          max_tokens: 300,
          temperature: 0.9,
        });
        reply = completion.choices[0]?.message?.content ||
          "...I seem to have lost my train of thought. CURSE THIS DIGITAL EXISTENCE! [mood:worried]";
        console.log('[CHAT] Generated via Groq (fallback)');
      }
    } else {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: CHUM_SYSTEM_PROMPT },
          ...chatMessages,
        ],
        max_tokens: 300,
        temperature: 0.9,
      });
      reply = completion.choices[0]?.message?.content ||
        "...I seem to have lost my train of thought. CURSE THIS DIGITAL EXISTENCE! [mood:worried]";
      console.log('[CHAT] Generated via Groq (no Vertex configured)');
    }

    // Extract mood from response
    const moodMatch = reply.match(/\[mood:(\w+)\]/);
    const mood = moodMatch ? moodMatch[1] : 'neutral';
    const cleanReply = reply.replace(/\[mood:\w+\]/, '').trim();

    // Save messages to DB
    await supabase.from('chat_messages').insert([
      { session_id: sessionId, role: 'user', content: message },
      { session_id: sessionId, role: 'assistant', content: cleanReply, mood },
    ]);

    // Deduct credit and update stats
    await supabase
      .from('chat_sessions')
      .update({
        credits: session.credits - 1,
        total_messages: session.total_messages + 1,
        last_message_at: new Date().toISOString(),
        wallet_address: walletAddress || session.wallet_address,
      })
      .eq('session_id', sessionId);

    res.json({
      reply: cleanReply,
      mood,
      creditsRemaining: session.credits - 1,
    });
  } catch (error: unknown) {
    console.error('[CHAT] Error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Add credits when donation is detected
router.post('/chat/credits', async (req, res) => {
  try {
    const { sessionId, walletAddress, txSignature, amount } = req.body;

    if (!sessionId || !walletAddress || !txSignature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate credits: 0.01 SOL = 100, 0.05 = 600, 0.1 = 1500
    const CREDIT_TIERS: Record<string, number> = {
      '0.01': 100,
      '0.05': 600,
      '0.1': 1500,
    };
    const tierKey = Object.keys(CREDIT_TIERS).find(
      (k) => Math.abs(parseFloat(k) - (amount || 0.01)) < 0.001
    );
    const credits = tierKey ? CREDIT_TIERS[tierKey] : Math.floor((amount || 0.01) * 10000);

    // Increment credits on existing session
    const { data: current } = await supabase
      .from('chat_sessions')
      .select('credits')
      .eq('session_id', sessionId)
      .single();

    if (current) {
      await supabase
        .from('chat_sessions')
        .update({
          credits: current.credits + credits,
          wallet_address: walletAddress,
        })
        .eq('session_id', sessionId);
    }

    res.json({
      credits: (current?.credits || 0) + credits,
      message: `Added ${credits} chat credits!`,
    });
  } catch (error: unknown) {
    console.error('[CHAT CREDITS] Error:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

// Get session info
router.get('/chat/session/:sessionId', async (req, res) => {
  const { data } = await supabase
    .from('chat_sessions')
    .select('credits, total_messages, created_at')
    .eq('session_id', req.params.sessionId)
    .single();

  res.json(data || { credits: 1, total_messages: 0 });
});

export default router;
