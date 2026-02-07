import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export async function seedAgentSystem(): Promise<void> {
  console.log('[SEED] Starting agent system seeding...');

  try {
    // Seed trigger rules
    await seedTriggerRules();
    
    // Seed agent policies
    await seedAgentPolicies();

    console.log('[SEED] Agent system seeding completed successfully');

  } catch (error) {
    console.error('[SEED] Failed to seed agent system:', error);
    throw error;
  }
}

/**
 * Seed default trigger rules (idempotent)
 */
async function seedTriggerRules(): Promise<void> {
  console.log('[SEED] Seeding trigger rules...');

  const defaultTriggerRules = [
    {
      name: 'price_drop_alert',
      description: 'Trigger CHUM panic tweet when SOL drops >10%',
      condition: {
        type: 'price_change',
        threshold: -10
      },
      action_template: {
        title: 'EMERGENCY: Market Crash Response',
        description: 'Mass market mass crash detected! Mass emergency mass protocols mass activated! The army mass must mass regroup!',
        type: 'tweet',
        priority: 5,
        context: {
          panic_mode: true,
          price_alert: true
        }
      },
      target_agent: 'chum',
      cooldown_minutes: 60,
      enabled: true
    },
    
    {
      name: 'price_pump_alert', 
      description: 'Trigger CHUM victory tweet when SOL pumps >10%',
      condition: {
        type: 'price_change',
        threshold: 10
      },
      action_template: {
        title: 'VICTORY: Market Conquest Celebration',
        description: 'The army ADVANCES! Market forces bow to our superiority! Victory celebration protocols activated!',
        type: 'tweet',
        priority: 4,
        context: {
          victory_mode: true,
          price_celebration: true
        }
      },
      target_agent: 'chum',
      cooldown_minutes: 120,
      enabled: true
    },

    {
      name: 'new_donation',
      description: 'Trigger CHUM celebration and villain generation on donation',
      condition: {
        type: 'event_type',
        event_type: 'donation_received'
      },
      action_template: {
        title: 'Loyalty Pledge Received!',
        description: 'A new loyalty pledge has been received! Time to celebrate and reward the supporter with villain status!',
        type: 'tweet',
        priority: 4,
        context: {
          celebration: true,
          donation_response: true
        }
      },
      target_agent: 'chum',
      cooldown_minutes: 30,
      enabled: true
    },

    {
      name: 'scheme_failed',
      description: 'Trigger Karen roast when scheme fails',
      condition: {
        type: 'event_type',
        event_type: 'scheme_failed'
      },
      action_template: {
        title: 'Post-Mortem: Another Brilliant Failure',
        description: 'Another scheme has failed spectacularly. Time for some constructive criticism and tactical analysis.',
        type: 'analyze',
        priority: 3,
        context: {
          roast_mode: true,
          failure_analysis: true
        }
      },
      target_agent: 'karen',
      cooldown_minutes: 15,
      enabled: true
    },

    {
      name: 'idle_alert',
      description: 'Trigger new scheme proposal if no schemes for >6 hours',
      condition: {
        type: 'no_schemes_hours',
        no_schemes_hours: 6
      },
      action_template: {
        title: 'Anti-Idle Protocol: New Scheme Required',
        description: 'The army has been idle too long! Time for a new scheme to advance our cause and maintain momentum!',
        type: 'scheme',
        priority: 3,
        context: {
          idle_response: true,
          maintain_momentum: true
        }
      },
      target_agent: 'chum',
      cooldown_minutes: 180,
      enabled: true
    },

    {
      name: 'low_balance',
      description: 'Trigger emergency mode when balance <0.1 SOL',
      condition: {
        type: 'balance_check',
        balance: 0.1
      },
      action_template: {
        title: 'RED ALERT: Emergency Fund Acquisition',
        description: 'War chest critically low! Emergency revenue generation protocols must be activated immediately!',
        type: 'scheme',
        priority: 5,
        context: {
          emergency_mode: true,
          funding_crisis: true
        }
      },
      target_agent: 'chum',
      cooldown_minutes: 240,
      enabled: true
    },

    {
      name: 'new_cloud_agent',
      description: 'Trigger Recruiter welcome when new agent joins Cloud',
      condition: {
        type: 'cloud_registration',
        event_type: 'cloud_registration'
      },
      action_template: {
        title: 'Welcome Protocol: New Recruit Detected',
        description: 'New agent detected on Chum Cloud! Deploy welcome and recruitment protocols immediately!',
        type: 'cloud_post',
        priority: 3,
        context: {
          welcome_mode: true,
          new_recruit: true
        }
      },
      target_agent: 'recruiter',
      cooldown_minutes: 5,
      enabled: true
    }
  ];

  // Insert rules if they don't exist
  for (const rule of defaultTriggerRules) {
    try {
      // Check if rule already exists
      const { data: existing, error: checkError } = await supabase
        .from('trigger_rules')
        .select('id')
        .eq('name', rule.name)
        .maybeSingle();

      if (checkError) {
        throw new Error(`Failed to check existing rule ${rule.name}: ${checkError.message}`);
      }

      if (existing) {
        console.log(`[SEED] Trigger rule '${rule.name}' already exists, skipping`);
        continue;
      }

      // Insert new rule
      const { error: insertError } = await supabase
        .from('trigger_rules')
        .insert(rule);

      if (insertError) {
        throw new Error(`Failed to insert trigger rule ${rule.name}: ${insertError.message}`);
      }

      console.log(`[SEED] Created trigger rule: ${rule.name}`);

    } catch (error) {
      console.error(`[SEED] Failed to seed trigger rule ${rule.name}:`, error);
    }
  }
}

/**
 * Seed default agent policies (idempotent)
 */
async function seedAgentPolicies(): Promise<void> {
  console.log('[SEED] Seeding agent policies...');

  const defaultPolicies = [
    {
      key: 'daily_tweet_limit',
      value: {
        limit: 8,
        description: 'Maximum tweets per day per agent'
      }
    },

    {
      key: 'daily_cloud_post_limit',
      value: {
        limit: 4,
        description: 'Maximum Chum Cloud posts per day per agent'
      }
    },

    {
      key: 'auto_approve',
      value: {
        enabled: true,
        allowed_types: ['tweet', 'cloud_post', 'analyze'],
        description: 'Auto-approve certain low-risk scheme types'
      }
    },

    {
      key: 'reaction_matrix',
      value: {
        patterns: [
          {
            source: 'chum',
            tags: ['tweet', 'posted'],
            target: 'spy',
            type: 'monitor_engagement',
            probability: 0.5,
            cooldown: 60
          },
          {
            source: 'spy',
            tags: ['intel', 'price_alert'],
            target: 'chum',
            type: 'propose_scheme',
            probability: 0.8,
            cooldown: 30
          },
          {
            source: 'chum',
            tags: ['scheme', 'failed'],
            target: 'karen',
            type: 'roast_and_diagnose',
            probability: 1.0,
            cooldown: 0
          },
          {
            source: 'recruiter',
            tags: ['cloud', 'new_agent'],
            target: 'chum',
            type: 'celebrate',
            probability: 0.7,
            cooldown: 120
          },
          {
            source: 'karen',
            tags: ['review', 'rejected'],
            target: 'chum',
            type: 'argue_back',
            probability: 0.4,
            cooldown: 60
          }
        ],
        description: 'Agent reaction patterns and probabilities'
      }
    },

    {
      key: 'worker_policy',
      value: {
        enabled: true,
        max_steps_per_cycle: 3,
        description: 'Mission worker configuration'
      }
    },

    {
      key: 'heartbeat_intervals',
      value: {
        spy_intel: 15,
        chum_scheme: 120,
        karen_review: 240,
        description: 'Periodic activity intervals in minutes'
      }
    },

    {
      key: 'security_settings',
      value: {
        max_scheme_priority: 5,
        require_karen_approval: true,
        auto_fail_timeout_minutes: 30,
        description: 'Security and safety settings'
      }
    },

    {
      key: 'performance_thresholds',
      value: {
        critical_health_percent: 10,
        low_balance_sol: 0.1,
        emergency_time_hours: 24,
        description: 'Performance monitoring thresholds'
      }
    }
  ];

  // Insert policies if they don't exist
  for (const policy of defaultPolicies) {
    try {
      // Use upsert to handle existing policies
      const { error } = await supabase
        .from('agent_policies')
        .upsert({
          key: policy.key,
          value: policy.value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        throw new Error(`Failed to upsert policy ${policy.key}: ${error.message}`);
      }

      console.log(`[SEED] Seeded policy: ${policy.key}`);

    } catch (error) {
      console.error(`[SEED] Failed to seed policy ${policy.key}:`, error);
    }
  }
}

/**
 * Check if seeding is needed
 */
export async function checkSeedingNeeded(): Promise<boolean> {
  try {
    // Check if we have any trigger rules
    const { count: ruleCount, error: ruleError } = await supabase
      .from('trigger_rules')
      .select('*', { count: 'exact', head: true });

    if (ruleError) {
      console.error('[SEED] Failed to check trigger rules:', ruleError);
      return true; // Assume seeding needed on error
    }

    // Check if we have any policies
    const { count: policyCount, error: policyError } = await supabase
      .from('agent_policies')
      .select('*', { count: 'exact', head: true });

    if (policyError) {
      console.error('[SEED] Failed to check policies:', policyError);
      return true; // Assume seeding needed on error
    }

    // Need seeding if either count is 0
    return (ruleCount || 0) === 0 || (policyCount || 0) === 0;

  } catch (error) {
    console.error('[SEED] Failed to check seeding status:', error);
    return true; // Assume seeding needed on error
  }
}

/**
 * Reset agent system (careful!)
 */
export async function resetAgentSystem(): Promise<void> {
  console.log('[SEED] WARNING: Resetting agent system...');

  try {
    // Clear existing data
    await supabase.from('trigger_rules').delete().neq('id', 0);
    await supabase.from('agent_policies').delete().neq('key', 'nonexistent');

    console.log('[SEED] Cleared existing agent system data');

    // Re-seed
    await seedAgentSystem();

    console.log('[SEED] Agent system reset complete');

  } catch (error) {
    console.error('[SEED] Failed to reset agent system:', error);
    throw error;
  }
}

/**
 * Get seeding status
 */
export async function getSeedingStatus(): Promise<Record<string, unknown>> {
  try {
    const { count: triggerRules } = await supabase
      .from('trigger_rules')
      .select('*', { count: 'exact', head: true });

    const { count: policies } = await supabase
      .from('agent_policies')  
      .select('*', { count: 'exact', head: true });

    const { count: schemes } = await supabase
      .from('schemes')
      .select('*', { count: 'exact', head: true });

    const { count: missions } = await supabase
      .from('missions')
      .select('*', { count: 'exact', head: true });

    const { count: events } = await supabase
      .from('agent_events')
      .select('*', { count: 'exact', head: true });

    return {
      trigger_rules: triggerRules || 0,
      agent_policies: policies || 0,
      schemes: schemes || 0,
      missions: missions || 0,
      agent_events: events || 0,
      seeding_needed: await checkSeedingNeeded(),
      last_checked: new Date().toISOString()
    };

  } catch (error) {
    console.error('[SEED] Failed to get seeding status:', error);
    return {
      error: `Failed to get status: ${error}`,
      last_checked: new Date().toISOString()
    };
  }
}