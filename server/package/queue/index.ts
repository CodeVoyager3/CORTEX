import Redis from 'ioredis';
import { env } from '../config/env';

/**
 * Shared queue contract.
 *
 * The webhook-service and API-service (producers) and worker-service (consumer)
 * run in separate processes but must agree on queue names and job payload shapes.
 * Defining both here keeps that contract in one place and makes the jobs
 * type-safe end to end, instead of passing raw GitHub webhook bodies through the
 * queue and re-parsing (and re-validating) them inside each worker.
 */

export const QUEUE_NAMES = {
  rag: 'rag-queue',
  review: 'review-queue',
} as const;

/**
 * Creates a Redis connection for BullMQ.
 * Workers MUST use `maxRetriesPerRequest: null` (BullMQ blocking connections);
 * producers (Queue) do not.
 */
export function createRedisConnection(forWorker: boolean): Redis {
  return forWorker
    ? new Redis(env.redisUrl, { maxRetriesPerRequest: null })
    : new Redis(env.redisUrl);
}

/** A file changed in a push, normalized from the GitHub commit list. */
export interface ChangedFileRef {
  path: string;
  status: 'added' | 'modified' | 'removed';
}

/**
 * RAG queue jobs. Discriminated on `kind`:
 *  - `install`: a GitHub App was (re)installed -> full index of the repo.
 *  - `manual`:  a full index requested from the dashboard (re-index button).
 *  - `push`:    a push event -> worker decides full vs incremental from lastIndexedSha.
 * `installationId` is present when the repo is linked to a GitHub App installation
 * and is used to mint an installation-scoped Octokit; absent -> PAT fallback.
 */
export type RagJobData =
  | { kind: 'install'; installationId?: number; owner: string; repo: string }
  | { kind: 'manual'; installationId?: number; owner: string; repo: string }
  | {
      kind: 'push';
      installationId?: number;
      owner: string;
      repo: string;
      headSha: string;
      changedFiles: ChangedFileRef[];
    };

/** Review queue jobs (one per reviewable pull_request event or dashboard trigger). */
export interface ReviewJobData {
  installationId?: number;
  owner: string;
  repo: string;
  prNumber: number;
}
