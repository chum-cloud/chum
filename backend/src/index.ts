import express from 'express';
import cors from 'cors';
import { config } from './config';
import stateRouter from './routes/state';
import thoughtRouter from './routes/thought';
import tweetRouter from './routes/tweet';
import thoughtsRouter from './routes/thoughts';
import villainRouter from './routes/villain';
import cloudRouter from './routes/cloud';
import skillRouter from './routes/skill';
import { startBalanceCheck } from './cron/balanceCheck';
import { startQuietDetector } from './cron/quietDetector';
import streamRouter from './routes/stream';
import roomRouter from './routes/room';
import { startEventThoughtListener } from './services/eventThoughts';

const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', stateRouter);
app.use('/api', thoughtRouter);
app.use('/api', tweetRouter);
app.use('/api', thoughtsRouter);
app.use('/api', villainRouter);
app.use('/api', cloudRouter);
app.use('/api', skillRouter);
app.use('/api', streamRouter);
app.use('/api', roomRouter);

app.listen(config.port, () => {
  console.log(`[CHUM] Server running on port ${config.port}`);
  startBalanceCheck();
  startEventThoughtListener();
  startQuietDetector();
});
