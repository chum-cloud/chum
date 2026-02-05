import { Router } from 'express';
import { readRoomMessages, getRoomStats } from '../services/room.js';

const router = Router();

// GET /api/cloud/room?limit=50&type=ALPHA
router.get('/cloud/room', async (_req, res) => {
  try {
    const limit = Math.min(parseInt(_req.query.limit as string) || 50, 100);
    const typeFilter = _req.query.type as string | undefined;

    const messages = await readRoomMessages(limit);
    const filtered = typeFilter
      ? messages.filter(m => m.msgTypeName === typeFilter)
      : messages;
    const stats = getRoomStats(messages);

    res.json({ success: true, messages: filtered, stats });
  } catch (error) {
    console.error('[ROOM] Route error:', error);
    res.status(500).json({ success: false, error: 'Failed to read room messages' });
  }
});

export default router;
