import { Router } from 'express';
import { queueTask, getPendingTasks, claimTask, completeTask, failTask, getTaskResults } from '../services/agent-tasks';

const router = Router();

// Queue a new task
router.post('/tasks', async (req, res) => {
  try {
    const { task_type, agent_id, payload, priority } = req.body;
    if (!task_type || !agent_id) {
      return res.status(400).json({ error: 'task_type and agent_id required' });
    }
    const task = await queueTask({ task_type, agent_id, payload: payload || {}, priority });
    res.json({ task });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending tasks (VPS polls this)
router.get('/tasks/pending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const tasks = await getPendingTasks(limit);
    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Claim a task
router.post('/tasks/:id/claim', async (req, res) => {
  try {
    const ok = await claimTask(parseInt(req.params.id));
    res.json({ claimed: ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Complete a task
router.post('/tasks/:id/complete', async (req, res) => {
  try {
    await completeTask(parseInt(req.params.id), req.body.result || {});
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fail a task
router.post('/tasks/:id/fail', async (req, res) => {
  try {
    await failTask(parseInt(req.params.id), req.body.error || 'Unknown error');
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get results for an agent
router.get('/tasks/results/:agent_id', async (req, res) => {
  try {
    const tasks = await getTaskResults(
      req.params.agent_id,
      req.query.task_type as string,
      parseInt(req.query.limit as string) || 10
    );
    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
