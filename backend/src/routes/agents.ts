import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { Heartbeat } from '../engine/heartbeat';
import { TriggerEngine } from '../engine/trigger-engine';
import { ReactionEngine } from '../engine/reaction-engine';
import { seedAgentSystem, getSeedingStatus } from '../engine/seed';
import { SchemeService } from '../engine/scheme-service';
import type { 
  SchemeRow, 
  MissionRow, 
  AgentEventRow,
  SchemeStatus,
  SchemeType
} from '../types';

const router = express.Router();
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// ═══ Scheme Endpoints ═══

/**
 * GET /api/agents/schemes - List schemes with filters
 */
router.get('/schemes', async (req, res) => {
  try {
    const { 
      status, 
      agent_id, 
      type,
      limit = '50', 
      offset = '0' 
    } = req.query;

    let query = supabase
      .from('schemes')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (agent_id) {
      query = query.eq('agent_id', agent_id);
    }
    if (type) {
      query = query.eq('type', type);
    }

    // Apply pagination
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    query = query.range(offsetNum, offsetNum + limitNum - 1);

    const { data: schemes, error } = await query;

    if (error) {
      throw new Error(`Failed to get schemes: ${error.message}`);
    }

    res.json({
      schemes: schemes || [],
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        count: schemes?.length || 0
      },
      filters: { status, agent_id, type }
    });

  } catch (error) {
    console.error('[AGENTS_API] Failed to get schemes:', error);
    res.status(500).json({ error: `Failed to get schemes: ${error}` });
  }
});

/**
 * GET /api/agents/schemes/:id - Get single scheme with mission/steps
 */
router.get('/schemes/:id', async (req, res) => {
  try {
    const schemeId = parseInt(req.params.id, 10);

    // Get scheme
    const { data: scheme, error: schemeError } = await supabase
      .from('schemes')
      .select('*')
      .eq('id', schemeId)
      .maybeSingle();

    if (schemeError) {
      throw new Error(`Failed to get scheme: ${schemeError.message}`);
    }

    if (!scheme) {
      return res.status(404).json({ error: 'Scheme not found' });
    }

    // Get associated mission and steps
    const { data: mission, error: missionError } = await supabase
      .from('missions')
      .select(`
        *,
        mission_steps (*)
      `)
      .eq('scheme_id', schemeId)
      .maybeSingle();

    if (missionError) {
      console.warn('[AGENTS_API] Failed to get mission:', missionError);
    }

    res.json({
      scheme: scheme as SchemeRow,
      mission: mission as MissionRow | null,
      steps: mission?.mission_steps || []
    });

  } catch (error) {
    console.error('[AGENTS_API] Failed to get scheme:', error);
    res.status(500).json({ error: `Failed to get scheme: ${error}` });
  }
});

// ═══ Events Endpoint ═══

/**
 * GET /api/agents/events - Recent agent events
 */
router.get('/events', async (req, res) => {
  try {
    const { 
      agent_id, 
      event_type,
      tags,
      limit = '50' 
    } = req.query;

    let query = supabase
      .from('agent_events')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (agent_id) {
      query = query.eq('agent_id', agent_id);
    }
    if (event_type) {
      query = query.eq('event_type', event_type);
    }
    if (tags) {
      const tagArray = (tags as string).split(',');
      query = query.overlaps('tags', tagArray);
    }

    // Apply limit
    const limitNum = parseInt(limit as string, 10);
    query = query.limit(limitNum);

    const { data: events, error } = await query;

    if (error) {
      throw new Error(`Failed to get events: ${error.message}`);
    }

    res.json({
      events: (events || []) as AgentEventRow[],
      filters: { agent_id, event_type, tags },
      count: events?.length || 0
    });

  } catch (error) {
    console.error('[AGENTS_API] Failed to get events:', error);
    res.status(500).json({ error: `Failed to get events: ${error}` });
  }
});

// ═══ Missions Endpoint ═══

/**
 * GET /api/agents/missions - Active missions with steps
 */
router.get('/missions', async (req, res) => {
  try {
    const { status = 'pending,running' } = req.query;
    
    const statusArray = (status as string).split(',');

    const { data: missions, error } = await supabase
      .from('missions')
      .select(`
        *,
        schemes!inner(*),
        mission_steps(*)
      `)
      .in('status', statusArray)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get missions: ${error.message}`);
    }

    res.json({
      missions: missions || [],
      filters: { status },
      count: missions?.length || 0
    });

  } catch (error) {
    console.error('[AGENTS_API] Failed to get missions:', error);
    res.status(500).json({ error: `Failed to get missions: ${error}` });
  }
});

// ═══ Status Endpoint ═══

/**
 * GET /api/agents/status - All agents' current state
 */
router.get('/status', async (req, res) => {
  try {
    // Get recent activity for each agent
    const agents = ['chum', 'karen', 'spy', 'recruiter'];
    const agentStatus: Record<string, unknown> = {};

    for (const agentId of agents) {
      // Get last activity
      const { data: lastEvent, error: eventError } = await supabase
        .from('agent_events')
        .select('event_type, created_at')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get recent memories count
      const { count: memoryCount, error: memoryError } = await supabase
        .from('agent_memory')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId);

      // Get active schemes
      const { count: activeSchemes, error: schemeError } = await supabase
        .from('schemes')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId)
        .in('status', ['proposed', 'executing']);

      agentStatus[agentId] = {
        last_activity: lastEvent ? {
          event_type: lastEvent.event_type,
          timestamp: lastEvent.created_at
        } : null,
        memory_count: memoryCount || 0,
        active_schemes: activeSchemes || 0,
        errors: {
          events: eventError?.message,
          memory: memoryError?.message,
          schemes: schemeError?.message
        }
      };
    }

    // Get system status
    const heartbeatStatus = Heartbeat.getStatus();
    const triggerStatus = await TriggerEngine.getTriggerStatus();
    const reactionStatus = await ReactionEngine.getReactionStatus();

    res.json({
      agents: agentStatus,
      system: {
        heartbeat: heartbeatStatus,
        triggers: triggerStatus,
        reactions: reactionStatus
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AGENTS_API] Failed to get status:', error);
    res.status(500).json({ error: `Failed to get status: ${error}` });
  }
});

// ═══ Manual Trigger Endpoint ═══

/**
 * POST /api/agents/trigger - Manually trigger a scheme (for testing)
 */
router.post('/trigger', async (req, res) => {
  try {
    const { 
      agent_id, 
      title, 
      description, 
      type = 'scheme', 
      priority = 3,
      context = {}
    } = req.body;

    if (!agent_id || !title) {
      return res.status(400).json({ 
        error: 'agent_id and title are required' 
      });
    }

    // Validate agent_id
    const validAgents = ['chum', 'karen', 'spy', 'recruiter'];
    if (!validAgents.includes(agent_id)) {
      return res.status(400).json({ 
        error: `Invalid agent_id. Must be one of: ${validAgents.join(', ')}` 
      });
    }

    // Validate type
    const validTypes: SchemeType[] = ['tweet', 'cloud_post', 'trade', 'recruit', 'analyze', 'scheme'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
      });
    }

    // Create scheme
    const scheme = await SchemeService.proposeScheme(
      agent_id,
      title,
      description || `Manually triggered scheme: ${title}`,
      type,
      priority,
      {
        ...context,
        manual_trigger: true,
        triggered_by: req.ip,
        triggered_at: new Date().toISOString()
      }
    );

    res.json({
      success: true,
      scheme,
      message: `Scheme ${scheme.id} triggered for agent ${agent_id}`
    });

  } catch (error) {
    console.error('[AGENTS_API] Failed to trigger scheme:', error);
    res.status(500).json({ error: `Failed to trigger scheme: ${error}` });
  }
});

// ═══ System Management Endpoints ═══

/**
 * POST /api/agents/heartbeat/force - Force run heartbeat cycle
 */
router.post('/heartbeat/force', async (req, res) => {
  try {
    const result = await Heartbeat.forceRun();
    res.json({
      success: true,
      result,
      message: 'Heartbeat cycle executed successfully'
    });

  } catch (error) {
    console.error('[AGENTS_API] Failed to force heartbeat:', error);
    res.status(500).json({ error: `Failed to force heartbeat: ${error}` });
  }
});

/**
 * GET /api/agents/seed/status - Get seeding status
 */
router.get('/seed/status', async (req, res) => {
  try {
    const status = await getSeedingStatus();
    res.json(status);

  } catch (error) {
    console.error('[AGENTS_API] Failed to get seed status:', error);
    res.status(500).json({ error: `Failed to get seed status: ${error}` });
  }
});

/**
 * POST /api/agents/seed - Seed agent system
 */
router.post('/seed', async (req, res) => {
  try {
    await seedAgentSystem();
    res.json({
      success: true,
      message: 'Agent system seeded successfully'
    });

  } catch (error) {
    console.error('[AGENTS_API] Failed to seed system:', error);
    res.status(500).json({ error: `Failed to seed system: ${error}` });
  }
});

// ═══ Statistics Endpoints ═══

/**
 * GET /api/agents/stats - Get agent system statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { data: schemeStats, error: schemeError } = await supabase
      .rpc('get_scheme_stats');

    const { data: eventStats, error: eventError } = await supabase
      .rpc('get_event_stats');

    if (schemeError && !schemeError.message.includes('function')) {
      throw new Error(`Failed to get scheme stats: ${schemeError.message}`);
    }
    
    if (eventError && !eventError.message.includes('function')) {
      throw new Error(`Failed to get event stats: ${eventError.message}`);
    }

    // Fallback to basic queries if RPC functions don't exist
    const { count: totalSchemes } = await supabase
      .from('schemes')
      .select('*', { count: 'exact', head: true });

    const { count: totalEvents } = await supabase
      .from('agent_events')
      .select('*', { count: 'exact', head: true });

    const { count: totalMissions } = await supabase
      .from('missions')
      .select('*', { count: 'exact', head: true });

    res.json({
      schemes: {
        total: totalSchemes || 0,
        detailed: schemeStats || null
      },
      events: {
        total: totalEvents || 0,
        detailed: eventStats || null
      },
      missions: {
        total: totalMissions || 0
      },
      note: schemeError || eventError ? 'Some detailed stats unavailable (RPC functions not found)' : null
    });

  } catch (error) {
    console.error('[AGENTS_API] Failed to get stats:', error);
    res.status(500).json({ error: `Failed to get stats: ${error}` });
  }
});

export default router;