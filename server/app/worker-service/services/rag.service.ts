import { Pinecone } from '@pinecone-database/pinecone';
import { env, assertPresent } from '../../../package/config/env';
import { prisma as sharedPrisma, upsertRepository } from '../../../package/db/prisma';
import { astParser, CodeChunk } from '../../../package/ast/parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata stored alongside every Pinecone vector. */
interface ChunkMetadata {
  repositoryId: string;
  filePath: string;
  symbolName: string;
  nodeType: string;
  startLine: number;
  endLine: number;
  // Required index signature to satisfy Pinecone's RecordMetadata constraint
  [key: string]: string | number | boolean | string[];
}

/** A single enriched context snippet returned to the review service. */
export interface ContextSnippet {
  id: string;
  score: number;
  filePath: string;
  symbolName: string;
  nodeType: string;
  startLine: number;
  endLine: number;
  content: string;
  imports: string[];
  calledBy: string[];
}

/** Shape of each file fed to indexFullRepository. */
export interface RepoFile {
  path: string;
  content: string;
}

/** Shape of a changed-file entry for handleIncrementalPush. */
export interface ChangedFile {
  path: string;
  content?: string;               // absent for 'removed'
  status: 'added' | 'modified' | 'removed';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pinecone Inference embedding model. Change to match your index dimension. */
const EMBED_MODEL = 'llama-text-embed-v2'; // 1024-dim, cosine

/**
 * Max vectors per upsert call.
 * llama-text-embed-v2 supports up to 96 inputs per inference call.
 */
const BATCH_SIZE = 96;

/** Supported file extensions — must match astParser's switch. */
const SUPPORTED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.cpp', '.cc', '.cxx']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the file extension including the leading dot, lower-cased. */
function getExtension(filePath: string): string {
  const idx = filePath.lastIndexOf('.');
  return idx === -1 ? '' : filePath.slice(idx).toLowerCase();
}

/**
 * Builds the deterministic vector ID for a chunk.
 * Format matches the CodeChunk.id pattern in Prisma schema:
 *   "<filePath>::<nodeType>::<symbolName>::<index>"
 */
function buildVectorId(filePath: string, chunkItem: CodeChunk, index: number): string {
  return `${filePath}::${chunkItem.type}::${chunkItem.name}::${index}`;
}

/**
 * Splits an array into sequential batches of at most `size` elements.
 */
function splitIntoBatches<T>(arr: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

/**
 * Formats a CodeChunk into a rich text string for the embedding model.
 * Including the file path and symbol name gives the model semantic context
 * beyond just the raw code snippet.
 */
function buildEmbedText(filePath: string, chunkItem: CodeChunk): string {
  return [
    `File: ${filePath}`,
    `Symbol: ${chunkItem.name} (${chunkItem.type})`,
    `Lines: ${chunkItem.startLine}-${chunkItem.endLine}`,
    `Imports: ${chunkItem.imports.join(', ') || 'none'}`,
    '',
    chunkItem.content,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// RAGService
// ---------------------------------------------------------------------------

export class RAGService {
  private pinecone: Pinecone;
  private prisma: typeof sharedPrisma;
  private indexName: string;

  constructor() {
    this.prisma = sharedPrisma;

    this.pinecone = new Pinecone({
      apiKey: assertPresent(env.pineconeApiKey, 'PINECONE_API_KEY'),
    });

    this.indexName = env.pineconeIndex;
  }

  // -------------------------------------------------------------------------
  // 1. embedAndUpsertChunks
  // -------------------------------------------------------------------------

  /**
   * Generates embeddings for `chunks` in batches, upserts the resulting vectors
   * to Pinecone under the repository's dedicated namespace, and bulk-inserts
   * the structured metadata rows into PostgreSQL.
   *
   * @param repositoryId - Prisma Repository.id (used as Pinecone namespace + filter key)
   * @param filePath     - Relative path of the source file inside the repo
   * @param chunks       - AST-extracted CodeChunk objects for this file
   */
  public async embedAndUpsertChunks(
    repositoryId: string,
    filePath: string,
    chunks: CodeChunk[],
  ): Promise<void> {
    if (chunks.length === 0) return;

    // Namespace isolates one repo's vectors from another in the same index
    const namespace = `repo-${repositoryId}`;
    const index = this.pinecone.index<ChunkMetadata>(this.indexName);
    const ns = index.namespace(namespace);

    // Build embed texts and vector IDs upfront so batching stays aligned
    const texts     = chunks.map((c) => buildEmbedText(filePath, c));
    const vectorIds = chunks.map((c, i) => buildVectorId(filePath, c, i));

    const batches = splitIntoBatches(chunks, BATCH_SIZE);
    let offset = 0;

    for (const batch of batches) {
      const batchTexts = texts.slice(offset, offset + batch.length);
      const batchIds   = vectorIds.slice(offset, offset + batch.length);

      // Step A: Generate embeddings via Pinecone Inference
      const embeddingsList = await this.pinecone.inference.embed({
        model: EMBED_MODEL,
        inputs: batchTexts,
        parameters: { inputType: 'passage', truncate: 'END' },
      });

      // Step B: Build PineconeRecord array and upsert
      const records = batch.map((c, i) => {
        const embedding = embeddingsList.data[i];
        if (!embedding || embedding.vectorType !== 'dense') {
          throw new Error(`Missing dense embedding for chunk ${batchIds[i]}`);
        }

        const denseEmbedding = embedding as { vectorType: 'dense'; values: number[] };

        return {
          id: batchIds[i] as string,
          values: denseEmbedding.values,
          metadata: {
            repositoryId,
            filePath,
            symbolName: c.name,
            nodeType: c.type,
            startLine: c.startLine,
            endLine: c.endLine,
          } satisfies ChunkMetadata,
        };
      });

      await ns.upsert({ records });

      // Step C: Bulk-insert chunk rows into PostgreSQL
      await this.prisma.codeChunk.createMany({
        data: batch.map((c, i) => ({
          id: batchIds[i] as string,
          repositoryId,
          filePath,
          symbolName: c.name,
          nodeType: c.type,
          startLine: c.startLine,
          endLine: c.endLine,
          content: c.content,
          imports: c.imports,
          calledBy: c.calledBy,
        })),
        skipDuplicates: true,  // safe for re-runs
      });

      console.log(
        `[RAG] Upserted ${batch.length} chunks for ${filePath} (batch offset=${offset})`,
      );

      offset += batch.length;
    }
  }

  // -------------------------------------------------------------------------
  // 2. clearRepositoryIndex
  // -------------------------------------------------------------------------

  /**
   * Wipes Pinecone vectors + PostgreSQL chunks for a repo before a full re-index.
   */
  public async clearRepositoryIndex(repositoryId: string): Promise<void> {
    const namespace = `repo-${repositoryId}`;
    const index = this.pinecone.index<ChunkMetadata>(this.indexName);
    const ns = index.namespace(namespace);

    try {
      await ns.deleteAll();
    } catch (err: any) {
      // Empty namespaces throw on some Pinecone tiers — safe to ignore
      console.warn(`[RAG] Pinecone deleteAll for ${namespace}: ${err.message}`);
    }

    await this.prisma.codeChunk.deleteMany({ where: { repositoryId } });
    console.log(`[RAG] Cleared existing index for repository ${repositoryId}`);
  }

  // -------------------------------------------------------------------------
  // 3. indexFullRepository
  // -------------------------------------------------------------------------

  /**
   * Full ingestion workflow for a freshly cloned repository.
   * Parses every supported file, embeds chunks in batches, and records the
   * commit SHA so future pushes can diff incrementally.
   *
   * @param owner    - GitHub repo owner/org
   * @param repoName - GitHub repo name
   * @param files    - Array of { path, content } for all files in the repo
   * @param headSha  - The commit SHA at index time
   */
  public async indexFullRepository(
    owner: string,
    repoName: string,
    files: RepoFile[],
    headSha: string,
  ): Promise<void> {
    // Step 1: Ensure Repository row exists (race-safe upsert on owner+name).
    // The SHA is stamped only after ingestion finishes (Step 4).
    const repo = await upsertRepository(owner, repoName);

    console.log(`[RAG] Indexing full repository ${owner}/${repoName} (id=${repo.id})`);

    // Step 2: Clear any partial/stale index so re-runs update calledBy edges
    await this.clearRepositoryIndex(repo.id);

    // Step 3: Fast in-memory AST parsing across all files
    const allFileChunks: Array<{ filePath: string; chunk: CodeChunk; vectorId: string; embedText: string }> = [];

    for (const file of files) {
      const ext = getExtension(file.path);
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

      const chunks = astParser.parseFile(file.path, file.content, ext);
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]!;
        allFileChunks.push({
          filePath: file.path,
          chunk: c,
          vectorId: buildVectorId(file.path, c, i),
          embedText: buildEmbedText(file.path, c),
        });
      }
    }

    console.log(`[RAG] Parsed ${allFileChunks.length} chunks across ${files.length} files. Starting global batch embedding...`);

    // Step 4: Embed & upsert in global batches of BATCH_SIZE (up to 96 per API call)
    if (allFileChunks.length > 0) {
      const batches = splitIntoBatches(allFileChunks, BATCH_SIZE);
      const namespace = `repo-${repo.id}`;
      const index = this.pinecone.index<ChunkMetadata>(this.indexName);
      const ns = index.namespace(namespace);

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b]!;

        // A: Batch Pinecone Inference
        const embeddingsList = await this.pinecone.inference.embed({
          model: EMBED_MODEL,
          inputs: batch.map((item) => item.embedText),
          parameters: { inputType: 'passage', truncate: 'END' },
        });

        // B: Batch Upsert to Pinecone
        const records = batch.map((item, i) => {
          const embedding = embeddingsList.data[i];
          if (!embedding || embedding.vectorType !== 'dense') {
            throw new Error(`Missing dense embedding for chunk ${item.vectorId}`);
          }
          return {
            id: item.vectorId,
            values: (embedding as { vectorType: 'dense'; values: number[] }).values,
            metadata: {
              repositoryId: repo.id,
              filePath: item.filePath,
              symbolName: item.chunk.name,
              nodeType: item.chunk.type,
              startLine: item.chunk.startLine,
              endLine: item.chunk.endLine,
            } satisfies ChunkMetadata,
          };
        });

        await ns.upsert({ records });

        // C: Batch insert into PostgreSQL
        await this.prisma.codeChunk.createMany({
          data: batch.map((item) => ({
            id: item.vectorId,
            repositoryId: repo.id,
            filePath: item.filePath,
            symbolName: item.chunk.name,
            nodeType: item.chunk.type,
            startLine: item.chunk.startLine,
            endLine: item.chunk.endLine,
            content: item.chunk.content,
            imports: item.chunk.imports,
            calledBy: item.chunk.calledBy,
          })),
          skipDuplicates: true,
        });

        console.log(`[RAG] Batch ${b + 1}/${batches.length} completed (${batch.length} chunks)`);
      }
    }

    // Step 5: Stamp the repository with the indexed commit SHA
    await this.prisma.repository.update({
      where: { id: repo.id },
      data: { lastIndexedSha: headSha },
    });

    console.log(
      `[RAG] Full index complete: ${allFileChunks.length} chunks across ${files.length} files. SHA=${headSha}`,
    );
  }

  // -------------------------------------------------------------------------
  // 4. handleIncrementalPush
  // -------------------------------------------------------------------------

  /**
   * Incremental update triggered by a GitHub `push` event.
   *
   * For removed/modified files:
   *   - Pages through Pinecone IDs with the file-path prefix and deletes them
   *   - Deletes stale CodeChunk rows from PostgreSQL
   *
   * For added/modified files:
   *   - Re-parses, re-embeds, and upserts fresh chunks into both stores
   *
   * @param repositoryId - Prisma Repository.id
   * @param changedFiles - List of changed files with their status
   * @param headSha      - The new head commit SHA after the push
   */
  public async handleIncrementalPush(
    repositoryId: string,
    changedFiles: ChangedFile[],
    headSha: string,
  ): Promise<void> {
    const namespace = `repo-${repositoryId}`;
    const index = this.pinecone.index<ChunkMetadata>(this.indexName);
    const ns = index.namespace(namespace);

    const staleFilePaths = changedFiles
      .filter((f) => f.status === 'removed' || f.status === 'modified')
      .map((f) => f.path);

    // Step 1: Remove stale data for modified + removed files
    if (staleFilePaths.length > 0) {
      // 1a: Delete stale Pinecone vectors by listing IDs with file-path prefix.
      //     Vector IDs are "<filePath>::<type>::<name>::<index>", so paging
      //     the prefix "<filePath>::" catches all chunks from that file.
      for (const filePath of staleFilePaths) {
        const prefix = `${filePath}::`;
        let paginationToken: string | undefined;

        do {
          const listResult = await ns.listPaginated({
            prefix,
            ...(paginationToken !== undefined ? { paginationToken } : {}),
          });
          const ids = (listResult.vectors ?? [])
            .map((v) => v.id)
            .filter((id): id is string => id !== undefined);

          if (ids.length > 0) {
            await ns.deleteMany({ ids });
          }

          paginationToken = listResult.pagination?.next;
        } while (paginationToken);
      }

      // 1b: Delete stale rows from PostgreSQL
      await this.prisma.codeChunk.deleteMany({
        where: {
          repositoryId,
          filePath: { in: staleFilePaths },
        },
      });

      console.log(`[RAG] Deleted stale data for ${staleFilePaths.length} files`);
    }

    // Step 2: Re-index added and modified files
    const filesToIndex = changedFiles.filter(
      (f) => (f.status === 'added' || f.status === 'modified') && f.content !== undefined,
    );

    for (const file of filesToIndex) {
      const ext = getExtension(file.path);
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

      const chunks = astParser.parseFile(file.path, file.content!, ext);
      if (chunks.length === 0) continue;

      await this.embedAndUpsertChunks(repositoryId, file.path, chunks);
    }

    // Step 3: Stamp the new SHA on the Repository record
    await this.prisma.repository.update({
      where: { id: repositoryId },
      data: { lastIndexedSha: headSha },
    });

    console.log(`[RAG] Incremental push complete. SHA=${headSha}`);
  }

  // -------------------------------------------------------------------------
  // 5. retrieveContextForDiff
  // -------------------------------------------------------------------------

  /**
   * Hybrid retrieval for PR review context.
   *
   * 1. Embeds the diff/query text using Pinecone Inference (query inputType).
   * 2. Queries the repository's namespace for the top-K nearest vectors, with
   *    a metadata filter to enforce cross-repo isolation as a safety net.
   * 3. Fetches full chunk content + dependency metadata (imports, calledBy)
   *    from PostgreSQL and zips it with the Pinecone scores.
   *
   * @param repositoryId - Pinecone namespace + Prisma filter key
   * @param diffQuery    - The PR diff text or natural-language question
   * @param topK         - Number of nearest neighbours to retrieve (default 5)
   * @returns            Array of enriched ContextSnippet objects, score-descending
   */
  public async retrieveContextForDiff(
    repositoryId: string,
    diffQuery: string,
    topK = 5,
  ): Promise<ContextSnippet[]> {
    const namespace = `repo-${repositoryId}`;
    const index = this.pinecone.index<ChunkMetadata>(this.indexName);
    const ns = index.namespace(namespace);

    // Step 1: Embed the query text
    const embeddingsList = await this.pinecone.inference.embed({
      model: EMBED_MODEL,
      inputs: [diffQuery],
      parameters: { inputType: 'query', truncate: 'END' },
    });

    const queryEmbedding = embeddingsList.data[0];
    if (!queryEmbedding || queryEmbedding.vectorType !== 'dense') {
      throw new Error('[RAG] Failed to generate query embedding');
    }

    const queryVector = (queryEmbedding as { vectorType: 'dense'; values: number[] }).values;

    // Step 2: Query Pinecone — namespace already isolates this repo, but we
    //         also pass an explicit metadata filter for defence-in-depth.
    const queryResult = await ns.query({
      vector: queryVector,
      topK,
      filter: { repositoryId: { $eq: repositoryId } },
      includeMetadata: true,
    });

    const matches = queryResult.matches ?? [];
    if (matches.length === 0) return [];

    // Step 3: Fetch full CodeChunk rows from PostgreSQL using the vector IDs
    const matchIds = matches.map((m) => m.id);
    const dbChunks = await this.prisma.codeChunk.findMany({
      where: { id: { in: matchIds } },
    });

    // Build a lookup map so we can join in O(n)
    const dbMap = new Map(dbChunks.map((c) => [c.id, c]));

    // Step 4: Assemble enriched ContextSnippets in score-descending order
    const snippets: ContextSnippet[] = [];

    for (const match of matches) {
      const db = dbMap.get(match.id);
      if (!db) continue;          // vector exists but DB row was deleted — skip

      const meta = match.metadata;

      snippets.push({
        id:         match.id,
        score:      match.score ?? 0,
        filePath:   meta?.filePath   ?? db.filePath,
        symbolName: meta?.symbolName ?? db.symbolName,
        nodeType:   meta?.nodeType   ?? db.nodeType,
        startLine:  meta?.startLine  ?? db.startLine,
        endLine:    meta?.endLine    ?? db.endLine,
        content:    db.content,
        imports:    db.imports,
        calledBy:   db.calledBy,
      });
    }

    return snippets;
  }
}

export const ragService = new RAGService();
