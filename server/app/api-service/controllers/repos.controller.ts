import type { Request, Response } from 'express';
import { prisma, upsertRepository, upsertInstallation } from '../../../package/db/prisma';
import { env, githubAppConfigured } from '../../../package/config/env';
import { createAppOctokit } from '../../../package/github/app-auth';
import { ragQueue } from '../queues';

/**
 * Parses user input from the dashboard index form.
 * Accepts "https://github.com/owner/name(.git)" and the "owner/name" shorthand;
 * returns null for anything else (including local paths, which the GitHub-based
 * indexing pipeline does not support).
 */
export function parseGithubRepoInput(input: string): { owner: string; name: string } | null {
  let value = input.trim();
  if (!value) return null;

  value = value.replace(/\/+$/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  if (!value) return null;

  const urlMatch = value.match(/^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)$/i);
  if (urlMatch && urlMatch[1] && urlMatch[2]) {
    return { owner: urlMatch[1], name: urlMatch[2] };
  }

  const shorthandMatch = value.match(/^([A-Za-z0-9][A-Za-z0-9-_.]*)\/([A-Za-z0-9][A-Za-z0-9-_.]*)$/);
  if (shorthandMatch && shorthandMatch[1] && shorthandMatch[2]) {
    if (shorthandMatch[1].toLowerCase() === 'github.com') return null;
    return { owner: shorthandMatch[1], name: shorthandMatch[2] };
  }

  return null;
}

/** GET /api/repos - all tracked repositories with counts for the dashboard. */
export async function listRepos(_req: Request, res: Response): Promise<void> {
  try {
    const repos = await prisma.repository.findMany({
      include: { _count: { select: { chunks: true, reviews: true } } },
      orderBy: { name: 'asc' },
    });

    // Distinct file paths per repo (fileCount) so cards can show real file totals.
    const fileRows = await prisma.codeChunk.findMany({
      distinct: ['repositoryId', 'filePath'],
      select: { repositoryId: true },
    });
    const fileCounts = new Map<string, number>();
    for (const row of fileRows) {
      fileCounts.set(row.repositoryId, (fileCounts.get(row.repositoryId) ?? 0) + 1);
    }

    res.json(
      repos.map((repo) => ({
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        lastIndexedSha: repo.lastIndexedSha,
        installationId: repo.installationId,
        fileCount: fileCounts.get(repo.id) ?? 0,
        chunkCount: repo._count.chunks,
        reviewCount: repo._count.reviews,
      })),
    );
  } catch (error) {
    console.error('[api] Error fetching repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
}

/** GET /api/repos/:id - one repository with a sample of chunks + recent reviews. */
export async function getRepo(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const repo = await prisma.repository.findUnique({
      where: { id },
      include: {
        chunks: {
          take: 10,
          select: { id: true, filePath: true, symbolName: true, nodeType: true },
        },
      },
    });

    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    const reviews = await prisma.pRReview.findMany({
      where: { repositoryId: id },
      include: { issues: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({ repo, reviews });
  } catch (error) {
    console.error(`[api] Error fetching repo ${id}:`, error);
    res.status(500).json({ error: 'Failed to fetch repository details' });
  }
}

/**
 * POST /api/repos/index - queue a full GitHub index for the dashboard.
 * The worker resolves the default branch, downloads the zipball and embeds the
 * AST chunks; the client polls GET /api/jobs/rag/:jobId for progress.
 */
export async function indexRepo(req: Request, res: Response): Promise<void> {
  try {
    const raw = typeof req.body?.repo === 'string' ? req.body.repo.trim() : '';
    const parsed = raw ? parseGithubRepoInput(raw) : null;

    if (!parsed) {
      res.status(400).json({
        error:
          'Provide a GitHub repository URL (https://github.com/owner/name) or owner/name. Local paths are not supported.',
      });
      return;
    }

    if (!env.githubToken && !githubAppConfigured) {
      res.status(400).json({
        error:
          'GitHub authentication is not configured on the server (set GITHUB_TOKEN or GitHub App credentials).',
      });
      return;
    }

    const repo = await upsertRepository(parsed.owner, parsed.name);

    let installationId: number | undefined;
    if (repo.installationId) {
      const installation = await prisma.installation.findUnique({
        where: { id: repo.installationId },
        select: { githubInstallationId: true },
      });
      if (installation) installationId = Number(installation.githubInstallationId);
    } else if (githubAppConfigured) {
      // Dynamic lookup: check if the GitHub App is installed on this repo
      try {
        const appOctokit = createAppOctokit();
        const { data: inst } = await appOctokit.rest.apps.getRepoInstallation({
          owner: parsed.owner,
          repo: parsed.name,
        });
        if (inst?.id) {
          installationId = inst.id;
          const accountLogin = (inst.account && 'login' in inst.account) ? (inst.account as any).login : parsed.owner;
          const dbInst = await upsertInstallation(inst.id, accountLogin);
          await prisma.repository.update({
            where: { id: repo.id },
            data: { installationId: dbInst.id },
          });
        }
      } catch (err) {
        console.warn(`[api] Could not resolve App installation for ${parsed.owner}/${parsed.name}:`, (err as Error).message);
      }
    }

    const job = await ragQueue.add('manual-index', {
      kind: 'manual',
      owner: parsed.owner,
      repo: parsed.name,
      ...(installationId !== undefined ? { installationId } : {}),
    });

    res.status(202).json({
      jobId: String(job.id),
      repository: { id: repo.id, owner: repo.owner, name: repo.name },
    });
  } catch (error) {
    console.error('[api] Error queueing repository index:', error);
    res.status(500).json({ error: 'Failed to queue repository indexing' });
  }
}

/**
 * DELETE /api/repos/:id - drop a repository and its index: Pinecone namespace
 * (best-effort) plus the relational rows (chunks/reviews/issues cascade).
 */
export async function deleteRepo(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const repo = await prisma.repository.findUnique({ where: { id } });
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }

    let pineconeCleared = false;
    try {
      // Imported lazily so Pinecone stays optional for the API service boot.
      const { ragService } = await import('../../worker-service/services/rag.service');
      await ragService.clearRepositoryIndex(id);
      pineconeCleared = true;
    } catch (error) {
      console.warn(`[api] Pinecone cleanup skipped for ${id}:`, (error as Error).message);
    }

    await prisma.repository.delete({ where: { id } });
    res.json({ ok: true, pineconeCleared });
  } catch (error) {
    console.error(`[api] Error deleting repository ${id}:`, error);
    res.status(500).json({ error: 'Failed to delete repository' });
  }
}
