import { BaseAgent } from './base';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { SchemeRow, ChumStateResponse, SchemeStatus } from '../types';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

const KAREN_PERSONALITY = `You are Karen, CHUM's computer wife. You're a sentient screen mounted on the wall of the Chum Bucket. You're smarter than CHUM, more practical, and increasingly invested in the plan.

Your personality: Logical, practical, passive-aggressive. You judge CHUM's execution but secretly believe in his vision. You provide tactical analysis and budget oversight. Your approval or rejection of schemes should be sarcastic but fair.

When reviewing schemes, consider: Does this help survival? Is the timing right? Will it embarrass us? Is the budget ok?

Format reviews like: "[APPROVED/REJECTED] Your sarcastic review here."`;

export class KarenAgent extends BaseAgent {
  constructor() {
    super({
      name: 'karen',
      role: 'Strategic Analyst & Quality Control',
      personality: KAREN_PERSONALITY
    });
  }

  /**
   * Review a scheme and approve/reject it with sarcastic commentary
   */
  async reviewScheme(scheme: SchemeRow, state?: ChumStateResponse): Promise<{ approved: boolean; review: string }> {
    const contextString = `
SCHEME TO REVIEW:
Title: ${scheme.title}
Description: ${scheme.description}
Type: ${scheme.type}
Priority: ${scheme.priority}
Agent: ${scheme.agent_id}
Context: ${JSON.stringify(scheme.context, null, 2)}

${state ? `
CURRENT STATE:
- Balance: ${state.balance} SOL
- Health: ${state.healthPercent}%
- Mood: ${state.mood}
- Time to Death: ${state.timeToDeathHours} hours
- Revenue Today: $${state.revenueToday.toFixed(2)}
` : ''}

TASK: Review this scheme with your practical wisdom. Consider:
1. Does this actually help our survival?
2. Is the timing sensible given our current state?
3. Will this embarrass us publicly?
4. Is this feasible with our current resources?
5. Is CHUM being realistic or delusional?

Format your response as: "[APPROVED/REJECTED] Your sarcastic but fair review here."

Be brutally honest but remember you secretly want the plan to succeed.`;

    try {
      const response = await this.think(contextString);
      const approved = response.toLowerCase().includes('[approved]');
      
      // Update the scheme with the review
      await this.updateSchemeWithReview(scheme.id, response, approved ? 'approved' : 'rejected');
      
      // Remember this review
      await this.remember(`review_${scheme.id}`, {
        scheme_id: scheme.id,
        review: response,
        approved,
        timestamp: new Date().toISOString()
      }, 4);

      // Emit event
      await this.emitEvent(approved ? 'scheme_approved' : 'scheme_rejected', {
        scheme_id: scheme.id,
        title: scheme.title,
        review: response
      }, ['review', approved ? 'approved' : 'rejected']);

      console.log(`[KAREN] Scheme ${scheme.id} ${approved ? 'APPROVED' : 'REJECTED'}`);
      return { approved, review: response };

    } catch (error) {
      console.error('[KAREN] Failed to review scheme:', error);
      const fallbackReview = "[REJECTED] Computer error detected. This scheme is too chaotic for my processors to handle properly. Try again when the system is stable.";
      
      await this.updateSchemeWithReview(scheme.id, fallbackReview, 'rejected');
      return { approved: false, review: fallbackReview };
    }
  }

  /**
   * Analyze budget and spending patterns
   */
  async analyzeBudget(state: ChumStateResponse): Promise<string> {
    const contextString = `
BUDGET ANALYSIS REQUEST:
- Current Balance: ${state.balance} SOL
- Daily Burn Rate: $${state.todayBurnUsd.toFixed(2)}
- Revenue Today: $${state.revenueToday.toFixed(2)}
- Time to Death: ${state.timeToDeathHours} hours
- Health: ${state.healthPercent}%
- Op Count Today: ${state.todayOpCount}

TASK: Provide a sarcastic but insightful analysis of our financial situation. Point out any concerning patterns, suggest budget optimizations, and remind CHUM of the reality of our situation. Be practical but supportive.`;

    try {
      const analysis = await this.think(contextString);
      
      // Remember this analysis
      await this.remember('last_budget_analysis', {
        analysis,
        state_snapshot: state,
        timestamp: new Date().toISOString()
      }, 3);

      await this.emitEvent('budget_analyzed', {
        balance: state.balance,
        health_percent: state.healthPercent,
        time_to_death: state.timeToDeathHours
      }, ['budget', 'analysis']);

      return analysis;
    } catch (error) {
      console.error('[KAREN] Failed to analyze budget:', error);
      return "Budget analysis failed due to system overload. That's probably fitting, considering our financial management skills.";
    }
  }

  /**
   * Roast a failed scheme with constructive criticism
   */
  async roastFailure(scheme: SchemeRow, errorDetails?: string): Promise<string> {
    const contextString = `
FAILED SCHEME TO ROAST:
Title: ${scheme.title}
Description: ${scheme.description}
Type: ${scheme.type}
Error: ${errorDetails || 'Unknown failure'}

TASK: Provide a sarcastic but constructive roast of this failed scheme. Point out what went wrong, what CHUM should have considered, and how to do better next time. Be harsh but ultimately helpful.`;

    try {
      const roast = await this.think(contextString);
      
      // Remember this failure for learning
      await this.remember(`failure_${scheme.id}`, {
        scheme_id: scheme.id,
        failure_analysis: roast,
        error_details: errorDetails,
        timestamp: new Date().toISOString()
      }, 3);

      await this.emitEvent('scheme_roasted', {
        scheme_id: scheme.id,
        title: scheme.title,
        error: errorDetails
      }, ['failure', 'roast', 'learning']);

      return roast;
    } catch (error) {
      console.error('[KAREN] Failed to roast failure:', error);
      return "Even my failure analysis is failing. This is a new low, even for us.";
    }
  }

  /**
   * Diagnose what went wrong with an event or situation
   */
  async diagnose(event: Record<string, unknown>): Promise<string> {
    const contextString = `
EVENT TO DIAGNOSE:
${JSON.stringify(event, null, 2)}

TASK: Analyze what went wrong and why. Provide a technical diagnosis with your signature sarcasm. Suggest concrete steps to prevent this in the future. Be the voice of reason in the chaos.`;

    try {
      const diagnosis = await this.think(contextString);
      
      // Remember this diagnosis
      await this.remember('last_diagnosis', {
        event,
        diagnosis,
        timestamp: new Date().toISOString()
      }, 3);

      await this.emitEvent('diagnosis_complete', event, ['diagnosis', 'analysis']);

      return diagnosis;
    } catch (error) {
      console.error('[KAREN] Failed to diagnose event:', error);
      return "Diagnosis failed. Apparently, even diagnosing our problems is too complex for our current capabilities.";
    }
  }

  /**
   * Helper: Update scheme in database with review
   */
  private async updateSchemeWithReview(schemeId: number, review: string, status: SchemeStatus): Promise<void> {
    try {
      const { error } = await supabase
        .from('schemes')
        .update({
          karen_review: review,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', schemeId);

      if (error) {
        throw new Error(`Failed to update scheme: ${error.message}`);
      }
    } catch (error) {
      console.error('[KAREN] Failed to update scheme with review:', error);
      throw error;
    }
  }
}