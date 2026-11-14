import { Queue } from 'bullmq';
import {
  QUEUE_NAMES,
  createRedisConnection,
  type RagJobData,
  type ReviewJobData,
} from '../../package/queue';

/**
 * BullMQ producers for the API service (dashboard-triggered indexing, PR
 * reviews, and job-status polling). Instantiated once at module load so every
 * request reuses the same Redis connections rather than opening new ones.
 */
const connection = createRedisConnection(false);

export const ragQueue = new Queue<RagJobData>(QUEUE_NAMES.rag, { connection });
export const reviewQueue = new Queue<ReviewJobData>(QUEUE_NAMES.review, { connection });
