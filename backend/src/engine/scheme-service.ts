import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { 
  SchemeRow, 
  SchemeType, 
  SchemeStatus, 
  MissionRow, 
  MissionStepRow, 
  StepKind 
} from '../types';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export class SchemeService {
  /**
   * Central hub for all scheme creation - ALL schemes go through here
   */
  static async proposeScheme(
    agentId: string,
    title: string,
    description: string,
    type: SchemeType,
    priority: number = 3,
    context: Record<string, unknown> = {}
  ): Promise<SchemeRow> {
    try {
      const { data, error } = await supabase
        .from('schemes')
        .insert({
          agent_id: agentId,
          title,
          description,
          type,
          status: 'proposed' as SchemeStatus,
          priority,
          context
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to propose scheme: ${error.message}`);
      }

      const scheme = data as SchemeRow;

      // Emit event for scheme proposal
      await this.emitEvent(agentId, 'scheme_proposed', {
        scheme_id: scheme.id,
        title,
        type,
        priority
      }, ['scheme', 'proposed']);

      console.log(`[SCHEME_SERVICE] Scheme proposed:`, { id: scheme.id, agent: agentId, title, type });
      return scheme;

    } catch (error) {
      console.error(`[SCHEME_SERVICE] Failed to propose scheme:`, error);
      throw error;
    }
  }

  /**
   * Karen reviews a scheme and updates its status
   */
  static async reviewScheme(schemeId: number, karenReview: string, approved: boolean): Promise<void> {
    try {
      const status: SchemeStatus = approved ? 'approved' : 'rejected';
      
      const { error } = await supabase
        .from('schemes')
        .update({
          karen_review: karenReview,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', schemeId);

      if (error) {
        throw new Error(`Failed to review scheme: ${error.message}`);
      }

      // Get the scheme for event data
      const scheme = await this.getSchemeById(schemeId);
      if (!scheme) {
        throw new Error(`Scheme ${schemeId} not found after review`);
      }

      // Emit event for scheme review
      await this.emitEvent('karen', approved ? 'scheme_approved' : 'scheme_rejected', {
        scheme_id: schemeId,
        title: scheme.title,
        review: karenReview,
        agent_id: scheme.agent_id
      }, ['review', approved ? 'approved' : 'rejected']);

      console.log(`[SCHEME_SERVICE] Scheme ${schemeId} ${approved ? 'APPROVED' : 'REJECTED'} by Karen`);

    } catch (error) {
      console.error(`[SCHEME_SERVICE] Failed to review scheme:`, error);
      throw error;
    }
  }

  /**
   * Create a mission from an approved scheme with appropriate steps
   */
  static async createMission(schemeId: number): Promise<MissionRow> {
    try {
      // Get the scheme
      const scheme = await this.getSchemeById(schemeId);
      if (!scheme) {
        throw new Error(`Scheme ${schemeId} not found`);
      }

      if (scheme.status !== 'approved') {
        throw new Error(`Cannot create mission for non-approved scheme ${schemeId}`);
      }

      // Create mission
      const { data: missionData, error: missionError } = await supabase
        .from('missions')
        .insert({
          scheme_id: schemeId,
          status: 'pending',
          assigned_agent: scheme.agent_id
        })
        .select()
        .single();

      if (missionError) {
        throw new Error(`Failed to create mission: ${missionError.message}`);
      }

      const mission = missionData as MissionRow;

      // Create mission steps based on scheme type
      const steps = this.generateStepsForSchemeType(scheme.type);
      await this.createMissionSteps(mission.id, steps);

      // Update scheme status
      await this.updateSchemeStatus(schemeId, 'executing');

      // Emit event
      await this.emitEvent(scheme.agent_id, 'mission_created', {
        mission_id: mission.id,
        scheme_id: schemeId,
        title: scheme.title,
        steps_count: steps.length
      }, ['mission', 'created']);

      console.log(`[SCHEME_SERVICE] Mission ${mission.id} created for scheme ${schemeId} with ${steps.length} steps`);
      return mission;

    } catch (error) {
      console.error(`[SCHEME_SERVICE] Failed to create mission:`, error);
      throw error;
    }
  }

  /**
   * Get all active schemes (proposed or executing)
   */
  static async getActiveSchemes(): Promise<SchemeRow[]> {
    try {
      const { data, error } = await supabase
        .from('schemes')
        .select('*')
        .in('status', ['proposed', 'executing'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get active schemes: ${error.message}`);
      }

      return (data || []) as SchemeRow[];

    } catch (error) {
      console.error(`[SCHEME_SERVICE] Failed to get active schemes:`, error);
      throw error;
    }
  }

  /**
   * Get scheme by ID
   */
  static async getSchemeById(id: number): Promise<SchemeRow | null> {
    try {
      const { data, error } = await supabase
        .from('schemes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get scheme: ${error.message}`);
      }

      return data as SchemeRow | null;

    } catch (error) {
      console.error(`[SCHEME_SERVICE] Failed to get scheme by ID:`, error);
      throw error;
    }
  }

  /**
   * Update scheme status
   */
  static async updateSchemeStatus(id: number, status: SchemeStatus): Promise<void> {
    try {
      const { error } = await supabase
        .from('schemes')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to update scheme status: ${error.message}`);
      }

      console.log(`[SCHEME_SERVICE] Scheme ${id} status updated to ${status}`);

    } catch (error) {
      console.error(`[SCHEME_SERVICE] Failed to update scheme status:`, error);
      throw error;
    }
  }

  /**
   * Generate mission steps based on scheme type
   */
  private static generateStepsForSchemeType(type: SchemeType): Array<{ agentId: string; kind: StepKind; stepOrder: number; input: Record<string, unknown> }> {
    const stepTemplates = {
      tweet: [
        { agentId: 'chum', kind: 'draft_tweet' as StepKind, stepOrder: 1, input: {} },
        { agentId: 'karen', kind: 'review' as StepKind, stepOrder: 2, input: {} }
      ],
      cloud_post: [
        { agentId: 'chum', kind: 'post_cloud' as StepKind, stepOrder: 1, input: {} }
      ],
      analyze: [
        { agentId: 'spy', kind: 'analyze' as StepKind, stepOrder: 1, input: {} },
        { agentId: 'chum', kind: 'review' as StepKind, stepOrder: 2, input: {} }
      ],
      recruit: [
        { agentId: 'recruiter', kind: 'recruit' as StepKind, stepOrder: 1, input: {} },
        { agentId: 'karen', kind: 'review' as StepKind, stepOrder: 2, input: {} }
      ],
      trade: [
        { agentId: 'spy', kind: 'scout_price' as StepKind, stepOrder: 1, input: {} },
        { agentId: 'chum', kind: 'review' as StepKind, stepOrder: 2, input: {} }
      ],
      scheme: [
        { agentId: 'chum', kind: 'draft_tweet' as StepKind, stepOrder: 1, input: {} },
        { agentId: 'karen', kind: 'review' as StepKind, stepOrder: 2, input: {} }
      ]
    };

    return stepTemplates[type] || stepTemplates.scheme;
  }

  /**
   * Create mission steps
   */
  private static async createMissionSteps(
    missionId: number, 
    steps: Array<{ agentId: string; kind: StepKind; stepOrder: number; input: Record<string, unknown> }>
  ): Promise<void> {
    try {
      const stepRows = steps.map(step => ({
        mission_id: missionId,
        agent_id: step.agentId,
        kind: step.kind,
        status: 'queued',
        input: step.input,
        step_order: step.stepOrder
      }));

      const { error } = await supabase
        .from('mission_steps')
        .insert(stepRows);

      if (error) {
        throw new Error(`Failed to create mission steps: ${error.message}`);
      }

    } catch (error) {
      console.error(`[SCHEME_SERVICE] Failed to create mission steps:`, error);
      throw error;
    }
  }

  /**
   * Helper: Emit an agent event
   */
  private static async emitEvent(
    agentId: string, 
    eventType: string, 
    data: Record<string, unknown>, 
    tags: string[]
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
        throw new Error(`Failed to emit event: ${error.message}`);
      }

    } catch (error) {
      console.error(`[SCHEME_SERVICE] Failed to emit event:`, error);
      // Don't throw - events are not critical
    }
  }
}