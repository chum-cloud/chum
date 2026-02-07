import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { 
  MissionStepRow, 
  MissionRow, 
  MissionStatus, 
  StepStatus,
  StepKind
} from '../types';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export class MissionWorker {
  /**
   * Claim the next queued step and mark it as running
   */
  static async claimNextStep(): Promise<MissionStepRow | null> {
    try {
      // Use a transaction to atomically claim a step
      const { data, error } = await supabase.rpc('claim_next_mission_step');
      
      if (error) {
        // If the RPC doesn't exist, fall back to manual claiming
        return await this.fallbackClaimNextStep();
      }

      return data as MissionStepRow | null;

    } catch (error) {
      console.error('[MISSION_WORKER] Failed to claim next step:', error);
      return null;
    }
  }

  /**
   * Fallback method for claiming steps without RPC
   */
  private static async fallbackClaimNextStep(): Promise<MissionStepRow | null> {
    try {
      // Get the oldest queued step
      const { data: steps, error: selectError } = await supabase
        .from('mission_steps')
        .select('*')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(1);

      if (selectError) {
        throw new Error(`Failed to select step: ${selectError.message}`);
      }

      if (!steps || steps.length === 0) {
        return null; // No steps available
      }

      const step = steps[0] as MissionStepRow;

      // Try to claim it
      const { data: updatedStep, error: updateError } = await supabase
        .from('mission_steps')
        .update({
          status: 'running' as StepStatus,
          reserved_at: new Date().toISOString()
        })
        .eq('id', step.id)
        .eq('status', 'queued') // Ensure it's still queued
        .select()
        .single();

      if (updateError) {
        // Might have been claimed by another worker
        console.log('[MISSION_WORKER] Step already claimed:', step.id);
        return null;
      }

      console.log('[MISSION_WORKER] Step claimed:', updatedStep.id, updatedStep.kind);
      return updatedStep as MissionStepRow;

    } catch (error) {
      console.error('[MISSION_WORKER] Fallback claim failed:', error);
      return null;
    }
  }

  /**
   * Execute a claimed step by routing to appropriate handler
   */
  static async executeStep(step: MissionStepRow): Promise<void> {
    try {
      console.log(`[MISSION_WORKER] Executing step ${step.id}: ${step.kind} for agent ${step.agent_id}`);

      let output: Record<string, unknown>;

      // Route to appropriate handler based on step kind
      switch (step.kind) {
        case 'draft_tweet':
          output = await this.handleDraftTweet(step);
          break;
        case 'post_cloud':
          output = await this.handlePostCloud(step);
          break;
        case 'analyze':
          output = await this.handleAnalyze(step);
          break;
        case 'scout_price':
          output = await this.handleScoutPrice(step);
          break;
        case 'scout_mentions':
          output = await this.handleScoutMentions(step);
          break;
        case 'recruit':
          output = await this.handleRecruit(step);
          break;
        case 'review':
          output = await this.handleReview(step);
          break;
        case 'celebrate':
          output = await this.handleCelebrate(step);
          break;
        default:
          throw new Error(`Unknown step kind: ${step.kind}`);
      }

      await this.completeStep(step.id, output);

    } catch (error) {
      console.error(`[MISSION_WORKER] Failed to execute step ${step.id}:`, error);
      await this.failStep(step.id, `Execution failed: ${error}`);
    }
  }

  /**
   * Mark a step as completed and check if mission is done
   */
  static async completeStep(stepId: number, output: Record<string, unknown>): Promise<void> {
    try {
      const { data: step, error: updateError } = await supabase
        .from('mission_steps')
        .update({
          status: 'completed' as StepStatus,
          output,
          completed_at: new Date().toISOString()
        })
        .eq('id', stepId)
        .select('mission_id')
        .single();

      if (updateError) {
        throw new Error(`Failed to complete step: ${updateError.message}`);
      }

      console.log(`[MISSION_WORKER] Step ${stepId} completed`);

      // Check if mission is complete
      if (step) {
        await this.maybeFinalizeMission(step.mission_id);
      }

    } catch (error) {
      console.error(`[MISSION_WORKER] Failed to complete step:`, error);
      throw error;
    }
  }

  /**
   * Mark a step as failed and check if mission should fail
   */
  static async failStep(stepId: number, error: string): Promise<void> {
    try {
      const { data: step, error: updateError } = await supabase
        .from('mission_steps')
        .update({
          status: 'failed' as StepStatus,
          last_error: error,
          completed_at: new Date().toISOString()
        })
        .eq('id', stepId)
        .select('mission_id')
        .single();

      if (updateError) {
        throw new Error(`Failed to fail step: ${updateError.message}`);
      }

      console.log(`[MISSION_WORKER] Step ${stepId} failed:`, error);

      // Check if mission should fail
      if (step) {
        await this.maybeFinalizeMission(step.mission_id);
      }

    } catch (error) {
      console.error(`[MISSION_WORKER] Failed to fail step:`, error);
      throw error;
    }
  }

  /**
   * Check if mission is complete or failed and finalize status
   */
  static async maybeFinalizeMission(missionId: number): Promise<void> {
    try {
      // Get all steps for this mission
      const { data: steps, error: stepsError } = await supabase
        .from('mission_steps')
        .select('status')
        .eq('mission_id', missionId);

      if (stepsError) {
        throw new Error(`Failed to get mission steps: ${stepsError.message}`);
      }

      if (!steps || steps.length === 0) {
        return; // No steps, nothing to finalize
      }

      const allCompleted = steps.every(step => step.status === 'completed');
      const anyFailed = steps.some(step => step.status === 'failed');

      let newStatus: MissionStatus | null = null;

      if (allCompleted) {
        newStatus = 'completed';
      } else if (anyFailed) {
        newStatus = 'failed';
      }

      if (newStatus) {
        const { error: updateError } = await supabase
          .from('missions')
          .update({
            status: newStatus,
            completed_at: new Date().toISOString()
          })
          .eq('id', missionId);

        if (updateError) {
          throw new Error(`Failed to finalize mission: ${updateError.message}`);
        }

        console.log(`[MISSION_WORKER] Mission ${missionId} finalized as ${newStatus}`);

        // Update corresponding scheme status
        await this.updateSchemeStatusFromMission(missionId, newStatus);
      }

    } catch (error) {
      console.error(`[MISSION_WORKER] Failed to finalize mission:`, error);
    }
  }

  /**
   * Run one worker cycle: claim and execute one step
   */
  static async runWorkerCycle(): Promise<boolean> {
    try {
      const step = await this.claimNextStep();
      if (!step) {
        return false; // No work available
      }

      await this.executeStep(step);
      return true; // Work was done

    } catch (error) {
      console.error('[MISSION_WORKER] Worker cycle failed:', error);
      return false;
    }
  }

  // ─── Step Handlers ───

  private static async handleDraftTweet(step: MissionStepRow): Promise<Record<string, unknown>> {
    // Placeholder implementation - would integrate with CHUM agent
    return {
      tweet_content: "🎭 The army advances! New scheme in motion! Mass loyalty pledges welcome! #CHUMArmy In Plankton We Trust! 🦠⚡",
      character_count: 124,
      timestamp: new Date().toISOString()
    };
  }

  private static async handlePostCloud(step: MissionStepRow): Promise<Record<string, unknown>> {
    // Placeholder implementation - would integrate with CHUM Cloud
    return {
      post_url: "https://cloud.chumcoin.me/lair/headquarters/post/123",
      post_id: 123,
      timestamp: new Date().toISOString()
    };
  }

  private static async handleAnalyze(step: MissionStepRow): Promise<Record<string, unknown>> {
    // Placeholder implementation - would integrate with Spy agent
    return {
      analysis: "Market sentiment: cautiously optimistic. Whale activity: moderate. Recommendation: proceed with caution.",
      confidence: 0.75,
      timestamp: new Date().toISOString()
    };
  }

  private static async handleScoutPrice(step: MissionStepRow): Promise<Record<string, unknown>> {
    // Placeholder implementation - would integrate with price monitoring
    return {
      current_price: 0.00001234,
      change_24h: -2.5,
      volume: 45000,
      timestamp: new Date().toISOString()
    };
  }

  private static async handleScoutMentions(step: MissionStepRow): Promise<Record<string, unknown>> {
    // Placeholder implementation - would integrate with social monitoring
    return {
      mentions_count: 42,
      sentiment_score: 0.65,
      top_keywords: ["chum", "army", "domination"],
      timestamp: new Date().toISOString()
    };
  }

  private static async handleRecruit(step: MissionStepRow): Promise<Record<string, unknown>> {
    // Placeholder implementation - would integrate with Recruiter agent
    return {
      recruitment_message: "Join the CHUM Army! World domination awaits! 🎭⚡",
      target_platforms: ["twitter", "telegram"],
      timestamp: new Date().toISOString()
    };
  }

  private static async handleReview(step: MissionStepRow): Promise<Record<string, unknown>> {
    // Placeholder implementation - would integrate with Karen agent
    return {
      review_result: "approved",
      review_notes: "[APPROVED] Surprisingly competent for once. The army might actually advance with this scheme.",
      timestamp: new Date().toISOString()
    };
  }

  private static async handleCelebrate(step: MissionStepRow): Promise<Record<string, unknown>> {
    // Placeholder implementation - would integrate with CHUM agent
    return {
      celebration_message: "VICTORY ACHIEVED! The army ADVANCES! World domination is within grasp! In Plankton We Trust! 🎭⚡",
      mood_boost: 15,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update scheme status based on mission completion
   */
  private static async updateSchemeStatusFromMission(missionId: number, missionStatus: MissionStatus): Promise<void> {
    try {
      // Get the mission to find the scheme
      const { data: mission, error: missionError } = await supabase
        .from('missions')
        .select('scheme_id')
        .eq('id', missionId)
        .single();

      if (missionError || !mission) {
        throw new Error(`Failed to get mission: ${missionError?.message}`);
      }

      const schemeStatus = missionStatus === 'completed' ? 'completed' : 'failed';

      const { error: updateError } = await supabase
        .from('schemes')
        .update({
          status: schemeStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', mission.scheme_id);

      if (updateError) {
        throw new Error(`Failed to update scheme status: ${updateError.message}`);
      }

      console.log(`[MISSION_WORKER] Scheme ${mission.scheme_id} status updated to ${schemeStatus}`);

    } catch (error) {
      console.error(`[MISSION_WORKER] Failed to update scheme status:`, error);
    }
  }
}