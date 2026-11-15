/**
 * Typed client for the CORTEX API service (server/app/api-service, port 3001).
 *
 * The dashboard previously talked to a legacy Python backend on port 8000;
 * everything now goes through this module so the base URL is configurable via
 * NEXT_PUBLIC_API_URL and response shapes live in one place.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface HealthInfo {
  ok: boolean;
  database: boolean;
  redis: boolean;
  pineconeConfigured: boolean;
  groqConfigured: boolean;
  githubConfigured: boolean;
  queues: { rag: QueueCounts | null; review: QueueCounts | null } | null;
}

export interface StatsInfo {
  totalRepos: number;
  totalReviews: number;
  totalIssues: number;
  criticalIssues: number;
  filesIndexed: number;
  chunks: number;
  relationships: number;
  installations: number;
}

export interface ApiRepo {
  id: string;
  owner: string;
  name: string;
  lastIndexedSha: string | null;
  installationId: string | null;
  fileCount: number;
  chunkCount: number;
  reviewCount: number;
}

export interface RepoIssue {
  id: string;
  reviewId: string;
  filePath: string;
  lineNumber: number;
  description: string;
  severity: string;
}

export interface RepoReview {
  id: string;
  repositoryId: string;
  prNumber: number;
  status: string;
  createdAt: string;
  issues: RepoIssue[];
}

export interface SampleChunk {
  id: string;
  filePath: string;
  symbolName: string;
  nodeType: string;
}

export interface RepoDetailRepo {
  id: string;
  owner: string;
  name: string;
  lastIndexedSha: string | null;
  installationId?: string | null;
  chunks: SampleChunk[];
}

export interface RepoDetail {
  repo: RepoDetailRepo;
  reviews: RepoReview[];
}

export interface JobInfo {
  id: string;
  queue: string;
  name: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'prioritized' | string;
  progress: number | object;
  failedReason: string | null;
  returnValue: unknown;
}

export interface ChatResponse {
  answer: string;
  target_entity?: string;
  dependencies?: string[];
}

export interface DependencyMatch {
  repositoryId: string;
  repository: string;
  filePath: string;
  nodeType: string;
}

export interface DependenciesResponse {
  found: boolean;
  target_entity: string;
  matches: DependencyMatch[];
  dependencies: string[];
}

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

function safeJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const data = safeJson(await res.text());

  if (!res.ok) {
    const record = (data ?? {}) as Record<string, unknown>;
    const message =
      (typeof record.error === 'string' && record.error) ||
      (typeof record.detail === 'string' && record.detail) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export interface InstallInfo {
  configured: boolean;
  installUrl: string | null;
}

export const getInstall = () => request<InstallInfo>('/api/install-url');

export const getHealth = () =>
  request<HealthInfo>('/api/health', { signal: AbortSignal.timeout(5000) });

export const getStats = () => request<StatsInfo>('/api/stats');

export const listRepos = () => request<ApiRepo[]>('/api/repos');

export const getRepo = (id: string) => request<RepoDetail>(`/api/repos/${id}`);

export const indexRepo = (repo: string) =>
  request<{ jobId: string; repository: { id: string; owner: string; name: string } }>(
    '/api/repos/index',
    { method: 'POST', body: JSON.stringify({ repo }) },
  );

export const getJob = (queue: 'rag' | 'review', id: string) =>
  request<JobInfo>(`/api/jobs/${queue}/${encodeURIComponent(id)}`);

export const deleteRepo = (id: string) =>
  request<{ ok: boolean; pineconeCleared: boolean }>(`/api/repos/${id}`, { method: 'DELETE' });

export const triggerReview = (owner: string, repo: string, prNumber: number) =>
  request<{ jobId: string }>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify({ owner, repo, prNumber }),
  });

export const chat = (question: string) =>
  request<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify({ question }) });

export const getDependencies = (symbol: string) =>
  request<DependenciesResponse>(`/api/dependencies?symbol=${encodeURIComponent(symbol)}`);
