import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { env, assertPresent } from '../../../package/config/env';

// The raw request bytes, captured by the express.json `verify` hook in index.ts.
// GitHub signs the original body, not JSON.stringify(parsed) — key order and
// whitespace can differ, so re-serializing would break verification.
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

// Resolve once at startup: fail fast rather than validating against an empty key.
const secret = assertPresent(env.githubWebhookSecret, 'GITHUB_WEBHOOK_SECRET');

/**
 * Verifies the `x-hub-signature-256` header GitHub sends on every delivery.
 * Must run after a body parser configured with a `verify` hook that stashes rawBody.
 */
export function verifyGitHubSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-hub-signature-256'];

  if (typeof signature !== 'string') {
    res.status(401).send('Missing x-hub-signature-256 header');
    return;
  }

  if (!req.rawBody) {
    res.status(400).send('Missing request body');
    return;
  }

  const hmac = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
  const expected = `sha256=${hmac}`;

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);

  // timingSafeEqual throws on length mismatch, so compare lengths first.
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    res.status(401).send('Signature mismatch');
    return;
  }

  next();
}
