import type { Request, Response } from 'express';
import { ragQueue, reviewQueue } from '../queues';

/**
 * GET /api/jobs/:queue/:id - BullMQ job status for dashboard polling
 * (indexing progress on the rag queue, review progress on the review queue).
 */
export async function getJob(
  req: Request<{ queue: string; id: string }>,
  res: Response,
): Promise<void> {
  const { queue, id } = req.params;

  if (queue !== 'rag' && queue !== 'review') {
    res.status(404).json({ error: `Unknown queue '${queue}'` });
    return;
  }

  const target = queue === 'rag' ? ragQueue : reviewQueue;

  try {
    const job = await target.getJob(id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({
      id: String(job.id),
      queue,
      name: job.name,
      state: await job.getState(),
      progress: job.progress,
      failedReason: job.failedReason ?? null,
      returnValue: job.returnvalue ?? null,
    });
  } catch (error) {
    console.error(`[api] Error fetching job ${queue}/${id}:`, error);
    res.status(503).json({ error: 'Job queue unavailable (is Redis running?)' });
  }
}
