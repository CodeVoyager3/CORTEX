import type { Request, Response } from 'express';
import { prisma } from '../../../package/db/prisma';
import { reviewQueue } from '../queues';

/** GET /api/reviews - all PR reviews, optionally filtered by ?repoId=. */
export async function listReviews(req: Request, res: Response): Promise<void> {
  const { repoId } = req.query;
  try {
    const where = repoId ? { repositoryId: String(repoId) } : undefined;

    const reviews = await prisma.pRReview.findMany({
      ...(where ? { where } : {}),
      include: { _count: { select: { issues: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (error) {
    console.error('[api] Error fetching PR reviews:', error);
    res.status(500).json({ error: 'Failed to fetch PR reviews' });
  }
}

/** GET /api/reviews/:id - one review with its issues and parent repo. */
export async function getReview(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const review = await prisma.pRReview.findUnique({
      where: { id },
      include: { issues: true },
    });

    if (!review) {
      res.status(404).json({ error: 'Review report not found' });
      return;
    }

    const repo = await prisma.repository.findUnique({
      where: { id: review.repositoryId },
      select: { owner: true, name: true },
    });

    res.json({ ...review, repository: repo });
  } catch (error) {
    console.error(`[api] Error fetching review ${id}:`, error);
    res.status(500).json({ error: 'Failed to fetch review report' });
  }
}

/**
 * POST /api/reviews - queue a PR review from the dashboard. The review worker
 * fetches the diff, computes blast radius, retrieves RAG context, runs the LLM
 * review and posts the CORTEX comment on GitHub.
 */
export async function createReview(req: Request, res: Response): Promise<void> {
  try {
    const owner = typeof req.body?.owner === 'string' ? req.body.owner.trim() : '';
    const repoName = typeof req.body?.repo === 'string' ? req.body.repo.trim() : '';
    const prNumber = Number(req.body?.prNumber);

    if (!owner || !repoName) {
      res.status(400).json({ error: 'owner and repo are required.' });
      return;
    }
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      res.status(400).json({ error: 'prNumber must be a positive integer.' });
      return;
    }

    const job = await reviewQueue.add('review-pr', { owner, repo: repoName, prNumber });
    res.status(202).json({ jobId: String(job.id) });
  } catch (error) {
    console.error('[api] Error queueing PR review:', error);
    res.status(500).json({ error: 'Failed to queue PR review' });
  }
}
