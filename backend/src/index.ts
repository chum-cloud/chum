import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
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

// Rate limiting — per IP
const mintLimit = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 10, // 10 mints per minute per IP
  message: { error: 'Too many mint requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const voteLimit = rateLimit({
  windowMs: 60_000,
  max: 30, // 30 votes per minute per IP
  message: { error: 'Too many vote requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const bidLimit = rateLimit({
  windowMs: 60_000,
  max: 10, // 10 bids per minute per IP
  message: { error: 'Too many bid requests. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimit = rateLimit({
  windowMs: 60_000,
  max: 120, // 120 requests per minute per IP (general)
  message: { error: 'Too many requests. Slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limits to sensitive endpoints
app.use('/api/auction/mint', mintLimit);
app.use('/api/auction/confirm-mint', mintLimit);
app.use('/api/auction/vote-free', voteLimit);
app.use('/api/auction/vote-paid', voteLimit);
app.use('/api/auction/bid', bidLimit);
app.use('/api/auction/join-voting', bidLimit);
app.use('/api', generalLimit);

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
