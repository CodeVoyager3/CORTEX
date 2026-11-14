import express from 'express';
import { env } from '../../package/config/env';
import { webhookRouter } from './routes/webhook';

const app = express();

// Capture raw bytes BEFORE parsing — GitHub signs the original request body, and
// re-serializing parsed JSON can differ (key order/whitespace), breaking HMAC.
// limit raised above the 100kb default: push/PR payloads routinely exceed it and
// would be rejected with 413 before signature verification ever runs.
app.use(
  express.json({
    limit: '25mb',
    verify: (req: express.Request, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(webhookRouter);

app.listen(env.webhookPort, () => {
  console.log(`Webhook Service listening on port ${env.webhookPort}`);
});
