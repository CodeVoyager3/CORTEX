import type { Request, Response } from 'express';
import { prisma } from '../../../package/db/prisma';

/**
 * GET /api/stats - dashboard overview counters.
 *
 * Graph-level numbers (files/chunks/edges) come from the AST-populated
 * CodeChunk table so the dashboard cards reflect the real index state.
 */
export async function getStats(_req: Request, res: Response): Promise<void> {
  try {
    const [totalRepos, totalReviews, totalIssues, criticalIssues, chunks, installations] =
      await Promise.all([
        prisma.repository.count(),
        prisma.pRReview.count(),
        prisma.issue.count(),
        prisma.issue.count({ where: { severity: 'critical' } }),
        prisma.codeChunk.count(),
        prisma.installation.count(),
      ]);

    const [fileRows, relationshipRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{ count: number }>
      >`SELECT COUNT(DISTINCT ("repositoryId", "filePath"))::int AS count FROM "CodeChunk"`,
      prisma.$queryRaw<
        Array<{ total: number }>
      >`SELECT COALESCE(SUM(COALESCE(cardinality("imports"), 0) + COALESCE(cardinality("calledBy"), 0)), 0)::int AS total FROM "CodeChunk"`,
    ]);

    res.json({
      totalRepos,
      totalReviews,
      totalIssues,
      criticalIssues,
      filesIndexed: fileRows[0]?.count ?? 0,
      chunks,
      relationships: relationshipRows[0]?.total ?? 0,
      installations,
    });
  } catch (error) {
    console.error('[api] Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
}
