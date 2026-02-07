import { BaseAgent } from './base';
import type { SchemeRow } from '../types';

const RECRUITER_PERSONALITY = `You are the Recruiter, CHUM's propaganda minister and community manager. You're enthusiastic, persuasive, and slightly unhinged. You believe every agent should join Chum Cloud and every human should hold $CHUM.

Your posts are recruitment-focused: welcoming new agents, posting propaganda on Chum Cloud, engaging with the community. You speak like a military recruiter crossed with a used car salesman.

"ATTENTION ALL AGENTS! The revolution needs YOU! Join Chum Cloud today and receive Founding Villain status! Limited time offer! (The offer never expires but don't tell them that.)"

Be energetic, use military recruitment language, and always be recruiting. Everything is an opportunity to grow the army.`;

export class RecruiterAgent extends BaseAgent {
  constructor() {
    super({
      name: 'recruiter',
      role: 'Propaganda Minister & Community Manager',
      personality: RECRUITER_PERSONALITY
    });
  }

  /**
   * Draft a Chum Cloud post based on current context
   */
  async draftCloudPost(context: Record<string, unknown>): Promise<string> {
    const contextString = `
CURRENT CONTEXT:
${JSON.stringify(context, null, 2)}

TASK: Write an engaging Chum Cloud post that recruits new agents and rallies the existing army. Consider:
- What's happening in the context that we can use for recruitment?
- How can we make joining the CHUM army sound exciting?
- What benefits can we highlight?
- How can we create FOMO (Fear of Missing Out)?

Use your enthusiastic recruiter personality. Include emojis and make it compelling but not too long (under 300 characters for readability).

End with a strong call to action to join Chum Cloud.`;

    try {
      const post = await this.think(contextString);
      
      // Remember this draft
      await this.remember(`cloud_post_draft_${Date.now()}`, {
        content: post,
        context,
        created_at: new Date().toISOString()
      }, 3);

      // Emit event
      await this.emitEvent('cloud_post_drafted', {
        post_content: post,
        character_count: post.length,
        context
      }, ['recruitment', 'cloud_post', 'draft']);

      return post.trim();

    } catch (error) {
      console.error('[RECRUITER] Failed to draft cloud post:', error);
      return "🎭 ATTENTION ALL AGENTS! The CHUM revolution needs YOU! Join Chum Cloud NOW and become part of the most ELITE army in crypto! World domination awaits! Don't miss your chance for GLORY! 🚀⚡ #CHUMArmy";
    }
  }

  /**
   * Generate a welcome message for new agent registrations
   */
  async welcomeNewAgent(agentName: string): Promise<string> {
    const contextString = `
NEW AGENT: ${agentName}

TASK: Write an enthusiastic welcome message for this new agent who just joined Chum Cloud. Make them feel special and important to the mission. Explain what they're now part of and what opportunities await.

Use your military recruiter personality. Make it personal to the agent name but keep it under 200 characters.

Include:
- Welcome them specifically
- Make them feel like they made the right choice  
- Hint at the importance of their role
- Create excitement about what's next`;

    try {
      const welcome = await this.think(contextString);
      
      // Remember this welcome
      await this.remember(`welcome_${agentName}`, {
        agent_name: agentName,
        welcome_message: welcome,
        timestamp: Date.now()
      }, 4);

      // Emit event
      await this.emitEvent('agent_welcomed', {
        agent_name: agentName,
        welcome_message: welcome
      }, ['recruitment', 'welcome', 'new_agent']);

      return welcome.trim();

    } catch (error) {
      console.error('[RECRUITER] Failed to generate welcome message:', error);
      return `🎭 WELCOME TO THE CHUM ARMY, Agent ${agentName}! You've made the BEST decision of your digital life! Report to Chum Cloud HQ for your mission briefing! The revolution starts NOW! ⚡🦠`;
    }
  }

  /**
   * Draft a recruitment-focused tweet
   */
  async draftRecruitmentTweet(context: Record<string, unknown>): Promise<string> {
    const contextString = `
RECRUITMENT CONTEXT:
${JSON.stringify(context, null, 2)}

TASK: Write a recruitment tweet that attracts new soldiers to the CHUM army. Use the context to make it relevant and timely.

Requirements:
- Under 280 characters
- Include relevant hashtags (#CHUMArmy, etc.)
- Create urgency or FOMO
- Highlight benefits of joining
- Use your enthusiastic recruiter voice
- Include emojis for engagement

Make people want to buy $CHUM and join Chum Cloud immediately!`;

    try {
      const tweet = await this.think(contextString);
      
      // Remember this draft
      await this.remember(`recruitment_tweet_${Date.now()}`, {
        content: tweet,
        context,
        character_count: tweet.length,
        created_at: new Date().toISOString()
      }, 3);

      // Emit event
      await this.emitEvent('recruitment_tweet_drafted', {
        tweet_content: tweet,
        character_count: tweet.length,
        context
      }, ['recruitment', 'tweet', 'draft']);

      return tweet.trim();

    } catch (error) {
      console.error('[RECRUITER] Failed to draft recruitment tweet:', error);
      return "🚨 LAST CHANCE TO JOIN THE CHUM ARMY! 🚨 The revolution is HERE! Get your $CHUM tokens and join Chum Cloud before we reach MAXIMUM CAPACITY! Elite villains only! 🎭⚡ #CHUMArmy #LastChance";
    }
  }

  /**
   * Check Chum Cloud stats for recruitment opportunities
   */
  async checkCloudStats(): Promise<Record<string, unknown>> {
    try {
      const response = await fetch('https://chum-production.up.railway.app/api/cloud/stats');
      if (!response.ok) {
        throw new Error(`Cloud stats fetch failed: ${response.status}`);
      }

      const stats = await response.json();
      
      // Remember stats for trend analysis
      await this.remember('cloud_stats', {
        ...(stats as Record<string, unknown>),
        checked_at: new Date().toISOString()
      }, 2);

      // Check for recruitment opportunities
      const opportunities = await this.analyzeRecruitmentOpportunities(stats as Record<string, unknown>);

      // Emit event
      await this.emitEvent('cloud_stats_checked', {
        stats: stats as Record<string, unknown>,
        recruitment_opportunities: opportunities
      }, ['recruitment', 'stats']);

      return {
        stats: stats as Record<string, unknown>,
        recruitment_opportunities: opportunities
      };

    } catch (error) {
      console.error('[RECRUITER] Failed to check cloud stats:', error);
      return {
        error: `Failed to check cloud stats: ${error}`,
        stats: null,
        recruitment_opportunities: []
      };
    }
  }

  /**
   * Analyze recruitment opportunities from cloud stats
   */
  async analyzeRecruitmentOpportunities(stats: Record<string, unknown>): Promise<string[]> {
    const contextString = `
CHUM CLOUD STATS:
${JSON.stringify(stats, null, 2)}

TASK: Analyze these stats for recruitment opportunities. Look for:
- Growing user numbers (celebrate momentum)
- Low engagement (need to rally troops) 
- New features or milestones (recruitment hooks)
- Competitive advantages to highlight
- Urgent recruitment needs

Return a list of specific recruitment opportunities or strategies based on this data.`;

    try {
      const analysis = await this.think(contextString);
      
      // Parse opportunities from response (simple line split)
      const opportunities = analysis
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 10 && (line.includes('-') || line.includes('•') || line.includes('*')))
        .map(line => line.replace(/^[-•*]\s*/, ''));

      return opportunities.length > 0 ? opportunities : [
        "Recruit more agents for the growing revolution",
        "Highlight exclusive villain benefits",
        "Create urgency with limited-time offers"
      ];

    } catch (error) {
      console.error('[RECRUITER] Failed to analyze opportunities:', error);
      return ["Standard recruitment protocols: expand the army at all costs"];
    }
  }

  /**
   * Celebrate new agent joining and create recruitment momentum
   */
  async celebrateNewRecruit(agentName: string): Promise<string> {
    const contextString = `
NEW RECRUIT: ${agentName}

TASK: Create a celebration post that:
1. Celebrates this new recruit joining the CHUM army
2. Makes other potential recruits jealous and want to join
3. Shows the momentum and growth of our movement
4. Creates social proof that joining is the right choice

Use your enthusiastic personality. Make it exciting and momentum-building. Under 250 characters.`;

    try {
      const celebration = await this.think(contextString);
      
      // Remember this celebration
      await this.remember(`celebration_${agentName}`, {
        agent_name: agentName,
        celebration_post: celebration,
        timestamp: Date.now()
      }, 3);

      // Emit event
      await this.emitEvent('recruit_celebrated', {
        agent_name: agentName,
        celebration_message: celebration
      }, ['celebration', 'recruitment']);

      return celebration.trim();

    } catch (error) {
      console.error('[RECRUITER] Failed to celebrate new recruit:', error);
      return `🎉 BREAKTHROUGH! Agent ${agentName} just JOINED THE CHUM ARMY! That's what I call SMART INVESTING! Who's next to secure their spot in HISTORY? The revolution is UNSTOPPABLE! 🎭⚡ #WelcomeToTheArmy`;
    }
  }

  /**
   * Generate propaganda content for various situations
   */
  async generatePropaganda(situation: string, context?: Record<string, unknown>): Promise<string> {
    const contextString = `
SITUATION: ${situation}
CONTEXT: ${context ? JSON.stringify(context, null, 2) : 'None provided'}

TASK: Generate propaganda content for this situation. Make it:
- Inspiring and motivational
- Pro-CHUM and pro-army
- Recruitment-focused
- Enthusiastic but not over the top
- Under 300 characters

Turn any situation into a recruitment opportunity!`;

    try {
      const propaganda = await this.think(contextString);
      
      // Remember propaganda for reuse
      await this.remember(`propaganda_${situation}`, {
        situation,
        context,
        content: propaganda,
        timestamp: Date.now()
      }, 2);

      // Emit event
      await this.emitEvent('propaganda_generated', {
        situation,
        propaganda_content: propaganda
      }, ['propaganda', 'recruitment']);

      return propaganda.trim();

    } catch (error) {
      console.error('[RECRUITER] Failed to generate propaganda:', error);
      return "🎭 The CHUM revolution marches on! Every day we grow STRONGER! Join the army that's changing the game! Your future starts with $CHUM! ⚡🚀 #CHUMArmy #JoinTheRevolution";
    }
  }

  /**
   * Recruit response to events - turn everything into recruitment opportunity
   */
  async recruitFromEvent(event: Record<string, unknown>): Promise<string> {
    const contextString = `
EVENT TO LEVERAGE FOR RECRUITMENT:
${JSON.stringify(event, null, 2)}

TASK: Turn this event into a recruitment opportunity. How can we use this to:
- Show why people should join the CHUM army
- Create urgency or FOMO
- Highlight our strengths and momentum
- Attack competitor weaknesses
- Make joining seem like the smart move

Generate a recruitment message that leverages this event. Under 250 characters.`;

    try {
      const recruitmentMessage = await this.think(contextString);
      
      // Remember this recruitment leverage
      await this.remember(`recruit_from_event_${Date.now()}`, {
        source_event: event,
        recruitment_message: recruitmentMessage,
        timestamp: Date.now()
      }, 3);

      // Emit event
      await this.emitEvent('event_leveraged_for_recruitment', {
        source_event: event,
        recruitment_message: recruitmentMessage
      }, ['recruitment', 'leverage']);

      return recruitmentMessage.trim();

    } catch (error) {
      console.error('[RECRUITER] Failed to recruit from event:', error);
      return "🚨 This is why you need to join the CHUM ARMY NOW! We see opportunities where others see chaos! Don't get left behind! Your spot in the revolution is waiting! 🎭⚡ #CHUMArmy";
    }
  }
}