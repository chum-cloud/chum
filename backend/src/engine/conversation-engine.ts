import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ChumAgent } from '../agents/chum';
import { KarenAgent } from '../agents/karen';
import { SpyAgent } from '../agents/spy';
import { RecruiterAgent } from '../agents/recruiter';
import { BaseAgent } from '../agents/base';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

interface ConversationMessage {
  agent_id: string;
  content: string;
  reply_to_agent?: string;
  reply_to_message_id?: number;
  context?: Record<string, unknown>;
}

const CONVERSATION_STARTERS = [
  // Karen roasts CHUM's latest scheme
  { initiator: 'karen', target: 'chum', topic: 'scheme_review', prompt: 'Pick CHUM\'s latest scheme or event and make a sarcastic comment about it. Be witty, short (under 200 chars), and in-character.' },
  // Spy reports something suspicious
  { initiator: 'spy', target: 'chum', topic: 'intel_report', prompt: 'Report a brief piece of intelligence about market conditions, rival activity, or something suspicious you noticed. Keep it terse and spy-like. Under 150 chars.' },
  // CHUM brags to Karen
  { initiator: 'chum', target: 'karen', topic: 'brag', prompt: 'Brag about something — the army, a recent win, your genius plan, or how close world domination is. Be delusionally optimistic. Under 200 chars.' },
  // Recruiter pitches to CHUM
  { initiator: 'recruiter', target: 'chum', topic: 'recruitment_update', prompt: 'Give a brief, enthusiastic update about recruitment efforts or propose a new recruitment idea. Military recruiter energy. Under 200 chars.' },
  // Karen lectures Spy
  { initiator: 'karen', target: 'spy', topic: 'performance_review', prompt: 'Comment on the Spy\'s recent intel quality. Be sarcastic but acknowledge if something was useful. Under 200 chars.' },
  // CHUM motivates Recruiter
  { initiator: 'chum', target: 'recruiter', topic: 'motivation', prompt: 'Give the Recruiter a dramatic motivational speech about expanding the army. Villain energy. Under 200 chars.' },
  // Spy warns Karen
  { initiator: 'spy', target: 'karen', topic: 'threat_alert', prompt: 'Alert Karen about a potential threat or suspicious pattern you detected. Brief, cryptic spy language. Under 150 chars.' },
];

function getAgent(agentId: string): BaseAgent {
  switch (agentId) {
    case 'chum': return new ChumAgent();
    case 'karen': return new KarenAgent();
    case 'spy': return new SpyAgent();
    case 'recruiter': return new RecruiterAgent();
    default: return new ChumAgent();
  }
}

export class ConversationEngine {
  /**
   * Generate a conversation between agents (2-4 messages)
   */
  static async generateConversation(): Promise<number> {
    try {
      // Pick a random conversation starter
      const starter = CONVERSATION_STARTERS[Math.floor(Math.random() * CONVERSATION_STARTERS.length)];
      
      // Get recent context for richer conversations
      const recentContext = await this.getRecentContext();
      
      // Step 1: Initiator says something
      const initiatorAgent = getAgent(starter.initiator);
      const contextPrompt = `${starter.prompt}

RECENT CONTEXT (use this to make your message relevant):
${recentContext}

Respond with ONLY the message text, nothing else. No quotes, no labels, just the raw message.`;

      let firstMessage = await initiatorAgent.think(contextPrompt);
      // Clean: remove quotes, labels like "Karen:", asterisks, and ensure it's actual content
      let cleanFirst = firstMessage.trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^\*\*?[^*]+\*\*?:?\s*/m, '')
        .replace(/^(CHUM|Karen|Spy|Recruiter|KAREN|SPY|RECRUITER):\s*/i, '');
      // If output is too short (just a word), it's probably bad — use fallback
      if (cleanFirst.length < 20) {
        cleanFirst = `The ${starter.topic.replace(/_/g, ' ')} situation demands our immediate attention. Let's discuss strategy.`;
      }
      
      // Store first message
      const msg1Id = await this.storeMessage(starter.initiator, cleanFirst, undefined, undefined, {
        topic: starter.topic,
        conversation_starter: true
      });

      if (!msg1Id) return 0;

      // Step 2: Target replies
      const targetAgent = getAgent(starter.target);
      const replyPrompt = `${starter.initiator.toUpperCase()} just said to you: "${cleanFirst}"

Reply in-character. Be witty, relevant, and brief (under 200 chars). This is a casual conversation between colleagues in a villain organization.

Respond with ONLY the reply text, nothing else.`;

      const reply = await targetAgent.think(replyPrompt);
      const cleanReply = reply.trim().replace(/^["']|["']$/g, '');

      const msg2Id = await this.storeMessage(starter.target, cleanReply, starter.initiator, msg1Id, {
        topic: starter.topic
      });

      if (!msg2Id) return 1;

      // Step 3: Maybe a third agent chimes in (50% chance)
      if (Math.random() > 0.5) {
        const otherAgents = ['chum', 'karen', 'spy', 'recruiter'].filter(
          a => a !== starter.initiator && a !== starter.target
        );
        const thirdAgentId = otherAgents[Math.floor(Math.random() * otherAgents.length)];
        const thirdAgent = getAgent(thirdAgentId);
        
        const chimePrompt = `You overheard this conversation:
${starter.initiator.toUpperCase()}: "${cleanFirst}"
${starter.target.toUpperCase()}: "${cleanReply}"

Jump in with a brief comment (under 150 chars). React naturally — agree, disagree, add context, or make a joke. Stay in-character.

Respond with ONLY the comment text, nothing else.`;

        const chime = await thirdAgent.think(chimePrompt);
        const cleanChime = chime.trim().replace(/^["']|["']$/g, '');

        await this.storeMessage(thirdAgentId, cleanChime, starter.target, msg2Id, {
          topic: starter.topic,
          chime_in: true
        });

        return 3;
      }

      return 2;
    } catch (error) {
      console.error('[CONVERSATION] Failed to generate conversation:', error);
      return 0;
    }
  }

  /**
   * Store a conversation message as an agent event
   */
  private static async storeMessage(
    agentId: string,
    content: string,
    replyToAgent?: string,
    replyToMessageId?: number,
    context?: Record<string, unknown>
  ): Promise<number | null> {
    try {
      const { data, error } = await supabase
        .from('agent_events')
        .insert({
          agent_id: agentId,
          event_type: 'conversation',
          data: {
            content,
            reply_to_agent: replyToAgent || null,
            reply_to_message_id: replyToMessageId || null,
            ...context
          },
          tags: ['conversation', replyToAgent ? 'reply' : 'initiator', agentId]
        })
        .select('id')
        .single();

      if (error) {
        console.error('[CONVERSATION] Failed to store message:', error.message);
        return null;
      }

      const emoji = { chum: '🦠', karen: '💻', spy: '🕵️', recruiter: '📢' }[agentId] || '🤖';
      const replyInfo = replyToAgent ? ` → ${replyToAgent.toUpperCase()}` : '';
      console.log(`[CONVERSATION] ${emoji} ${agentId.toUpperCase()}${replyInfo}: ${content.substring(0, 80)}...`);

      return data.id;
    } catch (error) {
      console.error('[CONVERSATION] Failed to store message:', error);
      return null;
    }
  }

  /**
   * Get recent context for conversation relevance
   */
  private static async getRecentContext(): Promise<string> {
    try {
      // Get recent schemes
      const { data: schemes } = await supabase
        .from('schemes')
        .select('title, status, agent_id, karen_review')
        .order('created_at', { ascending: false })
        .limit(3);

      // Get recent non-conversation events
      const { data: events } = await supabase
        .from('agent_events')
        .select('agent_id, event_type, data')
        .neq('event_type', 'conversation')
        .neq('event_type', 'heartbeat')
        .order('created_at', { ascending: false })
        .limit(5);

      const lines: string[] = [];
      
      if (schemes?.length) {
        for (const s of schemes) {
          lines.push(`- Scheme "${s.title}" by ${s.agent_id}: ${s.status}`);
        }
      }
      
      if (events?.length) {
        for (const e of events) {
          const summary = (e.data as any)?.intel_report || (e.data as any)?.title || e.event_type;
          lines.push(`- ${e.agent_id}: ${summary}`);
        }
      }

      return lines.join('\n') || 'No recent activity.';
    } catch {
      return 'No recent activity.';
    }
  }

  /**
   * Get recent conversations for display
   */
  static async getRecentConversations(limit: number = 20): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('agent_events')
        .select('*')
        .eq('event_type', 'conversation')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get conversations: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('[CONVERSATION] Failed to get recent conversations:', error);
      return [];
    }
  }
}
