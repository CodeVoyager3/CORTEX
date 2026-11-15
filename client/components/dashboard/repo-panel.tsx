'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database, GitBranch, Zap, Plus, CheckCircle2, AlertCircle,
  Loader2, Clock, Trash2, ExternalLink, Info, Globe,
  ChevronDown, ChevronRight, GitPullRequest,
} from 'lucide-react';
import { FaGithub } from 'react-icons/fa';
import { type ActivityItem } from './activity-feed';
import {
  type ApiRepo,
  type RepoDetail,
  indexRepo,
  getJob,
  listRepos,
  getRepo,
  deleteRepo,
  triggerReview,
  getInstall,
} from '@/lib/api';

type RepoStatus = 'indexed' | 'pending' | 'error';

interface RepoPanelProps {
  onActivity: (item: ActivityItem) => void;
}

const statusConfig = {
  indexed: {
    label: 'Indexed',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/20',
  },
  pending: {
    label: 'Processing',
    icon: Loader2,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    color: 'text-red-500 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/20',
  },
};

const reviewStatusCls: Record<string, string> = {
  completed: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  failed: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
  pending: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
};

const severityCls: Record<string, string> = {
  critical: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
  high: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
  medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  low: 'text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-700',
};

const githubUrl = (repo: ApiRepo) => `https://github.com/${repo.owner}/${repo.name}`;
const repoKey = (repo: ApiRepo) => `${repo.owner}/${repo.name}`;

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function RepoPanel({ onActivity }: RepoPanelProps) {
  // Repository list
  const [repos, setRepos] = useState<ApiRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Index form + job tracking
  const [repoPath, setRepoPath] = useState('');
  const [indexJob, setIndexJob] = useState<{ jobId: string; repoFullName: string } | null>(null);
  const [indexState, setIndexState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [indexMessage, setIndexMessage] = useState('');
  const [sessionFailed, setSessionFailed] = useState<Record<string, true>>({});
  const [installUrl, setInstallUrl] = useState<string | null>(null);

  useEffect(() => {
    getInstall().then((res) => {
      if (res.configured && res.installUrl) {
        setInstallUrl(res.installUrl);
      }
    }).catch(() => {});
  }, []);

  // Expanded repo detail + PR review flow
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RepoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [prNumber, setPrNumber] = useState('');
  const [reviewJob, setReviewJob] = useState<{ jobId: string; repoId: string; prNumber: number } | null>(null);
  const [reviewState, setReviewState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [reviewMessage, setReviewMessage] = useState('');

  const isIngesting = indexState === 'running';

  const loadRepos = useCallback(async () => {
    try {
      setListError(null);
      const data = await listRepos();
      setRepos(data);
    } catch (err) {
      setListError(err instanceof TypeError
        ? 'Could not reach the backend (port 3001). Is the API service running?'
        : err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    void loadRepos();
  }, [loadRepos]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      setDetail(await getRepo(id));
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const resetReviewForm = () => {
    setPrNumber('');
    setReviewJob(null);
    setReviewState('idle');
    setReviewMessage('');
  };

  // -------------------------------------------------------------------------
  // Index a repository
  // -------------------------------------------------------------------------
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = repoPath.trim();
    if (!value || isIngesting) return;

    setIndexState('running');
    setIndexMessage('Queuing repository index…');

    try {
      const res = await indexRepo(value);
      const fullName = `${res.repository.owner}/${res.repository.name}`;
      setIndexJob({ jobId: res.jobId, repoFullName: fullName });
      setIndexMessage(`Indexing ${fullName} — crawling, parsing and embedding files.`);
      onActivity({ id: res.jobId, query: `Ingesting ${fullName}`, type: 'ingest', time: 'just now' });
      void loadRepos();
    } catch (err) {
      setIndexState('error');
      setIndexMessage(err instanceof TypeError
        ? 'Could not reach the backend (port 3001). Is the API service running?'
        : err instanceof Error ? err.message : 'Ingestion failed.');
    }
  };

  useEffect(() => {
    if (!indexJob || indexState !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const job = await getJob('rag', indexJob.jobId);
        if (job.state === 'completed') {
          setIndexState('success');
          setIndexMessage('Repository indexed successfully!');
          setSessionFailed((prev) => {
            const next = { ...prev };
            delete next[indexJob.repoFullName];
            return next;
          });
          setIndexJob(null);
          setRepoPath('');
          onActivity({ id: Date.now().toString(), query: `Indexed ${indexJob.repoFullName}`, type: 'ingest', time: 'just now' });
          void loadRepos();
        } else if (job.state === 'failed') {
          setIndexState('error');
          setIndexMessage(job.failedReason ?? 'Ingestion failed.');
          setSessionFailed((prev) => ({ ...prev, [indexJob.repoFullName]: true }));
          setIndexJob(null);
          void loadRepos();
        } else {
          setIndexMessage('Crawling, parsing and embedding files…');
        }
      } catch {
        // Transient network/ Redis blip — keep polling.
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [indexJob, indexState, loadRepos, onActivity]);

  const handleReset = () => {
    setIndexState('idle');
    setIndexMessage('');
    setIndexJob(null);
  };

  // -------------------------------------------------------------------------
  // Delete / expand
  // -------------------------------------------------------------------------
  const removeRepo = async (repo: ApiRepo) => {
    setRemovingId(repo.id);
    try {
      await deleteRepo(repo.id);
      setTimeout(() => {
        setRepos((prev) => prev.filter((r) => r.id !== repo.id));
        if (expandedId === repo.id) {
          setExpandedId(null);
          setDetail(null);
        }
        setRemovingId(null);
      }, 350);
    } catch (err) {
      setRemovingId(null);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete repository');
    }
  };

  const toggleExpand = (repo: ApiRepo) => {
    if (expandedId === repo.id) {
      setExpandedId(null);
      setDetail(null);
      setExpandedReviewId(null);
      resetReviewForm();
      return;
    }
    setExpandedId(repo.id);
    setDetail(null);
    setExpandedReviewId(null);
    resetReviewForm();
    void loadDetail(repo.id);
  };

  // -------------------------------------------------------------------------
  // Trigger a PR review
  // -------------------------------------------------------------------------
  const handleReview = async (repo: ApiRepo, e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(prNumber);
    if (!Number.isInteger(n) || n <= 0 || reviewState === 'running') return;

    setReviewState('running');
    setReviewMessage(`Fetching diff and reviewing PR #${n}…`);

    try {
      const res = await triggerReview(repo.owner, repo.name, n);
      setReviewJob({ jobId: res.jobId, repoId: repo.id, prNumber: n });
    } catch (err) {
      setReviewState('error');
      setReviewMessage(err instanceof TypeError
        ? 'Could not reach the backend (port 3001). Is the API service running?'
        : err instanceof Error ? err.message : 'Failed to queue review.');
    }
  };

  useEffect(() => {
    if (!reviewJob || reviewState !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const job = await getJob('review', reviewJob.jobId);
        if (job.state === 'completed') {
          setReviewState('success');
          setReviewMessage(`Review for PR #${reviewJob.prNumber} completed — see results below.`);
          if (expandedId === reviewJob.repoId) void loadDetail(reviewJob.repoId);
          void loadRepos();
          setReviewJob(null);
        } else if (job.state === 'failed') {
          setReviewState('error');
          setReviewMessage(job.failedReason ?? 'Review failed.');
          setReviewJob(null);
        } else {
          setReviewMessage(`Reviewing PR #${reviewJob.prNumber} — blast radius + LLM analysis running…`);
        }
      } catch {
        // Transient network/ Redis blip — keep polling.
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [reviewJob, reviewState, expandedId, loadDetail, loadRepos]);

  // -------------------------------------------------------------------------
  // Derived UI state
  // -------------------------------------------------------------------------
  const statusFor = (repo: ApiRepo): RepoStatus => {
    if (sessionFailed[repoKey(repo)]) return 'error';
    return repo.lastIndexedSha ? 'indexed' : 'pending';
  };

  const ingestStatus: { type: 'success' | 'error' | 'info'; message: string } | null =
    indexState === 'idle' ? null
    : indexState === 'running' ? { type: 'info', message: indexMessage }
    : indexState === 'success' ? { type: 'success', message: indexMessage }
    : { type: 'error', message: indexMessage };

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-7 py-4 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center gap-3 shrink-0 bg-white dark:bg-neutral-950">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center">
          <Database className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">Repositories</h1>
          <p className="text-neutral-400 dark:text-neutral-500 text-xs">Index and manage your codebase repositories</p>
        </div>
        <div className="ml-auto text-neutral-400 dark:text-neutral-500 text-xs border border-neutral-200 dark:border-neutral-700 px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900">
          {repos.filter((r) => r.lastIndexedSha).length} indexed
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide bg-white dark:bg-neutral-950">
        <div className="grid grid-cols-1 xl:grid-cols-3 min-h-full">

          {/* Left: ingestion form */}
          <div className="xl:border-r border-b xl:border-b-0 border-neutral-100 dark:border-neutral-800/60 px-6 py-6 flex flex-col gap-6 bg-neutral-50/50 dark:bg-neutral-900/20">
            {/* GitHub App Installation Banner */}
            {installUrl && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white dark:from-neutral-900/90 dark:to-neutral-950/80 border border-neutral-700/60 dark:border-neutral-800 shadow-md">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 flex-shrink-0 mt-0.5">
                    <FaGithub className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs font-bold text-white tracking-tight">Connect GitHub App</h3>
                      <span className="text-[10px] bg-orange-500/30 text-orange-300 font-semibold px-1.5 py-0.2 rounded border border-orange-500/40">Recommended</span>
                    </div>
                    <p className="text-[11px] text-neutral-300 dark:text-neutral-400 mt-1 leading-relaxed">
                      Install CORTEX on your repositories to enable automated PR reviews and blast radius analysis on every commit.
                    </p>
                    <a
                      href={installUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
                    >
                      <FaGithub className="w-3.5 h-3.5" />
                      Install on GitHub
                      <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
                Index a Repository
              </h2>
              <form onSubmit={handleIngest} className="flex flex-col gap-3">
                <div>
                  <label htmlFor="repo-path" className="text-neutral-500 dark:text-neutral-400 text-xs font-medium block mb-1.5">
                    GitHub repository URL or owner/repo
                  </label>
                  <input
                    id="repo-path"
                    type="text"
                    placeholder="https://github.com/user/repo"
                    value={repoPath}
                    onChange={(e) => setRepoPath(e.target.value)}
                    disabled={isIngesting}
                    className="w-full px-3 py-2.5 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 focus:border-orange-300 dark:focus:border-orange-500/50 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-500/10 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 text-sm outline-none transition-all font-mono disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  id="ingest-btn"
                  disabled={isIngesting || !repoPath.trim()}
                  className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 text-white w-full shadow-sm"
                >
                  {isIngesting
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                    : <><Zap className="w-4 h-4" />Index Repository</>
                  }
                </button>
              </form>

              {/* Dismiss button shown once ingestion finishes */}
              {(indexState === 'success' || indexState === 'error') && (
                <button
                  onClick={handleReset}
                  className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                >
                  Dismiss
                </button>
              )}

              {ingestStatus && (
                <div className={`mt-3 flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs border animate-fade-in ${
                  ingestStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                    : ingestStatus.type === 'error'
                    ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
                    : 'bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                }`}>
                  {ingestStatus.type === 'success'
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : ingestStatus.type === 'error'
                    ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <Loader2 className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" />
                  }
                  <span className="leading-relaxed">{ingestStatus.message}</span>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Quick Tips
              </p>
              {[
                'Paste a GitHub URL or owner/repo (e.g. torvalds/linux)',
                'Indexing downloads the repo, builds AST chunks and embeddings',
                'Once indexed, use Copilot Chat to query the repo',
                'Re-index any time to pick up new changes',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-neutral-400 dark:text-neutral-500 text-xs">
                  <span className="text-orange-500 mt-0.5 flex-shrink-0">•</span>
                  {tip}
                </div>
              ))}
            </div>

            <div className="flex gap-2.5 p-3 rounded-xl bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/15 mt-auto">
              <Info className="w-4 h-4 text-orange-500 dark:text-orange-400/60 flex-shrink-0 mt-0.5" />
              <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
                GraphRAG builds a rich knowledge graph from your code — functions, classes, imports, call chains, and semantic clusters.
              </p>
            </div>
          </div>

          {/* Right: repo list */}
          <div className="xl:col-span-2 px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Indexed Repositories
              </h2>
              <span className="text-neutral-400 dark:text-neutral-500 text-xs">{repos.length} total</span>
            </div>

            {listError && (
              <div className="mb-4 flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs border bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{listError}</span>
              </div>
            )}

            {deleteError && (
              <div
                onClick={() => setDeleteError(null)}
                title="Dismiss"
                className="mb-4 flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs border cursor-pointer bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{deleteError} (click to dismiss)</span>
              </div>
            )}

            {loadingRepos ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 text-neutral-300 dark:text-neutral-600 animate-spin" />
                <p className="text-neutral-400 dark:text-neutral-500 text-sm">Loading repositories…</p>
              </div>
            ) : repos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center">
                  <Database className="w-7 h-7 text-emerald-300 dark:text-emerald-500/40" />
                </div>
                <p className="text-neutral-400 dark:text-neutral-500 text-sm">No repositories indexed yet</p>
                <p className="text-neutral-300 dark:text-neutral-600 text-xs">Use the form on the left to add your first repo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {repos.map((repo) => {
                  const status = statusFor(repo);
                  const cfg = statusConfig[status];
                  const StatusIcon = cfg.icon;
                  const expanded = expandedId === repo.id;

                  return (
                    <div
                      key={repo.id}
                      onClick={() => toggleExpand(repo)}
                      className={`group relative rounded-xl border border-neutral-100 dark:border-neutral-800/60 bg-white dark:bg-neutral-900/40 hover:border-neutral-200 dark:hover:border-neutral-700 hover:shadow-sm transition-all duration-300 cursor-pointer ${
                        removingId === repo.id ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                      }`}
                    >
                      <div className="flex items-start gap-4 p-4">
                        <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
                          <Globe className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-neutral-800 dark:text-neutral-200 font-semibold text-sm">{repo.owner}/{repo.name}</h3>
                            <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                              <StatusIcon className={`w-3 h-3 ${status === 'pending' ? 'animate-spin' : ''}`} />
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-neutral-400 dark:text-neutral-500 text-xs font-mono mt-1 truncate">{githubUrl(repo)}</p>
                          <div className="flex items-center gap-4 mt-2 flex-wrap">
                            <div className="flex items-center gap-1 text-neutral-400 dark:text-neutral-500 text-[11px]">
                              <Clock className="w-3 h-3" />
                              <span>{repo.lastIndexedSha ? `sha ${repo.lastIndexedSha.slice(0, 7)}` : 'Not indexed yet'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-neutral-400 dark:text-neutral-500 text-[11px]">
                              <GitBranch className="w-3 h-3" />
                              <span>{repo.fileCount} files · {repo.chunkCount} chunks</span>
                            </div>
                            <div className="flex items-center gap-1 text-neutral-400 dark:text-neutral-500 text-[11px]">
                              <GitPullRequest className="w-3 h-3" />
                              <span>{repo.reviewCount} reviews</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpand(repo); }}
                            title={expanded ? 'Collapse' : 'Details & PR review'}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-300 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                          >
                            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={githubUrl(repo)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-300 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); void removeRepo(repo); }}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded: review trigger + review history */}
                      {expanded && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="px-4 pb-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 animate-fade-in cursor-default"
                        >
                          {detailLoading ? (
                            <div className="flex items-center gap-2 py-3 text-neutral-400 dark:text-neutral-500 text-xs">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Loading repository details…
                            </div>
                          ) : detail ? (
                            <>
                              {/* PR review trigger */}
                              <form onSubmit={(e) => handleReview(repo, e)} className="flex flex-wrap items-center gap-2 mb-4">
                                <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500">
                                  <GitPullRequest className="w-3.5 h-3.5" />
                                  <span className="text-[11px] font-semibold uppercase tracking-wider">Review a PR</span>
                                </div>
                                <input
                                  type="number"
                                  min={1}
                                  placeholder="PR #"
                                  value={prNumber}
                                  onChange={(e) => setPrNumber(e.target.value)}
                                  disabled={reviewState === 'running'}
                                  className="w-24 px-2.5 py-1.5 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 focus:border-orange-300 dark:focus:border-orange-500/50 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-500/10 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 text-xs outline-none transition-all font-mono disabled:opacity-50"
                                />
                                <button
                                  type="submit"
                                  disabled={reviewState === 'running' || !prNumber.trim()}
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors shadow-sm"
                                >
                                  {reviewState === 'running'
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <GitPullRequest className="w-3.5 h-3.5" />}
                                  Run review
                                </button>
                                {reviewMessage && (
                                  <div className={`w-full flex items-start gap-2 px-3 py-2 rounded-lg text-xs border animate-fade-in ${
                                    reviewState === 'success'
                                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                      : reviewState === 'error'
                                      ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
                                      : 'bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                                  }`}>
                                    {reviewState === 'success'
                                      ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                      : reviewState === 'error'
                                      ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                      : <Loader2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 animate-spin" />
                                    }
                                    <span className="leading-relaxed">{reviewMessage}</span>
                                  </div>
                                )}
                              </form>

                              {/* Reviews list */}
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                                Recent Reviews
                              </p>
                              {detail.reviews.length === 0 ? (
                                <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/60 text-neutral-400 dark:text-neutral-500 text-xs">
                                  <Info className="w-3.5 h-3.5 flex-shrink-0" />
                                  No reviews yet — run one on any open PR of this repository.
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {detail.reviews.map((review) => (
                                    <div key={review.id} className="rounded-lg border border-neutral-100 dark:border-neutral-800/60 overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedReviewId(expandedReviewId === review.id ? null : review.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-neutral-900/40 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors text-left"
                                      >
                                        <GitPullRequest className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                                        <span className="text-neutral-700 dark:text-neutral-300 text-xs font-medium">PR #{review.prNumber}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${reviewStatusCls[review.status] ?? reviewStatusCls.pending}`}>
                                          {review.status}
                                        </span>
                                        <span className="text-neutral-400 dark:text-neutral-500 text-[11px] ml-auto">
                                          {review.issues.length} issue{review.issues.length === 1 ? '' : 's'}
                                        </span>
                                        <span className="text-neutral-300 dark:text-neutral-600 text-[11px]">·</span>
                                        <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">{formatReviewDate(review.createdAt)}</span>
                                        {expandedReviewId === review.id
                                          ? <ChevronDown className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
                                          : <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />}
                                      </button>
                                      {expandedReviewId === review.id && (
                                        <div className="px-3 py-2.5 border-t border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-800/20 space-y-1.5 animate-fade-in">
                                          {review.issues.length === 0 ? (
                                            <p className="text-neutral-400 dark:text-neutral-500 text-xs">No issues recorded for this review.</p>
                                          ) : (
                                            review.issues.map((issue) => (
                                              <div key={issue.id} className="flex items-start gap-2">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold flex-shrink-0 ${severityCls[issue.severity] ?? severityCls.low}`}>
                                                  {issue.severity}
                                                </span>
                                                <div className="min-w-0">
                                                  <code className="text-neutral-500 dark:text-neutral-400 text-[11px] font-mono">{issue.filePath}:{issue.lineNumber}</code>
                                                  <p className="text-neutral-600 dark:text-neutral-300 text-xs leading-relaxed">{issue.description}</p>
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Sample of indexed symbols */}
                              {detail.repo.chunks.length > 0 && (
                                <div className="mt-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                                    Indexed Symbols (sample)
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {detail.repo.chunks.map((chunk) => (
                                      <span
                                        key={chunk.id}
                                        title={chunk.filePath}
                                        className="px-2 py-1 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/60 text-neutral-500 dark:text-neutral-400 text-[11px] font-mono"
                                      >
                                        {chunk.symbolName} <span className="text-neutral-300 dark:text-neutral-600">· {chunk.nodeType}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-2 py-3 text-neutral-400 dark:text-neutral-500 text-xs">
                              <AlertCircle className="w-3.5 h-3.5" />
                              Could not load repository details. Try again later.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-neutral-200 dark:border-neutral-700 hover:border-orange-300 dark:hover:border-orange-500/30 rounded-xl text-neutral-400 dark:text-neutral-500 hover:text-orange-500 dark:hover:text-orange-400 text-sm transition-all duration-200"
                  onClick={() => document.getElementById('repo-path')?.focus()}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add another repository</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
