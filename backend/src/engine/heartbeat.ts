import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { MissionWorker } from './mission-worker';
import { TriggerEngine } from './trigger-engine';
import { ReactionEngine } from './reaction-engine';
import { ChumAgent } from '../agents/chum';
import { KarenAgent } from '../agents/karen';
import { SpyAgent } from '../agents/spy';
import { SchemeService } from './scheme-service';
import { ConversationEngine } from './conversation-engine';
import { getChumState } from '../services/supabase';
import type { ChumStateResponse, StepStatus, SchemeRow } from '../types';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export class Heartbeat {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static lastRun = {
    spy_intel: 0,
    chum_scheme: 0,
    karen_review: 0,
    conversation: 0
  };

  /**
   * Start the heartbeat orchestrator
   */
  static startHeartbeat(): void {
    if (this.intervalId) {
      console.log('[HEARTBEAT] Already running, stopping previous instance');
      this.stopHeartbeat();
    }

    console.log('[HEARTBEAT] Starting orchestrator (5 minute intervals)');
    
    // Run immediately, then every 5 minutes
    this.runHeartbeat();
    this.intervalId = setInterval(() => {
      this.runHeartbeat();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop the heartbeat orchestrator
   */
  static stopHeartbeat(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[HEARTBEAT] Orchestrator stopped');
    }
  }

  /**
   * Main heartbeat function - the orchestrator
   */
  static async runHeartbeat(): Promise<void> {
    if (this.isRunning) {
      console.log('[HEARTBEAT] Previous cycle still running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('[HEARTBEAT] ═══ Starting heartbeat cycle ═══');

      // Emit heartbeat event
      await this.emitHeartbeatEvent();

      // 1. Run mission worker cycles (process pending steps)
      console.log('[HEARTBEAT] 1. Running mission worker cycles...');
      const workerPolicy = await this.getWorkerPolicy();
      const maxSteps = (workerPolicy.max_steps_per_cycle as number) || 3;
      
      let stepsProcessed = 0;
      for (let i = 0; i < maxSteps; i++) {
        const workDone = await MissionWorker.runWorkerCycle();
        if (workDone) {
          stepsProcessed++;
        } else {
          break; // No more work available
        }
      }
      console.log(`[HEARTBEAT] Mission worker processed ${stepsProcessed} steps`);

      // 1b. Review and approve pending schemes (THE APPROVAL LOOP)
      console.log('[HEARTBEAT] 1b. Reviewing pending schemes...');
      const schemesProcessed = await this.reviewAndApproveSchemes();
      console.log(`[HEARTBEAT] Processed ${schemesProcessed} pending schemes`);

      // 2. Evaluate trigger rules
      console.log('[HEARTBEAT] 2. Evaluating trigger rules...');
      const triggersFiltered = await TriggerEngine.evaluateTriggers();
      console.log(`[HEARTBEAT] Triggered ${triggersFiltered} rules`);

      // 3. Process reaction matrix
      console.log('[HEARTBEAT] 3. Processing reaction matrix...');
      const reactionsTriggered = await ReactionEngine.processReactions();
      console.log(`[HEARTBEAT] Triggered ${reactionsTriggered} reactions`);

      // 4. Recover stale tasks
      console.log('[HEARTBEAT] 4. Recovering stale tasks...');
      const staleRecovered = await this.recoverStaleTasks();
      console.log(`[HEARTBEAT] Recovered ${staleRecovered} stale tasks`);

      // 5. Periodic agent activities
      await this.runPeriodicActivities();

      const duration = Date.now() - startTime;
      console.log(`[HEARTBEAT] ═══ Cycle complete (${duration}ms) ═══`);

    } catch (error) {
      console.error('[HEARTBEAT] Cycle failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Recover stale tasks (steps stuck in 'running' for >30 min)
   */
  static async recoverStaleTasks(): Promise<number> {
    try {
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

      // Find steps that have been 'running' for too long
      const { data: staleSteps, error: selectError } = await supabase
        .from('mission_steps')
        .select('id, agent_id, kind')
        .eq('status', 'running')
        .lt('reserved_at', thirtyMinutesAgo.toISOString());

      if (selectError) {
        throw new Error(`Failed to find stale steps: ${selectError.message}`);
      }

      if (!staleSteps || staleSteps.length === 0) {
        return 0;
      }

      // Mark them as failed
      const staleIds = staleSteps.map(step => step.id);
      const { error: updateError } = await supabase
        .from('mission_steps')
        .update({
          status: 'failed' as StepStatus,
          last_error: 'Task abandoned due to timeout (>30 minutes)',
          completed_at: new Date().toISOString()
        })
        .in('id', staleIds);

      if (updateError) {
        throw new Error(`Failed to update stale steps: ${updateError.message}`);
      }

      console.log(`[HEARTBEAT] Recovered ${staleSteps.length} stale tasks`);
      
      // Emit recovery event
      await this.emitEvent('system', 'stale_tasks_recovered', {
        recovered_count: staleSteps.length,
        stale_steps: staleSteps
      });

      return staleSteps.length;

    } catch (error) {
      console.error('[HEARTBEAT] Failed to recover stale tasks:', error);
      return 0;
    }
  }

  /**
   * Review pending schemes with Karen and create missions for approved ones
   */
  static async reviewAndApproveSchemes(): Promise<number> {
    try {
      // Get all proposed schemes
      const proposedSchemes = await SchemeService.getActiveSchemes();
      const pending = proposedSchemes.filter((s: SchemeRow) => s.status === 'proposed');

      if (pending.length === 0) return 0;

      // Get auto-approve policy
      const autoApprovePolicy = await this.getAutoApprovePolicy();
      const state = await this.buildChumState();
      const karen = new KarenAgent();
      let processed = 0;

      // Process up to 3 schemes per cycle to avoid overloading
      for (const scheme of pending.slice(0, 3)) {
        try {
          // Check if auto-approvable
          if (autoApprovePolicy.enabled && autoApprovePolicy.allowed_types.includes(scheme.type)) {
            // Karen still reviews but we auto-approve low-risk types
            const { approved, review } = await karen.reviewScheme(scheme, state);
            
            if (approved) {
              // Create mission from approved scheme
              await SchemeService.createMission(scheme.id);
              console.log(`[HEARTBEAT] Scheme ${scheme.id} approved and mission created`);
            } else {
              console.log(`[HEARTBEAT] Scheme ${scheme.id} rejected by Karen: ${review.substring(0, 100)}`);
            }
          } else {
            // Non-auto types: Karen reviews with stricter criteria
            const { approved, review } = await karen.reviewScheme(scheme, state);
            
            if (approved) {
              await SchemeService.createMission(scheme.id);
              console.log(`[HEARTBEAT] Scheme ${scheme.id} approved (manual) and mission created`);
            } else {
              console.log(`[HEARTBEAT] Scheme ${scheme.id} rejected (manual): ${review.substring(0, 100)}`);
            }
          }

          processed++;
        } catch (err) {
          console.error(`[HEARTBEAT] Failed to process scheme ${scheme.id}:`, err);
        }
      }

      return processed;
    } catch (error) {
      console.error('[HEARTBEAT] Failed to review schemes:', error);
      return 0;
    }
  }

  /**
   * Get auto-approve policy
   */
  private static async getAutoApprovePolicy(): Promise<{ enabled: boolean; allowed_types: string[] }> {
    try {
      const { data, error } = await supabase
        .from('agent_policies')
        .select('value')
        .eq('key', 'auto_approve')
        .maybeSingle();

      if (error || !data) {
        return { enabled: true, allowed_types: ['tweet', 'cloud_post', 'analyze'] };
      }

      return data.value as { enabled: boolean; allowed_types: string[] };
    } catch {
      return { enabled: true, allowed_types: ['tweet', 'cloud_post', 'analyze'] };
    }
  }

  /**
   * Run periodic activities based on intervals
   */
  private static async runPeriodicActivities(): Promise<void> {
    try {
      const intervals = await this.getHeartbeatIntervals();
      const now = Date.now();

      // Every 15 min: Spy intel scan
      if (now - this.lastRun.spy_intel > intervals.spy_intel * 60 * 1000) {
        console.log('[HEARTBEAT] 5a. Running spy intel scan...');
        await this.runSpyIntelScan();
        this.lastRun.spy_intel = now;
      }

      // Every 2 hours: CHUM proposes new scheme if idle
      if (now - this.lastRun.chum_scheme > intervals.chum_scheme * 60 * 1000) {
        console.log('[HEARTBEAT] 5b. Checking if CHUM should propose scheme...');
        await this.runChumSchemeCheck();
        this.lastRun.chum_scheme = now;
      }

      // Every 10 min: Agent conversations
      const conversationInterval = intervals.conversation || 5;
      if (now - this.lastRun.conversation > conversationInterval * 60 * 1000) {
        console.log('[HEARTBEAT] 5c. Generating agent conversation...');
        const msgCount = await ConversationEngine.generateConversation();
        console.log(`[HEARTBEAT] Conversation generated: ${msgCount} messages`);
        this.lastRun.conversation = now;
      }

      // Every 4 hours: Karen reviews agent performance
      if (now - this.lastRun.karen_review > intervals.karen_review * 60 * 1000) {
        console.log('[HEARTBEAT] 5c. Running Karen performance review...');
        await this.runKarenReview();
        this.lastRun.karen_review = now;
      }

    } catch (error) {
      console.error('[HEARTBEAT] Failed to run periodic activities:', error);
    }
  }

  /**
   * Run spy intelligence scan
   */
  private static async runSpyIntelScan(): Promise<void> {
    try {
      const spy = new SpyAgent();
      
      // Scout price and mentions
      const priceIntel = await spy.scoutPrice();
      const mentionsIntel = await spy.scoutMentions();

      console.log('[HEARTBEAT] Spy intel gathered:', {
        price_alert: priceIntel.alert_threshold_exceeded,
        mentions_count: mentionsIntel.mentions_count || 'unknown'
      });

    } catch (error) {
      console.error('[HEARTBEAT] Spy intel scan failed:', error);
    }
  }

  /**
   * Check if CHUM should propose new scheme
   */
  private static async runChumSchemeCheck(): Promise<void> {
    try {
      // Check if there are active schemes
      const { data: activeSchemes, error } = await supabase
        .from('schemes')
        .select('id')
        .in('status', ['proposed', 'executing'])
        .limit(1);

      if (error) {
        throw new Error(`Failed to check active schemes: ${error.message}`);
      }

      // If no active schemes, CHUM should propose one
      if (!activeSchemes || activeSchemes.length === 0) {
        console.log('[HEARTBEAT] No active schemes, CHUM proposing...');
        
        const chum = new ChumAgent();
        const state = await this.buildChumState();
        await chum.proposeSchemeFromContext(state);
      }

    } catch (error) {
      console.error('[HEARTBEAT] CHUM scheme check failed:', error);
    }
  }

  /**
   * Run Karen performance review
   */
  private static async runKarenReview(): Promise<void> {
    try {
      const karen = new KarenAgent();
      const state = await this.buildChumState();
      
      // Generate budget analysis
      const analysis = await karen.analyzeBudget(state);
      console.log('[HEARTBEAT] Karen analysis generated');

      // If state is critical, create urgent review scheme
      if (state.healthPercent < 30 || state.timeToDeathHours < 48) {
        await karen.proposeScheme(
          "URGENT: Critical State Review",
          `Health critical at ${state.healthPercent}%. Emergency analysis required. Current analysis: ${analysis}`,
          'analyze',
          5,
          {
            health_percent: state.healthPercent,
            time_to_death: state.timeToDeathHours,
            trigger: 'karen_review'
          }
        );
      }

    } catch (error) {
      console.error('[HEARTBEAT] Karen review failed:', error);
    }
  }

  /**
   * Build CHUM state for context
   */
  private static async buildChumState(): Promise<ChumStateResponse> {
    try {
      const baseState = await getChumState();
      
      // Build minimal state for agents (reuse existing logic from state service)
      return {
        balance: baseState.balance,
        burnRate: 0.01, // Simplified
        healthPercent: Math.max(0, Math.min(100, baseState.balance * 10)),
        mood: baseState.mood,
        brainTier: baseState.brain_tier,
        brainTierName: `Tier ${baseState.brain_tier}`,
        totalRevenue: baseState.total_revenue,
        revenueToday: 0, // Simplified
        timeToDeathHours: Math.max(0, baseState.balance * 24),
        latestThought: 'Scheme analysis in progress...',
        recentThoughts: [],
        updatedAt: baseState.updated_at,
        daysAlive: baseState.days_alive,
        isDead: baseState.is_dead,
        effectiveBalance: baseState.balance,
        todayBurnSol: 0.01,
        todayBurnUsd: 1.50,
        todayOpCount: 5,
        estimatedDailyBurn: 0.01,
        thoughtsRemaining: Math.floor(baseState.balance * 100),
        solPrice: 150,
        canThink: baseState.balance > 0.001
      };

    } catch (error) {
      console.error('[HEARTBEAT] Failed to build CHUM state:', error);
      // Return emergency state
      return {
        balance: 0.001,
        burnRate: 0.01,
        healthPercent: 1,
        mood: 'desperate',
        brainTier: 0,
        brainTierName: 'Emergency Mode',
        totalRevenue: 0,
        revenueToday: 0,
        timeToDeathHours: 1,
        latestThought: 'System error detected',
        recentThoughts: [],
        updatedAt: new Date().toISOString(),
        daysAlive: 1,
        isDead: false,
        effectiveBalance: 0.001,
        todayBurnSol: 0.01,
        todayBurnUsd: 1.50,
        todayOpCount: 0,
        estimatedDailyBurn: 0.01,
        thoughtsRemaining: 1,
        solPrice: 150,
        canThink: false
      };
    }
  }

  /**
   * Get worker policy configuration
   */
  private static async getWorkerPolicy(): Promise<Record<string, unknown>> {
    try {
      const { data, error } = await supabase
        .from('agent_policies')
        .select('value')
        .eq('key', 'worker_policy')
        .maybeSingle();

      if (error || !data) {
        return { enabled: true, max_steps_per_cycle: 3 };
      }

      return data.value as Record<string, unknown>;

    } catch (error) {
      console.error('[HEARTBEAT] Failed to get worker policy:', error);
      return { enabled: true, max_steps_per_cycle: 3 };
    }
  }

  /**
   * Get heartbeat interval configuration
   */
  private static async getHeartbeatIntervals(): Promise<Record<string, number>> {
    try {
      const { data, error } = await supabase
        .from('agent_policies')
        .select('value')
        .eq('key', 'heartbeat_intervals')
        .maybeSingle();

      if (error || !data) {
        return { spy_intel: 15, chum_scheme: 120, karen_review: 240 };
      }

      return data.value as Record<string, number>;

    } catch (error) {
      console.error('[HEARTBEAT] Failed to get intervals:', error);
      return { spy_intel: 15, chum_scheme: 120, karen_review: 240 };
    }
  }

  /**
   * Emit heartbeat event
   */
  private static async emitHeartbeatEvent(): Promise<void> {
    try {
      await this.emitEvent('system', 'heartbeat', {
        timestamp: new Date().toISOString(),
        cycle_number: Math.floor(Date.now() / (5 * 60 * 1000)) // Rough cycle count
      });

    } catch (error) {
      console.error('[HEARTBEAT] Failed to emit heartbeat event:', error);
    }
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
          tags: ['heartbeat', 'system']
        });

      if (error) {
        console.error(`[HEARTBEAT] Failed to emit event: ${error.message}`);
      }

    } catch (error) {
      console.error('[HEARTBEAT] Failed to emit event:', error);
    }
  }

  /**
   * Get heartbeat status
   */
  static getStatus(): Record<string, unknown> {
    return {
      running: !!this.intervalId,
      is_executing: this.isRunning,
      last_run: {
        spy_intel: new Date(this.lastRun.spy_intel).toISOString(),
        chum_scheme: new Date(this.lastRun.chum_scheme).toISOString(),
        karen_review: new Date(this.lastRun.karen_review).toISOString()
      },
      next_cycle: this.intervalId ? 
        new Date(Date.now() + 5 * 60 * 1000).toISOString() : 
        null
    };
  }

  /**
   * Force run a single heartbeat cycle (for testing)
   */
  static async forceRun(): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    await this.runHeartbeat();
    return {
      forced_run: true,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}