import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { 
  AgentEventRow,
  AgentPolicyRow
} from '../types';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

interface ReactionPattern {
  source: string;           // Source agent ID
  tags: string[];          // Event tags to match
  target: string;          // Target agent ID to react
  type: string;            // Type of reaction
  probability: number;     // 0.0 to 1.0
  cooldown: number;        // Minutes between same reactions
}

interface ReactionMatrix {
  patterns: ReactionPattern[];
}

export class ReactionEngine {
  /**
   * Process reaction queue by scanning recent events
   */
  static async processReactions(): Promise<number> {
    try {
      // Get the reaction matrix
      const matrix = await this.getReactionMatrix();
      if (!matrix || !matrix.patterns || matrix.patterns.length === 0) {
        console.log('[REACTION_ENGINE] No reaction patterns configured');
        return 0;
      }

      // Get recent events (last 30 minutes)
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

      const { data: events, error: eventsError } = await supabase
        .from('agent_events')
        .select('*')
        .gte('created_at', thirtyMinutesAgo.toISOString())
        .order('created_at', { ascending: false });

      if (eventsError) {
        throw new Error(`Failed to get recent events: ${eventsError.message}`);
      }

      const recentEvents = (events || []) as AgentEventRow[];
      let reactionsTriggered = 0;

      // Process each pattern against recent events
      for (const pattern of matrix.patterns) {
        try {
          const matchingEvents = this.findMatchingEvents(pattern, recentEvents);
          
          for (const event of matchingEvents) {
            // Check if we should react (probability + cooldown)
            if (await this.shouldReact(pattern, event)) {
              await this.executeReaction(pattern, event);
              reactionsTriggered++;
            }
          }

        } catch (error) {
          console.error(`[REACTION_ENGINE] Failed to process pattern ${pattern.type}:`, error);
        }
      }

      console.log(`[REACTION_ENGINE] Processed ${matrix.patterns.length} patterns, triggered ${reactionsTriggered} reactions`);
      return reactionsTriggered;

    } catch (error) {
      console.error('[REACTION_ENGINE] Failed to process reactions:', error);
      return 0;
    }
  }

  /**
   * Execute a reaction based on pattern and source event
   */
  static async executeReaction(pattern: ReactionPattern, sourceEvent: AgentEventRow): Promise<void> {
    try {
      console.log(`[REACTION_ENGINE] Executing reaction: ${pattern.target} reacting to ${pattern.source}'s ${sourceEvent.event_type}`);

      // Create reaction context
      const reactionContext = {
        reaction_type: pattern.type,
        source_agent: pattern.source,
        source_event_type: sourceEvent.event_type,
        source_event_data: sourceEvent.data,
        source_event_tags: sourceEvent.tags,
        triggered_at: new Date().toISOString()
      };

      // Route reaction based on type
      await this.routeReaction(pattern.type, pattern.target, reactionContext);

      // Record the reaction for cooldown tracking
      await this.recordReaction(pattern, sourceEvent);

      // Emit reaction event
      await this.emitEvent(pattern.target, 'reaction_executed', {
        reaction_pattern: {
          source: pattern.source,
          type: pattern.type,
          target: pattern.target
        },
        source_event_id: sourceEvent.id,
        reaction_context: reactionContext
      }, ['reaction', 'automated']);

    } catch (error) {
      console.error(`[REACTION_ENGINE] Failed to execute reaction:`, error);
      throw error;
    }
  }

  /**
   * Get the reaction matrix from agent policies
   */
  static async getReactionMatrix(): Promise<ReactionMatrix | null> {
    try {
      const { data: policy, error } = await supabase
        .from('agent_policies')
        .select('value')
        .eq('key', 'reaction_matrix')
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get reaction matrix: ${error.message}`);
      }

      if (!policy || !policy.value) {
        return null;
      }

      return policy.value as ReactionMatrix;

    } catch (error) {
      console.error('[REACTION_ENGINE] Failed to get reaction matrix:', error);
      return null;
    }
  }

  /**
   * Find events that match a reaction pattern
   */
  private static findMatchingEvents(pattern: ReactionPattern, events: AgentEventRow[]): AgentEventRow[] {
    return events.filter(event => {
      // Must be from the source agent
      if (event.agent_id !== pattern.source) {
        return false;
      }

      // Must have at least one matching tag
      const eventTags = event.tags || [];
      const hasMatchingTag = pattern.tags.some(tag => eventTags.includes(tag));
      
      return hasMatchingTag;
    });
  }

  /**
   * Determine if we should react based on probability and cooldown
   */
  private static async shouldReact(pattern: ReactionPattern, sourceEvent: AgentEventRow): Promise<boolean> {
    try {
      // Check probability
      if (Math.random() > pattern.probability) {
        return false;
      }

      // Check cooldown
      if (pattern.cooldown > 0) {
        const cooldownKey = `${pattern.target}_reaction_${pattern.type}_${pattern.source}`;
        const lastReaction = await this.getLastReactionTime(cooldownKey);
        
        if (lastReaction) {
          const cooldownEnd = lastReaction.getTime() + (pattern.cooldown * 60 * 1000);
          if (Date.now() < cooldownEnd) {
            return false; // Still on cooldown
          }
        }
      }

      // Check if we've already reacted to this specific event
      const reactionKey = `reaction_${sourceEvent.id}_${pattern.target}_${pattern.type}`;
      const alreadyReacted = await this.hasAlreadyReacted(reactionKey);
      
      return !alreadyReacted;

    } catch (error) {
      console.error('[REACTION_ENGINE] Failed to check reaction eligibility:', error);
      return false;
    }
  }

  /**
   * Route reaction to appropriate handler
   */
  private static async routeReaction(
    reactionType: string, 
    targetAgent: string, 
    context: Record<string, unknown>
  ): Promise<void> {
    try {
      switch (reactionType) {
        case 'monitor_engagement':
          await this.handleMonitorEngagement(targetAgent, context);
          break;

        case 'propose_scheme':
          await this.handleProposeScheme(targetAgent, context);
          break;

        case 'roast_and_diagnose':
          await this.handleRoastAndDiagnose(targetAgent, context);
          break;

        case 'celebrate':
          await this.handleCelebrate(targetAgent, context);
          break;

        case 'argue_back':
          await this.handleArgueBack(targetAgent, context);
          break;

        default:
          console.warn(`[REACTION_ENGINE] Unknown reaction type: ${reactionType}`);
          await this.handleGenericReaction(targetAgent, context);
          break;
      }

    } catch (error) {
      console.error(`[REACTION_ENGINE] Failed to route reaction ${reactionType}:`, error);
    }
  }

  /**
   * Record reaction for cooldown tracking
   */
  private static async recordReaction(pattern: ReactionPattern, sourceEvent: AgentEventRow): Promise<void> {
    try {
      const cooldownKey = `${pattern.target}_reaction_${pattern.type}_${pattern.source}`;
      const reactionKey = `reaction_${sourceEvent.id}_${pattern.target}_${pattern.type}`;
      
      // Store both cooldown and specific event reaction
      const now = new Date().toISOString();
      
      await supabase
        .from('agent_memory')
        .upsert([
          {
            agent_id: 'system',
            key: cooldownKey,
            value: { timestamp: now },
            importance: 1
          },
          {
            agent_id: 'system', 
            key: reactionKey,
            value: { reacted_at: now, pattern, source_event_id: sourceEvent.id },
            importance: 1
          }
        ], { onConflict: 'agent_id,key' });

    } catch (error) {
      console.error('[REACTION_ENGINE] Failed to record reaction:', error);
    }
  }

  /**
   * Get last reaction time for cooldown checking
   */
  private static async getLastReactionTime(cooldownKey: string): Promise<Date | null> {
    try {
      const { data, error } = await supabase
        .from('agent_memory')
        .select('value')
        .eq('agent_id', 'system')
        .eq('key', cooldownKey)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const timestamp = data.value?.timestamp;
      return timestamp ? new Date(timestamp) : null;

    } catch (error) {
      console.error('[REACTION_ENGINE] Failed to get last reaction time:', error);
      return null;
    }
  }

  /**
   * Check if already reacted to specific event
   */
  private static async hasAlreadyReacted(reactionKey: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('agent_memory')
        .select('id')
        .eq('agent_id', 'system')
        .eq('key', reactionKey)
        .maybeSingle();

      return !error && !!data;

    } catch (error) {
      console.error('[REACTION_ENGINE] Failed to check reaction status:', error);
      return true; // Err on the side of not reacting
    }
  }

  // ─── Reaction Handlers ───

  private static async handleMonitorEngagement(targetAgent: string, context: Record<string, unknown>): Promise<void> {
    // Create a scheme for the spy to monitor engagement
    await this.createReactionScheme(
      targetAgent,
      "Surveillance Protocol: Monitor Engagement",
      `Intel request: Monitor engagement patterns from recent activity. Context: ${JSON.stringify(context)}`,
      'analyze',
      { reaction_context: context }
    );
  }

  private static async handleProposeScheme(targetAgent: string, context: Record<string, unknown>): Promise<void> {
    // Create a scheme for CHUM to propose based on spy intel
    await this.createReactionScheme(
      targetAgent,
      "Strategic Response: Intel-Based Scheme",
      `Spy intel detected opportunity. Propose scheme based on: ${JSON.stringify(context)}`,
      'scheme',
      { reaction_context: context, priority: 4 }
    );
  }

  private static async handleRoastAndDiagnose(targetAgent: string, context: Record<string, unknown>): Promise<void> {
    // Create a scheme for Karen to roast and diagnose failure
    await this.createReactionScheme(
      targetAgent,
      "Post-Mortem Analysis Required", 
      `Another scheme failed. Time for brutal analysis. Context: ${JSON.stringify(context)}`,
      'analyze',
      { reaction_context: context, roast_mode: true }
    );
  }

  private static async handleCelebrate(targetAgent: string, context: Record<string, unknown>): Promise<void> {
    // Create a celebration scheme
    await this.createReactionScheme(
      targetAgent,
      "Victory Celebration Protocol",
      `Good news detected! Time to celebrate and leverage momentum. Context: ${JSON.stringify(context)}`,
      'tweet',
      { reaction_context: context, celebration: true }
    );
  }

  private static async handleArgueBack(targetAgent: string, context: Record<string, unknown>): Promise<void> {
    // Create a scheme for CHUM to argue back at Karen
    await this.createReactionScheme(
      targetAgent,
      "Defense Protocol: Counter-Argument",
      `Karen rejected our brilliant scheme. Time to defend our honor! Context: ${JSON.stringify(context)}`,
      'scheme',
      { reaction_context: context, argument_mode: true }
    );
  }

  private static async handleGenericReaction(targetAgent: string, context: Record<string, unknown>): Promise<void> {
    // Generic reaction fallback
    await this.createReactionScheme(
      targetAgent,
      "Automated Reaction Protocol",
      `Reacting to recent activity. Context: ${JSON.stringify(context)}`,
      'analyze',
      { reaction_context: context }
    );
  }

  /**
   * Create a scheme as a reaction
   */
  private static async createReactionScheme(
    agentId: string,
    title: string,
    description: string,
    type: 'tweet' | 'cloud_post' | 'trade' | 'recruit' | 'analyze' | 'scheme',
    extraContext: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('schemes')
        .insert({
          agent_id: agentId,
          title,
          description,
          type,
          status: 'proposed',
          priority: 3,
          context: {
            trigger_type: 'reaction',
            created_by: 'reaction_engine',
            ...extraContext
          }
        });

      if (error) {
        throw new Error(`Failed to create reaction scheme: ${error.message}`);
      }

    } catch (error) {
      console.error('[REACTION_ENGINE] Failed to create reaction scheme:', error);
    }
  }

  /**
   * Emit an agent event
   */
  private static async emitEvent(
    agentId: string,
    eventType: string,
    data: Record<string, unknown>,
    tags: string[] = []
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('agent_events')
        .insert({
          agent_id: agentId,
          event_type: eventType,
          data,
          tags
        });

      if (error) {
        console.error(`[REACTION_ENGINE] Failed to emit event: ${error.message}`);
      }

    } catch (error) {
      console.error('[REACTION_ENGINE] Failed to emit event:', error);
    }
  }

  /**
   * Get reaction engine status for debugging
   */
  static async getReactionStatus(): Promise<Record<string, unknown>> {
    try {
      const matrix = await this.getReactionMatrix();
      
      if (!matrix) {
        return {
          status: 'no_matrix',
          patterns: 0,
          message: 'No reaction matrix configured'
        };
      }

      return {
        status: 'active',
        patterns: matrix.patterns.length,
        matrix: matrix.patterns.map(p => ({
          source: p.source,
          target: p.target,
          type: p.type,
          probability: p.probability,
          cooldown: p.cooldown
        }))
      };

    } catch (error) {
      console.error('[REACTION_ENGINE] Failed to get status:', error);
      return {
        status: 'error',
        error: `Failed to get status: ${error}`
      };
    }
  }
}