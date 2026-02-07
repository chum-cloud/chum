import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { 
  TriggerRuleRow, 
  AgentEventRow, 
  SchemeRow 
} from '../types';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export class TriggerEngine {
  /**
   * Evaluate all enabled triggers against recent events
   */
  static async evaluateTriggers(): Promise<number> {
    try {
      // Get all enabled trigger rules
      const { data: rules, error: rulesError } = await supabase
        .from('trigger_rules')
        .select('*')
        .eq('enabled', true)
        .order('id');

      if (rulesError) {
        throw new Error(`Failed to get trigger rules: ${rulesError.message}`);
      }

      if (!rules || rules.length === 0) {
        console.log('[TRIGGER_ENGINE] No enabled trigger rules found');
        return 0;
      }

      // Get recent events (last 2 hours)
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      const { data: events, error: eventsError } = await supabase
        .from('agent_events')
        .select('*')
        .gte('created_at', twoHoursAgo.toISOString())
        .order('created_at', { ascending: false });

      if (eventsError) {
        throw new Error(`Failed to get recent events: ${eventsError.message}`);
      }

      const recentEvents = (events || []) as AgentEventRow[];
      let triggersFireCount = 0;

      // Evaluate each rule
      for (const rule of rules as TriggerRuleRow[]) {
        try {
          // Check cooldown
          if (await this.isOnCooldown(rule)) {
            console.log(`[TRIGGER_ENGINE] Rule ${rule.name} on cooldown`);
            continue;
          }

          // Check condition
          if (await this.checkTriggerCondition(rule, recentEvents)) {
            console.log(`[TRIGGER_ENGINE] Firing trigger: ${rule.name}`);
            await this.fireTrigger(rule);
            triggersFireCount++;
          }

        } catch (error) {
          console.error(`[TRIGGER_ENGINE] Failed to evaluate rule ${rule.name}:`, error);
        }
      }

      console.log(`[TRIGGER_ENGINE] Evaluated ${rules.length} rules, fired ${triggersFireCount}`);
      return triggersFireCount;

    } catch (error) {
      console.error('[TRIGGER_ENGINE] Failed to evaluate triggers:', error);
      return 0;
    }
  }

  /**
   * Evaluate a single trigger's condition against events
   */
  static async checkTriggerCondition(rule: TriggerRuleRow, events: AgentEventRow[]): Promise<boolean> {
    try {
      const condition = rule.condition;
      
      // Handle different condition types
      switch (condition.type) {
        case 'event_type':
          return this.checkEventTypeCondition(condition, events);
        
        case 'price_change':
          return this.checkPriceChangeCondition(condition, events);
          
        case 'no_schemes_hours':
          return this.checkNoSchemesCondition(condition);
          
        case 'heartbeat':
          return this.checkHeartbeatCondition(condition, events);
          
        case 'balance_check':
          return this.checkBalanceCondition(condition, events);
          
        case 'cloud_registration':
          return this.checkCloudRegistrationCondition(condition, events);
          
        default:
          console.warn(`[TRIGGER_ENGINE] Unknown condition type: ${condition.type}`);
          return false;
      }

    } catch (error) {
      console.error(`[TRIGGER_ENGINE] Failed to check condition for ${rule.name}:`, error);
      return false;
    }
  }

  /**
   * Fire a trigger by creating a scheme proposal
   */
  static async fireTrigger(rule: TriggerRuleRow): Promise<SchemeRow> {
    try {
      const template = rule.action_template;
      
      // Create scheme from template
      const { data: scheme, error: schemeError } = await supabase
        .from('schemes')
        .insert({
          agent_id: rule.target_agent,
          title: template.title || `Triggered Action: ${rule.name}`,
          description: template.description || `Auto-generated from trigger: ${rule.name}`,
          type: template.type || 'scheme',
          status: 'proposed',
          priority: template.priority || 4,
          context: {
            trigger_rule_id: rule.id,
            trigger_name: rule.name,
            fired_at: new Date().toISOString(),
            ...(template.context as Record<string, unknown> || {})
          }
        })
        .select()
        .single();

      if (schemeError) {
        throw new Error(`Failed to create scheme: ${schemeError.message}`);
      }

      // Update last_fired_at
      await this.updateLastFired(rule.id);

      // Emit event
      await this.emitEvent(rule.target_agent, 'trigger_fired', {
        trigger_rule_id: rule.id,
        trigger_name: rule.name,
        scheme_id: scheme.id,
        scheme_title: template.title
      });

      console.log(`[TRIGGER_ENGINE] Trigger ${rule.name} fired, created scheme ${scheme.id}`);
      return scheme as SchemeRow;

    } catch (error) {
      console.error(`[TRIGGER_ENGINE] Failed to fire trigger ${rule.name}:`, error);
      throw error;
    }
  }

  /**
   * Check if trigger is on cooldown
   */
  private static async isOnCooldown(rule: TriggerRuleRow): Promise<boolean> {
    if (!rule.last_fired_at || rule.cooldown_minutes <= 0) {
      return false;
    }

    const lastFired = new Date(rule.last_fired_at);
    const cooldownEnd = new Date(lastFired.getTime() + (rule.cooldown_minutes * 60 * 1000));
    
    return Date.now() < cooldownEnd.getTime();
  }

  /**
   * Update last_fired_at timestamp
   */
  private static async updateLastFired(ruleId: number): Promise<void> {
    const { error } = await supabase
      .from('trigger_rules')
      .update({ last_fired_at: new Date().toISOString() })
      .eq('id', ruleId);

    if (error) {
      console.error(`[TRIGGER_ENGINE] Failed to update last_fired_at: ${error.message}`);
    }
  }

  /**
   * Check event_type condition
   */
  private static checkEventTypeCondition(condition: any, events: AgentEventRow[]): boolean {
    const targetType = condition.event_type;
    return events.some(event => event.event_type === targetType);
  }

  /**
   * Check price_change condition
   */
  private static checkPriceChangeCondition(condition: any, events: AgentEventRow[]): boolean {
    const threshold = condition.threshold;
    
    // Look for price_change events in the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const priceEvents = events.filter(event => 
      event.event_type === 'price_change' && 
      new Date(event.created_at).getTime() > oneHourAgo
    );

    return priceEvents.some(event => {
      const changePercent = event.data?.change_percent as number;
      if (typeof changePercent !== 'number') return false;
      
      if (threshold > 0) {
        return changePercent >= threshold; // Pump
      } else {
        return changePercent <= threshold; // Dump
      }
    });
  }

  /**
   * Check no_schemes_hours condition
   */
  private static async checkNoSchemesCondition(condition: any): Promise<boolean> {
    const hoursThreshold = condition.no_schemes_hours || 6;
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - hoursThreshold);

    const { data: recentSchemes, error } = await supabase
      .from('schemes')
      .select('id')
      .gte('created_at', hoursAgo.toISOString())
      .limit(1);

    if (error) {
      console.error('[TRIGGER_ENGINE] Failed to check recent schemes:', error);
      return false;
    }

    return !recentSchemes || recentSchemes.length === 0;
  }

  /**
   * Check heartbeat condition
   */
  private static checkHeartbeatCondition(condition: any, events: AgentEventRow[]): boolean {
    // Heartbeat triggers can combine with other conditions
    if (condition.no_schemes_hours) {
      // This will be handled by checkNoSchemesCondition
      return true;
    }
    
    // Default heartbeat condition: just fired on schedule
    return events.some(event => event.event_type === 'heartbeat');
  }

  /**
   * Check balance_check condition
   */
  private static checkBalanceCondition(condition: any, events: AgentEventRow[]): boolean {
    const balanceThreshold = condition.balance || 0.1;
    
    const balanceEvents = events.filter(event => event.event_type === 'balance_check');
    
    return balanceEvents.some(event => {
      const currentBalance = event.data?.balance as number;
      return typeof currentBalance === 'number' && currentBalance < balanceThreshold;
    });
  }

  /**
   * Check cloud_registration condition
   */
  private static checkCloudRegistrationCondition(condition: any, events: AgentEventRow[]): boolean {
    return events.some(event => event.event_type === 'cloud_registration');
  }

  /**
   * Emit an agent event
   */
  private static async emitEvent(
    agentId: string,
    eventType: string, 
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('agent_events')
        .insert({
          agent_id: agentId,
          event_type: eventType,
          data,
          tags: ['trigger', 'automated']
        });

      if (error) {
        console.error(`[TRIGGER_ENGINE] Failed to emit event: ${error.message}`);
      }

    } catch (error) {
      console.error('[TRIGGER_ENGINE] Failed to emit event:', error);
    }
  }

  /**
   * Get trigger status for debugging
   */
  static async getTriggerStatus(): Promise<Record<string, unknown>> {
    try {
      const { data: rules, error } = await supabase
        .from('trigger_rules')
        .select('*')
        .order('id');

      if (error) {
        throw new Error(`Failed to get trigger rules: ${error.message}`);
      }

      const status = {
        total_rules: rules?.length || 0,
        enabled_rules: rules?.filter(r => r.enabled).length || 0,
        rules: (rules || []).map(rule => ({
          id: rule.id,
          name: rule.name,
          enabled: rule.enabled,
          cooldown_minutes: rule.cooldown_minutes,
          last_fired_at: rule.last_fired_at,
          on_cooldown: rule.last_fired_at ? this.isOnCooldown(rule as TriggerRuleRow) : false
        }))
      };

      return status;

    } catch (error) {
      console.error('[TRIGGER_ENGINE] Failed to get trigger status:', error);
      return { error: `Failed to get status: ${error}` };
    }
  }
}