import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { Installation, Repository } from '@prisma/client';
import { env, assertPresent } from '../config/env';

// Single shared connection pool + Prisma client for the whole process.
// Instantiating one client per module exhausts Postgres connection slots
// (each pg.Pool defaults to max:10; the worker process loads 5+ modules).
const pool = new Pool({ connectionString: assertPresent(env.databaseUrl, 'DATABASE_URL') });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
export { pool };

function isUniqueConstraintError(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002';
}

/**
 * Prisma's `upsert` is a non-atomic SELECT-then-INSERT. Concurrent handlers for
 * the same row (e.g. a `push` and a `pull_request` event for one repo) can both
 * miss it and attempt an INSERT; the loser throws P2002. On collision the row
 * now exists, so re-read and return it via `readBack`.
 */
async function upsertWithRetry<T>(
  write: () => Promise<T>,
  readBack: () => Promise<T | null>,
): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const existing = await readBack();
      if (existing) return existing;
    }
    throw err;
  }
}

export async function upsertRepository(owner: string, name: string): Promise<Repository> {
  const where = { owner_name: { owner, name } } as const;
  return upsertWithRetry(
    () => prisma.repository.upsert({ where, create: { owner, name }, update: {} }),
    () => prisma.repository.findUnique({ where }),
  );
}

export async function upsertInstallation(
  githubInstallationId: number,
  owner: string,
): Promise<Installation> {
  const where = { githubInstallationId: BigInt(githubInstallationId) } as const;
  return upsertWithRetry(
    () =>
      prisma.installation.upsert({
        where,
        create: { githubInstallationId: BigInt(githubInstallationId), owner },
        update: { owner },
      }),
    () => prisma.installation.findUnique({ where }),
  );
}

