import type { Request, Response } from 'express';
import { prisma } from '../../../package/db/prisma';
import { buildChatPrompt, runChat } from '../../../package/ai/chat';
import { resolveImportSpecifier } from '../../../package/ast/imports';
import type { ContextSnippet } from '../../worker-service/services/rag.service';

/** Fan-out guards so one chat request stays cheap on multi-repo workspaces. */
const MAX_REPOS = 10;
const TOP_K_PER_REPO = 5;
const MAX_SNIPPETS = 8;
const MAX_DEPENDENCIES = 12;

/** Outgoing edges of the top snippet, shown as a "related code" affordance in chat. */
function collectDependencies(top: ContextSnippet): string[] {
  const deps = new Set<string>();

  for (const name of top.calledBy) {
    const trimmed = name.trim();
    if (trimmed) deps.add(trimmed);
  }
  for (const spec of top.imports) {
    const resolved = resolveImportSpecifier(spec, top.filePath);
    if (resolved) deps.add(resolved);
  }

  return [...deps].slice(0, MAX_DEPENDENCIES);
}

/**
 * POST /api/chat - RAG question answering across the indexed repositories.
 *
 * Embeds the question, retrieves the best matching code snippets from each
 * repository's Pinecone namespace, and asks the LLM to answer strictly from
 * that context with file citations.
 */
export async function chat(req: Request, res: Response): Promise<void> {
  try {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const repoId =
      typeof req.body?.repoId === 'string' && req.body.repoId ? req.body.repoId : undefined;

    if (!question) {
      res.status(400).json({ error: 'A question is required.' });
      return;
    }

    const repos = await prisma.repository.findMany({
      ...(repoId ? { where: { id: repoId } } : {}),
      select: { id: true },
      take: MAX_REPOS,
    });

    if (repos.length === 0) {
      res.status(400).json({ error: 'No repositories indexed yet. Index a repository first.' });
      return;
    }

    // Loaded lazily so the API service can boot (and serve health/stats/list)
    // even when Pinecone is not configured.
    const { ragService } = await import('../../worker-service/services/rag.service');

    const snippets: ContextSnippet[] = [];
    let attempted = 0;
    let failed = 0;

    for (const repo of repos) {
      attempted += 1;
      try {
        const hits = await ragService.retrieveContextForDiff(repo.id, question, TOP_K_PER_REPO);
        snippets.push(...hits);
      } catch (error) {
        failed += 1;
        console.warn(`[api] chat retrieval failed for repo ${repo.id}:`, (error as Error).message);
      }
    }

    snippets.sort((a, b) => b.score - a.score);
    const top = snippets.slice(0, MAX_SNIPPETS);
    const [topHit] = top;

    if (!topHit) {
      if (attempted > 0 && failed === attempted) {
        res
          .status(500)
          .json({ error: 'Vector search failed. Check the Pinecone configuration and try again.' });
        return;
      }
      res.json({
        answer:
          'No relevant code was found in the index for this question. Make sure a repository has been indexed and try rephrasing.',
      });
      return;
    }

    const context = top
      .map(
        (snippet) =>
          `File: ${snippet.filePath}\nSymbol: ${snippet.symbolName} (${snippet.nodeType}), lines ${snippet.startLine}-${snippet.endLine}\n${snippet.content}`,
      )
      .join('\n\n---\n\n');

    const answer = await runChat(buildChatPrompt(question, context));
    const dependencies = collectDependencies(topHit);

    res.json({
      answer,
      target_entity: topHit.symbolName,
      ...(dependencies.length > 0 ? { dependencies } : {}),
    });
  } catch (error) {
    console.error('[api] Error in /api/chat:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Chat failed' });
  }
}
