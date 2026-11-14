import { Router, type Request, type Response } from 'express';
import { verifyGitHubSignature } from '../middleware/verifySignature';
import {
  normalizeInstallation,
  normalizePullRequest,
  normalizePush,
} from '../normalizers';
import { ragQueue, reviewQueue } from '../queues';
import { recordInstallation } from '../services/installations';

/**
 * GitHub webhook receiver.
 *
 * Dispatches on the `x-github-event` header, normalizes the raw payload into the
 * shared job contract, enqueues work, and always responds fast (200) so GitHub
 * does not retry. All heavy lifting happens in the worker-service.
 */
export const webhookRouter = Router();

webhookRouter.post('/webhook', verifyGitHubSignature, async (req: Request, res: Response) => {
  const event = req.headers['x-github-event'];
  const body = req.body as Record<string, unknown>;

  try {
    switch (event) {
      case 'ping':
        res.status(200).send('pong');
        return;

      case 'push': {
        const job = normalizePush(body);
        if (job && job.kind === 'push') {
          await ragQueue.add('index-repo', job);
          console.log(`[Webhook] Queued push for ${job.owner}/${job.repo} @ ${job.headSha.slice(0, 7)}`);
        } else {
          console.log('[Webhook] Ignored malformed push payload');
        }
        break;
      }

      case 'pull_request': {
        const job = normalizePullRequest(body);
        if (job) {
          await reviewQueue.add('review-pr', job);
          console.log(`[Webhook] Queued review for ${job.owner}/${job.repo} PR #${job.prNumber}`);
        } else {
          console.log(`[Webhook] Ignored PR action: ${String(body.action ?? 'unknown')}`);
        }
        break;
      }

      case 'installation':
      case 'installation_repositories': {
        const normalized = normalizeInstallation(body);
        if (!normalized) {
          console.log('[Webhook] Ignored installation event without installation.id');
          break;
        }
        const repos = await recordInstallation(normalized);
        for (const repo of repos) {
          await ragQueue.add('index-repo', {
            kind: 'install',
            installationId: normalized.installationId,
            owner: repo.owner,
            repo: repo.repo,
          });
        }
        console.log(
          `[Webhook] Installation ${normalized.action} (id=${normalized.installationId}); queued ${repos.length} repo(s)`,
        );
        break;
      }

      default:
        console.log(`[Webhook] Ignored event: ${String(event ?? 'unknown')}`);
    }
  } catch (err) {
    // Log but still 200 — we do not want GitHub to redeliver on a transient
    // DB/Redis hiccup for an event we have already accepted.
    console.error(`[Webhook] Error handling '${String(event)}':`, err);
  }

  res.status(200).send('Webhook received and queued');
});
