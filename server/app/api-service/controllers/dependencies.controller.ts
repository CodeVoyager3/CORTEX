import type { Request, Response } from 'express';
import { prisma } from '../../../package/db/prisma';
import { normalizePath, resolveImportSpecifier } from '../../../package/ast/imports';

const MAX_MATCHING_CHUNKS = 20;
const MAX_DEPENDENCIES = 50;

/**
 * GET /api/dependencies?symbol=&repoId=
 *
 * Deterministic dependency lookup straight from the AST-populated CodeChunk
 * columns: outgoing call edges (`calledBy`) plus relative imports resolved to
 * files that exist in the same repository index (shared resolution rules with
 * the blast-radius analysis).
 */
export async function getDependencies(req: Request, res: Response): Promise<void> {
  try {
    const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim() : '';
    const repoId =
      typeof req.query.repoId === 'string' && req.query.repoId ? req.query.repoId : undefined;

    if (!symbol) {
      res.status(400).json({ error: 'The symbol query parameter is required.' });
      return;
    }

    const scope = repoId ? { repositoryId: repoId } : {};

    let matches = await prisma.codeChunk.findMany({
      where: { ...scope, symbolName: symbol },
      select: {
        id: true,
        repositoryId: true,
        filePath: true,
        symbolName: true,
        nodeType: true,
        imports: true,
        calledBy: true,
      },
      take: MAX_MATCHING_CHUNKS,
    });

    if (matches.length === 0) {
      matches = await prisma.codeChunk.findMany({
        where: { ...scope, symbolName: { equals: symbol, mode: 'insensitive' } },
        select: {
          id: true,
          repositoryId: true,
          filePath: true,
          symbolName: true,
          nodeType: true,
          imports: true,
          calledBy: true,
        },
        take: MAX_MATCHING_CHUNKS,
      });
    }

    if (matches.length === 0) {
      res.json({ found: false, target_entity: symbol, matches: [], dependencies: [] });
      return;
    }

    const repoIds = [...new Set(matches.map((m) => m.repositoryId))];

    // Known files per repository, so resolved imports are only surfaced when
    // they actually exist in the index.
    const repoFiles = await prisma.codeChunk.findMany({
      where: { repositoryId: { in: repoIds } },
      select: { repositoryId: true, filePath: true },
      distinct: ['repositoryId', 'filePath'],
    });

    const filesByRepo = new Map<string, Map<string, string>>();
    for (const file of repoFiles) {
      let files = filesByRepo.get(file.repositoryId);
      if (!files) {
        files = new Map();
        filesByRepo.set(file.repositoryId, files);
      }
      files.set(normalizePath(file.filePath), file.filePath);
    }

    const dependencies = new Set<string>();

    for (const chunk of matches) {
      for (const callee of chunk.calledBy) {
        const name = callee.trim();
        if (name && name !== chunk.symbolName) dependencies.add(name);
      }

      const files = filesByRepo.get(chunk.repositoryId);
      if (!files) continue;

      for (const spec of chunk.imports) {
        const resolved = resolveImportSpecifier(spec, chunk.filePath);
        if (!resolved) continue;

        const direct = files.get(resolved);
        if (direct) {
          dependencies.add(direct);
          continue;
        }
        const indexFile = files.get(`${resolved}/index`);
        if (indexFile) dependencies.add(indexFile);
      }
    }

    const repositories = await prisma.repository.findMany({
      where: { id: { in: repoIds } },
      select: { id: true, owner: true, name: true },
    });
    const repoLabels = new Map(repositories.map((r) => [r.id, `${r.owner}/${r.name}`]));

    res.json({
      found: true,
      target_entity: symbol,
      matches: matches.map((m) => ({
        repositoryId: m.repositoryId,
        repository: repoLabels.get(m.repositoryId) ?? '',
        filePath: m.filePath,
        nodeType: m.nodeType,
      })),
      dependencies: [...dependencies].slice(0, MAX_DEPENDENCIES),
    });
  } catch (error) {
    console.error('[api] Error in /api/dependencies:', error);
    res.status(500).json({ error: 'Failed to resolve dependencies' });
  }
}

/**
 * GET /api/dependencies/symbols?repoId=
 *
 * Discovers and returns indexed symbols with outgoing call edges or imports
 * so the frontend can populate realistic dependency graphs and quick-search chips.
 */
export async function listSymbols(req: Request, res: Response): Promise<void> {
  try {
    const repoId =
      typeof req.query.repoId === 'string' && req.query.repoId ? req.query.repoId : undefined;
    const scope = repoId ? { repositoryId: repoId } : {};

    const chunks = await prisma.codeChunk.findMany({
      where: scope,
      select: {
        symbolName: true,
        nodeType: true,
        filePath: true,
        calledBy: true,
        imports: true,
      },
      take: 200,
    });

    const symbolMap = new Map<
      string,
      { name: string; nodeType: string; filePath: string; depCount: number }
    >();

    for (const chunk of chunks) {
      const name = chunk.symbolName?.trim();
      if (!name || name === 'anonymous' || name === 'default') continue;

      const totalDeps = chunk.calledBy.length + chunk.imports.length;
      const existing = symbolMap.get(name);
      if (!existing || totalDeps > existing.depCount) {
        symbolMap.set(name, {
          name,
          nodeType: chunk.nodeType,
          filePath: chunk.filePath,
          depCount: totalDeps,
        });
      }
    }

    const sorted = Array.from(symbolMap.values())
      .sort((a, b) => b.depCount - a.depCount)
      .slice(0, 30);

    res.json({ symbols: sorted });
  } catch (error) {
    console.error('[api] Error in /api/dependencies/symbols:', error);
    res.status(500).json({ error: 'Failed to list symbols' });
  }
}
