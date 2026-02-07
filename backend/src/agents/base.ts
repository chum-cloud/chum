import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import type { 
  AgentMemoryRow, 
  AgentEventRow, 
  SchemeRow, 
  SchemeType,
  SchemeStatus 
} from '../types';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface AgentConstructorParams {
  name: string;
  role: string;
  personality: string;
}

export abstract class BaseAgent {
  protected name: string;
  protected role: string;
  protected personality: string;
  protected model: any;

  constructor({ name, role, personality }: AgentConstructorParams) {
    this.name = name;
    this.role = role;
    this.personality = personality;
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  /**
   * Core thinking method - calls Gemini with personality + context
   */
  async think(context: string): Promise<string> {
    try {
      const prompt = `${this.personality}

CONTEXT:
${context}

Respond in character. Keep responses focused and actionable.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error(`[AGENT:${this.name.toUpperCase()}] Think error:`, error);
      throw new Error(`Failed to think: ${error}`);
    }
  }

  /**
   * Emit an event to the agent_events table
   */
  async emitEvent(eventType: string, data: Record<string, unknown> = {}, tags: string[] = []): Promise<void> {
    try {
      const { error } = await supabase
        .from('agent_events')
        .insert({
          agent_id: this.name,
          event_type: eventType,
          data,
          tags
        });

      if (error) {
        throw new Error(`Failed to emit event: ${error.message}`);
      }

      console.log(`[AGENT:${this.name.toUpperCase()}] Event emitted:`, { eventType, data, tags });
    } catch (error) {
      console.error(`[AGENT:${this.name.toUpperCase()}] Failed to emit event:`, error);
      throw error;
    }
  }

  /**
   * Store a memory in agent_memory table
   */
  async remember(key: string, value: any, importance: number = 3): Promise<void> {
    try {
      const { error } = await supabase
        .from('agent_memory')
        .upsert({
          agent_id: this.name,
          key,
          value: typeof value === 'object' ? value : { data: value },
          importance
        }, {
          onConflict: 'agent_id,key'
        });

      if (error) {
        throw new Error(`Failed to remember: ${error.message}`);
      }

      console.log(`[AGENT:${this.name.toUpperCase()}] Remembered:`, { key, importance });
    } catch (error) {
      console.error(`[AGENT:${this.name.toUpperCase()}] Failed to remember:`, error);
      throw error;
    }
  }

  /**
   * Retrieve a specific memory by key
   */
  async recall(key: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('agent_memory')
        .select('value')
        .eq('agent_id', this.name)
        .eq('key', key)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to recall: ${error.message}`);
      }

      return data ? data.value : null;
    } catch (error) {
      console.error(`[AGENT:${this.name.toUpperCase()}] Failed to recall:`, error);
      throw error;
    }
  }

  /**
   * Retrieve all memories for this agent
   */
  async recallAll(): Promise<AgentMemoryRow[]> {
    try {
      const { data, error } = await supabase
        .from('agent_memory')
        .select('*')
        .eq('agent_id', this.name)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to recall all: ${error.message}`);
      }

      return (data || []) as AgentMemoryRow[];
    } catch (error) {
      console.error(`[AGENT:${this.name.toUpperCase()}] Failed to recall all:`, error);
      throw error;
    }
  }

  /**
   * Propose a scheme by inserting into schemes table
   */
  async proposeScheme(
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
          agent_id: this.name,
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
      
      // Emit event for the proposal
      await this.emitEvent('scheme_proposed', {
        scheme_id: scheme.id,
        title,
        type,
        priority
      }, ['scheme', 'proposed']);

      console.log(`[AGENT:${this.name.toUpperCase()}] Scheme proposed:`, { id: scheme.id, title, type });
      return scheme;
    } catch (error) {
      console.error(`[AGENT:${this.name.toUpperCase()}] Failed to propose scheme:`, error);
      throw error;
    }
  }

  /**
   * Get the agent's name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the agent's role
   */
  getRole(): string {
    return this.role;
  }
}