import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ChumAgent } from '../agents/chum';
import { KarenAgent } from '../agents/karen';
import { SpyAgent } from '../agents/spy';
import { RecruiterAgent } from '../agents/recruiter';
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
        case 'reply_tweet':
          output = await this.handleReplyTweet(step);
          break;
        case 'search_ct':
          output = await this.handleSearchCT(step);
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

  // ─── Step Handlers (wired to real agents) ───

  /**
   * Get the scheme context for a mission step
   */
  private static async getSchemeForStep(step: MissionStepRow): Promise<Record<string, unknown>> {
    try {
      const { data: mission } = await supabase
        .from('missions')
        .select('scheme_id')
        .eq('id', step.mission_id)
        .single();
      
      if (mission) {
        const { data: scheme } = await supabase
          .from('schemes')
          .select('*')
          .eq('id', mission.scheme_id)
          .single();
        return (scheme || {}) as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private static async handleDraftTweet(step: MissionStepRow): Promise<Record<string, unknown>> {
    const chum = new ChumAgent();
    const scheme = await this.getSchemeForStep(step);
    const tweet = await chum.draftTweet(scheme as any);
    
    return {
      tweet_content: tweet,
      character_count: tweet.length,
      agent: 'chum',
      timestamp: new Date().toISOString()
    };
  }

  private static async handlePostCloud(step: MissionStepRow): Promise<Record<string, unknown>> {
    const recruiter = new RecruiterAgent();
    const scheme = await this.getSchemeForStep(step);
    const post = await recruiter.draftCloudPost(scheme);
    
    // Actually post to Chum Cloud
    try {
      const response = await fetch('https://chum-production.up.railway.app/api/cloud/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: 'CHUM',
          api_key: process.env.CHUM_CLOUD_API_KEY || '',
          lair: 'general',
          title: (scheme as any).title || 'Dispatches from HQ',
          content: post
        })
      });
      const result = await response.json();
      return {
        post_content: post,
        post_id: (result as any)?.id || null,
        agent: 'recruiter',
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return {
        post_content: post,
        post_id: null,
        error: `Cloud post failed: ${err}`,
        agent: 'recruiter',
        timestamp: new Date().toISOString()
      };
    }
  }

  private static async handleAnalyze(step: MissionStepRow): Promise<Record<string, unknown>> {
    const spy = new SpyAgent();
    const scheme = await this.getSchemeForStep(step);
    const analysis = await spy.analyzeEvent(scheme);
    
    return {
      analysis,
      agent: 'spy',
      confidence: 0.75,
      timestamp: new Date().toISOString()
    };
  }

  private static async handleScoutPrice(step: MissionStepRow): Promise<Record<string, unknown>> {
    const spy = new SpyAgent();
    const result = await spy.scoutPrice();
    
    return {
      ...result,
      agent: 'spy',
      timestamp: new Date().toISOString()
    };
  }

  private static async handleScoutMentions(step: MissionStepRow): Promise<Record<string, unknown>> {
    const spy = new SpyAgent();
    const result = await spy.scoutMentions();
    
    return {
      ...result,
      agent: 'spy',
      timestamp: new Date().toISOString()
    };
  }

  private static async handleRecruit(step: MissionStepRow): Promise<Record<string, unknown>> {
    const recruiter = new RecruiterAgent();
    const scheme = await this.getSchemeForStep(step);
    const message = await recruiter.draftRecruitmentTweet(scheme);
    
    return {
      recruitment_message: message,
      agent: 'recruiter',
      timestamp: new Date().toISOString()
    };
  }

  private static async handleReview(step: MissionStepRow): Promise<Record<string, unknown>> {
    const karen = new KarenAgent();
    const scheme = await this.getSchemeForStep(step);
    const { approved, review } = await karen.reviewScheme(scheme as any);
    
    return {
      review_result: approved ? 'approved' : 'rejected',
      review_notes: review,
      agent: 'karen',
      timestamp: new Date().toISOString()
    };
  }

  private static async handleCelebrate(step: MissionStepRow): Promise<Record<string, unknown>> {
    const chum = new ChumAgent();
    const scheme = await this.getSchemeForStep(step);
    const celebration = await chum.celebrate(scheme);
    
    return {
      celebration_message: celebration,
      agent: 'chum',
      timestamp: new Date().toISOString()
    };
  }

  private static async handleReplyTweet(step: MissionStepRow): Promise<Record<string, unknown>> {
    const chum = new ChumAgent();
    const scheme = await this.getSchemeForStep(step);
    const input = (step as any).input || {};
    const tweetUrl = input.tweet_url || (scheme as any).reply_to_url;
    const tweetText = input.tweet_text || '';

    // Generate reply content
    const replyContent = await chum.think(`
Write a reply to this tweet as CHUM (Plankton villain). Be witty, on-brand, and engaging.
Keep under 280 chars. Don't be cringe.

Tweet: "${tweetText}"
URL: ${tweetUrl}

Reply:`);

    // Queue for VPS browser
    const { queueTask } = await import('../services/agent-tasks');
    await queueTask({
      task_type: 'reply_tweet',
      agent_id: 'chum',
      payload: { content: replyContent.trim(), reply_to_url: tweetUrl },
      priority: 1,
      scheme_id: (scheme as any)?.id,
    });

    return {
      reply_content: replyContent.trim(),
      reply_to_url: tweetUrl,
      agent: 'chum',
      timestamp: new Date().toISOString()
    };
  }

  private static async handleSearchCT(step: MissionStepRow): Promise<Record<string, unknown>> {
    const spy = new SpyAgent();
    const input = (step as any).input || {};
    const queries = input.queries || ['$CHUM', 'AI agent solana'];
    const result = await spy.searchCT(queries);

    return {
      ...result,
      agent: 'spy',
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