import type { ChangedFileRef, RagJobData, ReviewJobData } from '../../package/queue';

/**
 * Pure normalization of raw GitHub webhook payloads into the typed job contract
 * (`RagJobData` / `ReviewJobData`) shared with the worker-service.
 *
 * Keeping these side-effect free and separate from the route handler makes the
 * GitHub-specific parsing easy to unit test and ensures workers never have to
 * know the shape of GitHub's payloads — only our normalized jobs.
 */

interface GitHubRepoRef {
  name?: string;
  full_name?: string;
  owner?: { login?: string };
}

interface GitHubPushPayload {
  ref?: string;
  after?: string;
  repository?: GitHubRepoRef;
  installation?: { id?: number };
  commits?: Array<{ added?: string[]; modified?: string[]; removed?: string[] }>;
}

interface GitHubPullRequestPayload {
  action?: string;
  number?: number;
  pull_request?: { number?: number };
  repository?: GitHubRepoRef;
  installation?: { id?: number };
}

interface GitHubInstallationPayload {
  action?: string;
  installation?: { id?: number; account?: { login?: string } };
  repositories?: GitHubRepoRef[];
  repositories_added?: GitHubRepoRef[];
  repositories_removed?: GitHubRepoRef[];
}

/** Splits "owner/repo" full_name, falling back to the nested owner.login. */
export function resolveRepo(repo: GitHubRepoRef | undefined): { owner: string; repo: string } | null {
  if (!repo) return null;
  if (repo.full_name && repo.full_name.includes('/')) {
    const [owner, name] = repo.full_name.split('/');
    if (owner && name) return { owner, repo: name };
  }
  const owner = repo.owner?.login;
  const name = repo.name;
  if (owner && name) return { owner, repo: name };
  return null;
}

/**
 * Normalizes a `push` event into an install/push RAG job.
 * Returns null when the payload is missing the fields we require.
 */
export function normalizePush(payload: GitHubPushPayload): RagJobData | null {
  const resolved = resolveRepo(payload.repository);
  if (!resolved) return null;

  const headSha = payload.after;
  if (!headSha) return null;

  const installationId = payload.installation?.id;
  const changedFiles = collectChangedFiles(payload.commits);

  return {
    kind: 'push',
    ...(installationId !== undefined ? { installationId } : {}),
    owner: resolved.owner,
    repo: resolved.repo,
    headSha,
    changedFiles,
  };
}

/** Collapses per-commit added/modified/removed lists into a de-duplicated file set. */
export function collectChangedFiles(
  commits: GitHubPushPayload['commits'],
): ChangedFileRef[] {
  const byPath = new Map<string, ChangedFileRef['status']>();
  const rank: Record<ChangedFileRef['status'], number> = {
    removed: 0,
    added: 1,
    modified: 2,
  };

  for (const commit of commits ?? []) {
    for (const path of commit.added ?? []) upsertStatus(byPath, path, 'added', rank);
    for (const path of commit.modified ?? []) upsertStatus(byPath, path, 'modified', rank);
    for (const path of commit.removed ?? []) upsertStatus(byPath, path, 'removed', rank);
  }

  return [...byPath.entries()].map(([path, status]) => ({ path, status }));
}

function upsertStatus(
  byPath: Map<string, ChangedFileRef['status']>,
  path: string,
  status: ChangedFileRef['status'],
  rank: Record<ChangedFileRef['status'], number>,
): void {
  const existing = byPath.get(path);
  if (existing === undefined || rank[status] > rank[existing]) {
    byPath.set(path, status);
  }
}

const REVIEWABLE_PR_ACTIONS = new Set(['opened', 'synchronize', 'reopened']);

/**
 * Normalizes a `pull_request` event into a review job.
 * Returns null for non-reviewable actions (edited, closed, labeled, …) or bad payloads.
 */
export function normalizePullRequest(payload: GitHubPullRequestPayload): ReviewJobData | null {
  if (!REVIEWABLE_PR_ACTIONS.has(payload.action ?? '')) return null;

  const resolved = resolveRepo(payload.repository);
  const prNumber = payload.number ?? payload.pull_request?.number;
  if (!resolved || prNumber === undefined) return null;

  const installationId = payload.installation?.id;

  return {
    ...(installationId !== undefined ? { installationId } : {}),
    owner: resolved.owner,
    repo: resolved.repo,
    prNumber,
  };
}

export interface InstallationEvent {
  action: string;
  installationId: number;
  owner: string;
  /** Repositories to (re)index; empty for `deleted`. */
  repositories: Array<{ owner: string; repo: string }>;
}

/**
 * Normalizes `installation` and `installation_repositories` events into a single
 * shape the route handler can act on. Returns null for payloads we can't resolve.
 */
export function normalizeInstallation(payload: GitHubInstallationPayload): InstallationEvent | null {
  const installationId = payload.installation?.id;
  if (installationId === undefined) return null;

  const action = payload.action ?? '';
  const owner = payload.installation?.account?.login ?? '';

  const source =
    action === 'added'
      ? payload.repositories_added
      : action === 'removed'
        ? payload.repositories_removed
        : payload.repositories;

  const repositories = (source ?? [])
    .map(resolveRepo)
    .filter((r): r is { owner: string; repo: string } => r !== null);

  return { action, installationId, owner, repositories };
}
