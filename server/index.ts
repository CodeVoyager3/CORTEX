import express from 'express';
import cors from 'cors';
import { env } from './package/config/env';
import { apiRouter } from './app/api-service/routes';
import { webhookRouter } from './app/webhook-service/routes/webhook';

// Boot background BullMQ workers in the same process
import './app/worker-service/workers/rag.worker';
import './app/worker-service/workers/review.worker';

const app = express();

app.use(cors());

// Capture raw bytes for GitHub HMAC verification (limit 25mb for large diffs)
app.use(
  express.json({
    limit: '25mb',
    verify: (req: express.Request, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Health check probes for hosting providers (Render, Railway, Fly.io, etc.)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (_req, res) => {
  res.status(200).send('CORTEX Server is healthy and running');
});

// REST API routes: /api/...
app.use('/api', apiRouter);

// GitHub Webhook route: /webhook
app.use(webhookRouter);

// Render injects PORT; fallback to API_PORT or 3001
const port = Number(process.env.PORT) || env.apiPort || 3001;

app.listen(port, () => {
  console.log(`[CORTEX Server] Listening on port ${port}`);
  console.log(`  - REST API available at: http://localhost:${port}/api`);
  console.log(`  - Webhook receiver at:   http://localhost:${port}/webhook`);
  console.log(`  - BullMQ Background Workers active (RAG & Review)`);
});
