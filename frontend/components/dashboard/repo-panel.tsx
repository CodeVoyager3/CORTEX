'use client';

import { useState } from 'react';
import {
  Database, GitBranch, Zap, Plus, CheckCircle2, AlertCircle,
  Loader2, Clock, Trash2, ExternalLink, FolderGit2, Globe, Info,
} from 'lucide-react';
import { type ActivityItem } from './activity-feed';

interface Repo {
  id: string;
  name: string;
  path: string;
  type: 'github' | 'local';
  status: 'indexed' | 'pending' | 'error';
  indexedAt: string;
  filesCount?: number;
}

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

const demoRepos: Repo[] = [
  {
    id: '1',
    name: 'backend-ml',
    path: 'D:\\My Projects\\Engineering Intelligence Hub\\backend-ml',
    type: 'local',
    status: 'indexed',
    indexedAt: '2 hours ago',
    filesCount: 42,
  },
];

export function RepoPanel({ onActivity }: RepoPanelProps) {
  const [repoPath, setRepoPath] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [repos, setRepos] = useState<Repo[]>(demoRepos);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim() || isIngesting) return;

    setIsIngesting(true);
    setIngestStatus({ type: 'info', message: 'Crawling and embedding repository…' });

    const tempId = crypto.randomUUID();
    const tempRepo: Repo = {
      id: tempId,
      name: repoPath.split('/').pop()?.replace('.git', '') ?? repoPath,
      path: repoPath,
      type: repoPath.startsWith('http') ? 'github' : 'local',
      status: 'pending',
      indexedAt: 'just now',
    };
    setRepos((prev) => [tempRepo, ...prev]);
    onActivity({ id: tempId, query: `Ingesting ${tempRepo.name}`, type: 'ingest', time: 'just now' });

    try {
      const response = await fetch('http://localhost:8000/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: repoPath }),
      });
      const data = await response.json();

      if (response.ok) {
        setIngestStatus({ type: 'success', message: data.message ?? 'Repository indexed successfully!' });
        setRepos((prev) => prev.map((r) => r.id === tempId ? { ...r, status: 'indexed', indexedAt: 'just now' } : r));
        setRepoPath('');
      } else {
        setIngestStatus({ type: 'error', message: data.detail ?? 'Ingestion failed.' });
        setRepos((prev) => prev.map((r) => r.id === tempId ? { ...r, status: 'error' } : r));
      }
    } catch {
      setIngestStatus({ type: 'error', message: 'Could not connect to backend (port 8000).' });
      setRepos((prev) => prev.map((r) => r.id === tempId ? { ...r, status: 'error' } : r));
    } finally {
      setIsIngesting(false);
    }
  };

  const removeRepo = (id: string) => {
    setRemovingId(id);
    setTimeout(() => { setRepos((prev) => prev.filter((r) => r.id !== id)); setRemovingId(null); }, 350);
  };

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
          {repos.filter((r) => r.status === 'indexed').length} indexed
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide bg-white dark:bg-neutral-950">
        <div className="grid grid-cols-1 xl:grid-cols-3 min-h-full">

          {/* Left: ingestion form */}
          <div className="xl:border-r border-b xl:border-b-0 border-neutral-100 dark:border-neutral-800/60 px-6 py-6 flex flex-col gap-6 bg-neutral-50/50 dark:bg-neutral-900/20">
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
                Index a Repository
              </h2>
              <form onSubmit={handleIngest} className="flex flex-col gap-3">
                <div>
                  <label htmlFor="repo-path" className="text-neutral-500 dark:text-neutral-400 text-xs font-medium block mb-1.5">
                    Repository URL or local path
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
                'Paste a GitHub URL or a local absolute path',
                'Ingestion crawls files, builds embeddings, and creates a knowledge graph',
                'Once indexed, use Copilot Chat to query the repo',
                'Re-index any time to pick up new changes',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-neutral-400 dark:text-neutral-500 text-xs">
                  <span className="text-orange-500 mt-0.5 flex-shrink-0">›</span>
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

            {repos.length === 0 ? (
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
                  const cfg = statusConfig[repo.status];
                  const StatusIcon = cfg.icon;
                  const TypeIcon = repo.type === 'github' ? Globe : FolderGit2;

                  return (
                    <div
                      key={repo.id}
                      className={`group relative flex items-start gap-4 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800/60 bg-white dark:bg-neutral-900/40 hover:border-neutral-200 dark:hover:border-neutral-700 hover:shadow-sm transition-all duration-300 ${
                        removingId === repo.id ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
                        <TypeIcon className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-neutral-800 dark:text-neutral-200 font-semibold text-sm">{repo.name}</h3>
                          <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                            <StatusIcon className={`w-3 h-3 ${repo.status === 'pending' ? 'animate-spin' : ''}`} />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-neutral-400 dark:text-neutral-500 text-xs font-mono mt-1 truncate">{repo.path}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1 text-neutral-400 dark:text-neutral-500 text-[11px]">
                            <Clock className="w-3 h-3" />
                            <span>{repo.indexedAt}</span>
                          </div>
                          {repo.filesCount && (
                            <div className="flex items-center gap-1 text-neutral-400 dark:text-neutral-500 text-[11px]">
                              <GitBranch className="w-3 h-3" />
                              <span>{repo.filesCount} files</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {repo.type === 'github' && (
                          <a
                            href={repo.path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-300 dark:text-neutral-600 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => removeRepo(repo.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
