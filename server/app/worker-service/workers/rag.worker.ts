import { Worker, type Job } from 'bullmq';
import type { Octokit } from '@octokit/rest';
import AdmZip from 'adm-zip';
import { QUEUE_NAMES, createRedisConnection, type RagJobData } from '../../../package/queue';
import { getOctokit } from '../../../package/github/client';
import { createAppOctokit } from '../../../package/github/app-auth';
import { env, githubAppConfigured } from '../../../package/config/env';
import { prisma, upsertRepository } from '../../../package/db/prisma';
import { ragService, type ChangedFile, type RepoFile } from '../services/rag.service';

const connection = createRedisConnection(true);

const SUPPORTED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.cpp', '.cc', '.cxx']);
const SKIP_PATH_FRAGMENTS = [
  'node_modules/',
  'dist/',
  'build/',
  '.git/',
  'vendor/',
  'coverage/',
  '.next/',
  'out/',
  '.turbo/',
  '.output/',
  'public/',
  'assets/',
];

function getExtension(filePath: string): string {
  const idx = filePath.lastIndexOf('.');
  return idx === -1 ? '' : filePath.slice(idx).toLowerCase();
}

function shouldSkipPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.startsWith('.')) return true;
  if (
    normalized.endsWith('.d.ts') ||
    normalized.endsWith('.min.js') ||
    normalized.endsWith('.bundle.js') ||
    normalized.endsWith('.map')
  ) {
    return true;
  }
  return SKIP_PATH_FRAGMENTS.some((frag) => normalized.includes(frag));
}

/** Downloads the repo zipball at `ref` and returns supported source files. */
async function downloadRepositoryFiles(
  octokit: Octokit,
  owner: string,
  repoName: string,
  ref: string,
): Promise<RepoFile[]> {
  console.log(`[RAG Worker] Downloading zipball ${owner}/${repoName}@${ref.substring(0, 7)}`);

  const response = await octokit.rest.repos.downloadZipballArchive({ owner, repo: repoName, ref });

  const zipBuffer = Buffer.from(response.data as ArrayBuffer);
  const zip = new AdmZip(zipBuffer);
  const files: RepoFile[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    // GitHub zipballs prefix paths with "{owner}-{repo}-{sha}/..."
    const relativePath = entry.entryName.split('/').slice(1).join('/');
    if (!relativePath || shouldSkipPath(relativePath)) continue;
    if (!SUPPORTED_EXTENSIONS.has(getExtension(relativePath))) continue;

    try {
      files.push({ path: relativePath, content: entry.getData().toString('utf-8') });
    } catch (err) {
      console.warn(`[RAG Worker] Skipping ${relativePath}: ${(err as Error).message}`);
    }
  }

  console.log(`[RAG Worker] Extracted ${files.length} supported source files from zipball`);
  return files;
}

/** Points a Repository at its Installation (best-effort; App installs only). */
async function linkInstallation(
  repositoryId: string,
  githubInstallationId: number | undefined,
): Promise<void> {
  if (githubInstallationId === undefined) return;
  const installation = await prisma.installation.findUnique({
    where: { githubInstallationId: BigInt(githubInstallationId) },
    select: { id: true },
  });
  if (!installation) return;
  await prisma.repository.update({
    where: { id: repositoryId },
    data: { installationId: installation.id },
  });
}

/** Fetches the current HEAD sha of a repo's default branch. */
async function resolveDefaultBranchHead(
  octokit: Octokit,
  owner: string,
  repoName: string,
): Promise<{ ref: string; sha: string }> {
  const { data: repo } = await octokit.rest.repos.get({ owner, repo: repoName });
  const ref = repo.default_branch;
  const { data: commit } = await octokit.rest.repos.getCommit({ owner, repo: repoName, ref });
  return { ref, sha: commit.sha };
}

/**
 * Full-index workflow shared by `install` (GitHub App installed) and `manual`
 * (dashboard "Index Repository") jobs: resolve the default branch head,
 * download the zipball, parse + embed every supported file, stamp the SHA.
 */
async function runFullIndex(
  label: 'install' | 'manual',
  owner: string,
  repoName: string,
  installationId: number | undefined,
): Promise<void> {
  console.log(`[RAG Worker] Full index (${label}) for ${owner}/${repoName}`);

  let effectiveInstallationId = installationId;
  if (effectiveInstallationId === undefined && githubAppConfigured) {
    try {
      const appOctokit = createAppOctokit();
      const { data: inst } = await appOctokit.rest.apps.getRepoInstallation({ owner, repo: repoName });
      if (inst?.id) effectiveInstallationId = inst.id;
    } catch {
      // App not installed on repo, will fallback
    }
  }

  const octokit = getOctokit(effectiveInstallationId);
  const { ref, sha } = await resolveDefaultBranchHead(octokit, owner, repoName);

  const repo = await upsertRepository(owner, repoName);
  await linkInstallation(repo.id, effectiveInstallationId);

  const files = await downloadRepositoryFiles(octokit, owner, repoName, ref);
  await ragService.indexFullRepository(owner, repoName, files, sha);
  console.log(`[RAG Worker] Full index complete for ${owner}/${repoName}`);
}

async function handleInstall(job: Extract<RagJobData, { kind: 'install' }>): Promise<void> {
  await runFullIndex('install', job.owner, job.repo, job.installationId);
}

async function handleManual(job: Extract<RagJobData, { kind: 'manual' }>): Promise<void> {
  await runFullIndex('manual', job.owner, job.repo, job.installationId);
}

async function handlePush(job: Extract<RagJobData, { kind: 'push' }>): Promise<void> {
  const { owner, repo: repoName, headSha, changedFiles, installationId } = job;

  // Ignore branch deletes (GitHub sends an all-zeros `after` sha).
  if (/^0+$/.test(headSha)) {
    console.log(`[RAG Worker] Ignoring branch delete for ${owner}/${repoName}`);
    return;
  }

  console.log(`[RAG Worker] Processing push for ${owner}/${repoName} @ ${headSha.substring(0, 7)}`);
  const octokit = getOctokit(installationId);
  const repo = await upsertRepository(owner, repoName);
  await linkInstallation(repo.id, installationId);

  // First push / never indexed -> full zipball index.
  if (!repo.lastIndexedSha) {
    console.log('[RAG Worker] No lastIndexedSha - running full repository index');
    const files = await downloadRepositoryFiles(octokit, owner, repoName, headSha);
    await ragService.indexFullRepository(owner, repoName, files, headSha);
    console.log(`[RAG Worker] Full index complete for ${owner}/${repoName}`);
    return;
  }

  // Incremental: fetch fresh content for added/modified files.
  const files: ChangedFile[] = changedFiles.map((f) => ({ path: f.path, status: f.status }));
  if (files.length === 0) {
    console.log('[RAG Worker] No changed files detected in push. Skipping.');
    return;
  }

  for (const file of files) {
    if (file.status !== 'added' && file.status !== 'modified') continue;
    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo: repoName,
        path: file.path,
        ref: headSha,
      });
      if ('content' in response.data && typeof response.data.content === 'string') {
        file.content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      }
    } catch (err) {
      console.warn(`[RAG Worker] Failed to fetch content for ${file.path}: ${(err as Error).message}`);
    }
  }

  await ragService.handleIncrementalPush(repo.id, files, headSha);
  console.log(`[RAG Worker] Successfully indexed push for ${owner}/${repoName}`);
}

export const ragWorker = new Worker<RagJobData>(
  QUEUE_NAMES.rag,
  async (job: Job<RagJobData>) => {
    console.log(`[RAG Worker] Picked up job #${job.id}: ${job.name}`);

    switch (job.data.kind) {
      case 'install':
        await handleInstall(job.data);
        return;
      case 'manual':
        await handleManual(job.data);
        return;
      case 'push':
        await handlePush(job.data);
        return;
      default: {
        // Exhaustiveness guard - a new RagJobData variant added without handling.
        const unhandled: never = job.data;
        throw new Error(`[RAG Worker] Unknown job kind: ${JSON.stringify(unhandled)}`);
      }
    }
  },
  { connection },
);

ragWorker.on('completed', (job) => {
  console.log(`[RAG Worker] Job #${job.id} completed successfully`);
});

ragWorker.on('failed', (job, err) => {
  console.error(`[RAG Worker] Job #${job?.id} failed: ${err.message}`);
});
