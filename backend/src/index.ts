import express from 'express';
import cors from 'cors';
import { config } from './config';
import villainRouter from './routes/villain';
import auctionRouter from './routes/auction';
import { startAuctionCrank } from './services/auction-crank';

const app = express();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', villainRouter);
app.use('/api', auctionRouter);

app.listen(config.port, () => {
  console.log(`[CHUM] Server running on port ${config.port}`);
  // Start the auction crank (epoch/auction lifecycle)
  startAuctionCrank();
});
