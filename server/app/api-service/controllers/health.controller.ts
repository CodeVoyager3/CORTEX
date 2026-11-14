import type { Request, Response } from 'express';
import type { Queue } from 'bullmq';
import { prisma } from '../../../package/db/prisma';
import { env, githubAppConfigured } from '../../../package/config/env';
import { createRedisConnection } from '../../../package/queue';
import { ragQueue, reviewQueue } from '../queues';

// Dedicated client for health probes (queue producers own their own connections).
const redis = createRedisConnection(false);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function checkDatabase(): Promise<boolean> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 3000);
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const pong = await withTimeout(redis.ping(), 3000);
    return pong === 'PONG';
  } catch {
    return false;
  }
}

interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

async function getQueueCounts(queue: Queue): Promise<QueueCounts | null> {
  try {
    const counts = await withTimeout(
      queue.getJobCounts('waiting', 'active', 'completed', 'failed'),
      3000,
    );
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/health - component-level status for the dashboard. Always answers
 * 200 when the API process itself is up; each dependency reports its own flag
 * so the UI can render precise online/offline states.
 */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const [database, redisOk] = await Promise.all([checkDatabase(), checkRedis()]);

  let queues: { rag: QueueCounts | null; review: QueueCounts | null } | null = null;
  if (redisOk) {
    const [rag, review] = await Promise.all([getQueueCounts(ragQueue), getQueueCounts(reviewQueue)]);
    queues = { rag, review };
  }

  res.json({
    ok: database && redisOk,
    database,
    redis: redisOk,
    pineconeConfigured: Boolean(env.pineconeApiKey),
    groqConfigured: Boolean(env.groqApiKey),
    githubConfigured: Boolean(env.githubToken) || githubAppConfigured,
    queues,
  });
}
