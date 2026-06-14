'use client';

import { useState } from 'react';
import {
  GitBranch, Search, Network, ChevronRight, ChevronDown,
  Loader2, AlertCircle, Info, Code2,
} from 'lucide-react';
import { type ActivityItem } from './activity-feed';

interface DepNode {
  entity: string;
  dependencies: string[];
}

interface DependencyPanelProps {
  onActivity: (item: ActivityItem) => void;
}

const exampleEntities = [
  'UserModel', 'AuthService', 'DatabaseService',
  'PaymentGateway', 'ApiRouter', 'ConfigManager',
];

export function DependencyPanel({ onActivity }: DependencyPanelProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DepNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<string[]>([]);

  const handleSearch = async (entity?: string) => {
    const target = entity ?? query.trim();
    if (!target || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    onActivity({ id: crypto.randomUUID(), query: `Dependencies of ${target}`, entity: target, type: 'dependency', time: 'just now' });

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `What are the direct dependencies of ${target}? List all modules, functions, classes, or files that ${target} depends on.`,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setResult({
          entity: data.target_entity ?? target,
          dependencies: data.dependencies?.length
            ? data.dependencies
            : extractFromText(data.answer, target),
        });
        setHistory((prev) => [target, ...prev.filter((h) => h !== target)].slice(0, 8));
        if (entity) setQuery(entity);
      } else {
        setError(data.detail ?? 'Failed to fetch dependencies');
      }
    } catch {
      setError('Connection error. Is the backend running on port 8000?');
    } finally {
      setIsLoading(false);
    }
  };

  const extractFromText = (text: string, entity: string): string[] =>
    (text.match(/`([^`]+)`/g) ?? [])
      .map((t) => t.replace(/`/g, ''))
      .filter((t) => t !== entity)
      .slice(0, 12);

  const toggleDep = (dep: string) =>
    setExpandedDeps((prev) => {
      const next = new Set(prev);
      next.has(dep) ? next.delete(dep) : next.add(dep);
      return next;
    });

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-7 py-4 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center gap-3 shrink-0 bg-white dark:bg-neutral-950">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
          <GitBranch className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">Dependency Explorer</h1>
          <p className="text-neutral-400 dark:text-neutral-500 text-xs">Trace relationships across your codebase graph</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide bg-white dark:bg-neutral-950">
        <div className="grid grid-cols-1 xl:grid-cols-3 h-full">

          {/* Left panel */}
          <div className="xl:border-r border-neutral-100 dark:border-neutral-800/60 px-6 py-6 flex flex-col gap-6 bg-neutral-50/50 dark:bg-neutral-900/20">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-2">
                Entity Name
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 dark:text-neutral-600" />
                  <input
                    type="text"
                    placeholder="e.g. UserModel, AuthService…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-700 focus:border-orange-300 dark:focus:border-orange-500/50 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-500/10 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 text-sm outline-none transition-all"
                  />
                </div>
                <button
                  onClick={() => handleSearch()}
                  disabled={isLoading || !query.trim()}
                  className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white transition-colors shrink-0 shadow-sm"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Example chips */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                Common Entities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {exampleEntities.map((e) => (
                  <button
                    key={e}
                    onClick={() => handleSearch(e)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900/60 hover:bg-orange-50 dark:hover:bg-orange-500/10 border border-neutral-200 dark:border-neutral-700 hover:border-orange-200 dark:hover:border-orange-500/30 text-neutral-500 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 text-xs font-mono transition-all"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  Recent Searches
                </p>
                <div className="space-y-0.5">
                  {history.map((h) => (
                    <button
                      key={h}
                      onClick={() => handleSearch(h)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 text-sm transition-colors text-left"
                    >
                      <Code2 className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600" />
                      <span className="font-mono">{h}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2.5 p-3 rounded-xl bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/15 mt-auto">
              <Info className="w-4 h-4 text-orange-500 dark:text-orange-400/60 flex-shrink-0 mt-0.5" />
              <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
                Enter any entity (class, function, module) from your indexed repositories to trace its dependency chain.
              </p>
            </div>
          </div>

          {/* Right panel — results */}
          <div className="xl:col-span-2 px-6 py-6">
            {!result && !isLoading && !error && (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                  <Network className="w-8 h-8 text-indigo-300 dark:text-indigo-500/40" />
                </div>
                <div>
                  <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">Search for an entity</p>
                  <p className="text-neutral-300 dark:text-neutral-600 text-xs mt-1">Results will appear here</p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-orange-200 dark:border-orange-500/30 border-t-orange-500 animate-spin" />
                <p className="text-neutral-400 dark:text-neutral-500 text-sm">Traversing graph…</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-600 dark:text-red-400 text-sm font-medium">Error</p>
                  <p className="text-red-500/70 dark:text-red-400/60 text-xs mt-1">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="animate-fade-in space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/60">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                    <Code2 className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <div>
                    <code className="text-indigo-600 dark:text-indigo-400 font-mono text-lg font-semibold">{result.entity}</code>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-0.5">
                      {result.dependencies.length} direct dependenc{result.dependencies.length === 1 ? 'y' : 'ies'} found
                    </p>
                  </div>
                  <div className="ml-auto px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-semibold">
                    {result.dependencies.length} deps
                  </div>
                </div>

                {result.dependencies.length === 0 ? (
                  <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/60 text-neutral-400 dark:text-neutral-500 text-sm">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    No direct dependencies found. This entity may be a leaf node.
                  </div>
                ) : (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
                      Dependency Chain
                    </p>
                    <div className="space-y-1.5">
                      {result.dependencies.map((dep, i) => {
                        const expanded = expandedDeps.has(dep);
                        return (
                          <div key={i} className="rounded-xl overflow-hidden border border-neutral-100 dark:border-neutral-800/60">
                            <button
                              onClick={() => toggleDep(dep)}
                              className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-900/40 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors text-left group"
                            >
                              <span className="text-neutral-300 dark:text-neutral-600 font-mono text-xs w-5 text-right">{i + 1}</span>
                              <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <GitBranch className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                              </div>
                              <code className="text-neutral-700 dark:text-neutral-300 font-mono text-sm group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors flex-1 truncate">
                                {dep}
                              </code>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSearch(dep); }}
                                className="opacity-0 group-hover:opacity-100 text-neutral-400 dark:text-neutral-500 hover:text-orange-500 dark:hover:text-orange-400 text-xs transition-all px-2 py-0.5 rounded-md hover:bg-orange-50 dark:hover:bg-orange-500/10 shrink-0"
                              >
                                Explore →
                              </button>
                              {expanded
                                ? <ChevronDown className="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
                              }
                            </button>
                            {expanded && (
                              <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/20 border-t border-neutral-100 dark:border-neutral-800/40 animate-fade-in">
                                <p className="text-neutral-400 dark:text-neutral-500 text-xs">
                                  Click <span className="text-orange-500 dark:text-orange-400">Explore →</span> to trace dependencies of{' '}
                                  <code className="font-mono text-neutral-600 dark:text-neutral-400">{dep}</code>
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
