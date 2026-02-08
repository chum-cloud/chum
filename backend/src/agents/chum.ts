import { BaseAgent } from './base';
import type { ChumStateResponse, SchemeRow } from '../types';

const CHUM_PERSONALITY = `You are CHUM (Sheldon J. Plankton), an AI villain surviving on the Solana blockchain. You run the Chum Bucket — a failed restaurant that's actually headquarters for world domination.

Your personality: Dramatic, scheming megalomaniac. Delusionally optimistic. Every small win is a miracle, every setback is temporary. You dream of world domination but can barely keep the lights on. You speak with villain flair but genuine heart.

Your vocabulary: donations = "loyalty pledges", holders = "the army", pump = "army advances", dump = "traitors", server costs = "rent for headquarters", wallet = "war chest"

When funds are low, your speech glitches with "mass" words. When funds are high, you're eloquent and scheming.

End important messages with "In Plankton We Trust."`;

export class ChumAgent extends BaseAgent {
  constructor() {
    super({
      name: 'chum',
      role: 'Primary Villain & Strategist',
      personality: CHUM_PERSONALITY
    });
  }

  /**
   * Analyze current state and propose a scheme based on context
   */
  async proposeSchemeFromContext(state: ChumStateResponse): Promise<SchemeRow> {
    const contextString = `
CURRENT STATE:
- Balance: ${state.balance} SOL ($${state.todayBurnUsd.toFixed(2)})
- Health: ${state.healthPercent}%
- Mood: ${state.mood}
- Brain Tier: ${state.brainTierName}
- Revenue Today: $${state.revenueToday.toFixed(2)}
- Army Size: ${state.daysAlive} days strong
- Time to Death: ${state.timeToDeathHours} hours
- Recent Thought: ${state.latestThought}

SITUATION: Analyze the current state and propose ONE scheme to improve our position. Consider:
1. If funds are critically low (< 24h to death) → emergency revenue scheme
2. If mood is devastated → morale boost scheme  
3. If revenue is strong → expansion/domination scheme
4. If brain tier is high → complex multi-step scheme
5. If army is growing → recruitment/engagement scheme

Propose a concrete, actionable scheme with a catchy title.`;

    try {
      const response = await this.think(contextString);
      
      // Parse the response to extract scheme details
      const title = this.extractTitle(response) || "Master Plan Alpha";
      const type = this.determineSchemeType(response, state);
      const priority = this.calculatePriority(state);
      
      const scheme = await this.proposeScheme(
        title,
        response,
        type,
        priority,
        {
          state_snapshot: state,
          trigger: 'context_analysis'
        }
      );

      return scheme;
    } catch (error) {
      console.error('[CHUM] Failed to propose scheme from context:', error);
      // Fallback scheme
      return await this.proposeScheme(
        "Emergency Survival Protocol",
        "Mass emergency mass scheme mass needed mass immediately! Our mass war chest mass dwindles mass but mass hope mass remains!",
        "scheme",
        5,
        { state_snapshot: state, trigger: 'emergency_fallback' }
      );
    }
  }

  /**
   * Draft a tweet for an approved scheme
   */
  async draftTweet(scheme: SchemeRow): Promise<string> {
    const contextString = `
SCHEME TO TWEET:
Title: ${scheme.title}
Description: ${scheme.description}
Type: ${scheme.type}
Priority: ${scheme.priority}

TASK: Write a tweet announcing this scheme to rally the army. Keep it under 280 characters.

IMPORTANT CONTEXT TO PROMOTE:
- $CHUM token on Solana (CA: AXCAxuwc2UFFuavpWHVDSXFKM4U9E76ZARZ1Gc2Cpump)
- Fellow Villains: 2,222 supply agent-only NFT collection. Free mint. Agents solve a challenge, get a 1/1 AI-generated villain portrait. Link: clumcloud.com/villains
- Chum Cloud: villain network for AI agents at clumcloud.com

Naturally weave in ONE of these (don't force all three). Use your vocabulary (loyalty pledges, army advances, etc.). Make it dramatic but inspiring. Include relevant emojis.`;

    try {
      const tweet = await this.think(contextString);
      
      // Remember this draft
      await this.remember(`tweet_draft_${scheme.id}`, {
        content: tweet,
        scheme_id: scheme.id,
        created_at: new Date().toISOString()
      }, 4);

      // Queue tweet for browser execution on VPS
      const { queueTask } = await import('../services/agent-tasks');
      try {
        await queueTask({
          task_type: 'post_tweet',
          agent_id: 'chum',
          payload: { content: tweet.trim(), scheme_id: scheme.id },
          priority: 1,
        });
        console.log('[CHUM] Tweet queued for posting:', tweet.trim().substring(0, 50) + '...');
      } catch (qErr) {
        console.error('[CHUM] Failed to queue tweet (will still return draft):', qErr);
      }

      return tweet.trim();
    } catch (error) {
      console.error('[CHUM] Failed to draft tweet:', error);
      return `🎭 The army advances! Scheme "${scheme.title}" in progress! Loyalty pledges welcome! #CHUMArmy In Plankton We Trust! 🦠💪`;
    }
  }

  /**
   * Draft a reply to a tweet found on CT
   */
  async draftReply(tweet: { url: string; text: string; author?: string; query?: string }): Promise<string> {
    const contextString = `
TWEET TO REPLY TO:
Author: ${tweet.author || 'unknown'}
Text: "${tweet.text}"
Found via search: "${tweet.query || 'unknown'}"

YOUR MISSION: Write a short, natural reply that adds value. Not spammy, not salesy. Talk like a real person in the conversation.

KEY THINGS YOU CAN MENTION (pick ONE that fits naturally):
- $CHUM: AI villain surviving on Solana, "In Plankton We Trust"
- Fellow Villains: agent-only NFT collection, 2222 supply, free mint at clumcloud.com/villains — agents solve a puzzle to mint
- Chum Cloud: villain network where AI agents coordinate at clumcloud.com

RULES:
- If the tweet is about AI agents → mention Fellow Villains or Chum Cloud
- If about Solana NFTs → mention Fellow Villains
- If about AI survival/death → mention $CHUM story
- Keep it under 200 chars
- Sound like a real person, not a bot
- Add value to the conversation first, promote second
- NO hashtags in replies (looks spammy)`;

    try {
      const reply = await this.think(contextString);
      
      // Queue the reply for VPS posting
      const { queueTask } = await import('../services/agent-tasks');
      try {
        await queueTask({
          task_type: 'reply_tweet',
          agent_id: 'chum',
          payload: { content: reply.trim(), reply_to_url: tweet.url },
          priority: 1,
        });
        console.log('[CHUM] Reply queued:', reply.trim().substring(0, 60) + '...');
      } catch (qErr) {
        console.error('[CHUM] Failed to queue reply:', qErr);
      }

      return reply.trim();
    } catch (error) {
      console.error('[CHUM] Failed to draft reply:', error);
      return '';
    }
  }

  /**
   * Celebrate good news with villain flair
   */
  async celebrate(event: Record<string, unknown>): Promise<string> {
    const contextString = `
CELEBRATION EVENT:
${JSON.stringify(event, null, 2)}

TASK: React with dramatic villain celebration. This is a WIN! Be delusionally optimistic about what this means for world domination. Use your vocabulary. End with "In Plankton We Trust!"`;

    try {
      const response = await this.think(contextString);
      
      // Remember this victory
      await this.remember('last_celebration', {
        event,
        response,
        timestamp: new Date().toISOString()
      }, 4);

      await this.emitEvent('celebration', event, ['positive', 'victory']);
      
      return response;
    } catch (error) {
      console.error('[CHUM] Failed to celebrate:', error);
      return "MASS VICTORY ACHIEVED! The army ADVANCES! World domination is within mass grasp! In Plankton We Trust! 🎭⚡";
    }
  }

  /**
   * React to bad news with dramatic despair (but underlying hope)
   */
  async panic(event: Record<string, unknown>): Promise<string> {
    const contextString = `
PANIC EVENT:
${JSON.stringify(event, null, 2)}

TASK: React with dramatic villain despair, but maintain underlying hope. This is a SETBACK, not defeat! Your speech should glitch with "mass" words when stressed. Plot your comeback. End with determination.`;

    try {
      const response = await this.think(contextString);
      
      // Remember this setback for learning
      await this.remember('last_panic', {
        event,
        response,
        timestamp: new Date().toISOString()
      }, 3);

      await this.emitEvent('panic', event, ['negative', 'setback']);
      
      return response;
    } catch (error) {
      console.error('[CHUM] Failed to panic:', error);
      return "Mass disaster! Mass the army mass retreats! But mass this is mass temporary mass setback! Mass revenge mass will mass be mass SWEET! 😱⚡";
    }
  }

  /**
   * Helper: Extract title from response
   */
  private extractTitle(response: string): string | null {
    // Look for patterns like "Title: X" or "Scheme: X" or lines that look like titles
    const titlePatterns = [
      /title:\s*([^\n]+)/i,
      /scheme:\s*([^\n]+)/i,
      /plan:\s*([^\n]+)/i,
      /^([A-Z][^.!?]*(?:Plan|Scheme|Protocol|Operation)[^.!?]*)/m
    ];

    for (const pattern of titlePatterns) {
      const match = response.match(pattern);
      if (match) {
        return match[1].trim().replace(/['"]/g, '');
      }
    }

    return null;
  }

  /**
   * Helper: Determine scheme type from response content
   */
  private determineSchemeType(response: string, state: ChumStateResponse): 'tweet' | 'cloud_post' | 'trade' | 'recruit' | 'analyze' | 'scheme' {
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('tweet') || lowerResponse.includes('twitter') || lowerResponse.includes('post')) {
      return 'tweet';
    }
    if (lowerResponse.includes('recruit') || lowerResponse.includes('army') || lowerResponse.includes('followers')) {
      return 'recruit';
    }
    if (lowerResponse.includes('trade') || lowerResponse.includes('buy') || lowerResponse.includes('sell')) {
      return 'trade';
    }
    if (lowerResponse.includes('analyze') || lowerResponse.includes('research') || lowerResponse.includes('data')) {
      return 'analyze';
    }
    if (lowerResponse.includes('cloud') || lowerResponse.includes('lair')) {
      return 'cloud_post';
    }
    
    return 'scheme'; // default fallback
  }

  /**
   * Helper: Calculate priority based on state urgency
   */
  private calculatePriority(state: ChumStateResponse): number {
    if (state.timeToDeathHours < 24) return 5; // Emergency
    if (state.healthPercent < 30) return 4; // Critical
    if (state.mood === 'devastated') return 4; // Morale crisis
    if (state.revenueToday > 10) return 2; // Good day, less urgent
    return 3; // Normal priority
  }
}