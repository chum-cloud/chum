import express from 'express';
import cors from 'cors';
import { config } from './config';
import villainRouter from './routes/villain';

const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', villainRouter);

app.listen(config.port, () => {
  console.log(`[CHUM] Server running on port ${config.port}`);
});
