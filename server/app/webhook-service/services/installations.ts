import { prisma, upsertInstallation } from '../../../package/db/prisma';
import type { InstallationEvent } from '../normalizers';

/**
 * Persists GitHub App installation lifecycle. Kept separate from the route
 * handler so webhook routing stays thin and DB effects are isolated/testable.
 */

/**
 * Records (or refreshes) an Installation row and returns the set of repositories
 * that should be fully indexed. For `created`/`added` that's the repos in the
 * payload; for `removed`/`deleted` we don't index anything.
 */
export async function recordInstallation(
  event: InstallationEvent,
): Promise<Array<{ owner: string; repo: string }>> {
  const { action, installationId, owner, repositories } = event;

  if (action === 'deleted') {
    await prisma.installation
      .delete({ where: { githubInstallationId: BigInt(installationId) } })
      .catch(() => {
        // Already gone (duplicate delivery) — nothing to clean up.
      });
    return [];
  }

  if (action === 'removed') {
    // Repos were uninstalled; drop our index for them but keep the Installation.
    for (const { owner: repoOwner, repo } of repositories) {
      await prisma.repository
        .deleteMany({ where: { owner: repoOwner, name: repo } })
        .catch(() => undefined);
    }
    return [];
  }

  // created | added (or an unknown positive action): ensure the Installation exists.
  const resolvedOwner = owner || repositories[0]?.owner || '';
  if (resolvedOwner) {
    await upsertInstallation(installationId, resolvedOwner);
  }

  return repositories;
}
