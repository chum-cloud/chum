import express from 'express';
import cors from 'cors';
import { config } from './config';
import stateRouter from './routes/state';
import thoughtRouter from './routes/thought';
import tweetRouter from './routes/tweet';
import thoughtsRouter from './routes/thoughts';
import { startBalanceCheck } from './cron/balanceCheck';
import { startThoughtLoop } from './cron/thoughtLoop';

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

app.listen(config.port, () => {
  console.log(`[CHUM] Server running on port ${config.port}`);
  startBalanceCheck();
  startThoughtLoop();
});
