'use client';

import { useState, useEffect } from 'react';
import {
  GitBranch, Search, Network, ChevronRight, ChevronDown,
  Loader2, AlertCircle, Info, Code2, ArrowRight, LayoutGrid, ListTree, RefreshCw
} from 'lucide-react';
import { type ActivityItem } from './activity-feed';
import { getDependencies, getDependencySymbols, type DependencyMatch } from '@/lib/api';

interface DepNode {
  entity: string;
  dependencies: string[];
  matches?: DependencyMatch[];
  found: boolean;
}

interface DependencyPanelProps {
  onActivity: (item: ActivityItem) => void;
}

const DEFAULT_FALLBACK_SYMBOLS = [
  'getProjects',
  'AdminDashboard',
  'GitHubProjectsPage',
  'RepoRow',
  'AdminLayoutClient',
  'AdminLayout',
  'PATCH',
  'POST',
  'GET',
];

export function DependencyPanel({ onActivity }: DependencyPanelProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DepNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDeps, setExpandedDeps] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>(DEFAULT_FALLBACK_SYMBOLS);
  const [viewMode, setViewMode] = useState<'graph' | 'tree'>('graph');
  const [hoveredDep, setHoveredDep] = useState<string | null>(null);

  // Load indexed symbols dynamically from repositories
  useEffect(() => {
    let isMounted = true;
    getDependencySymbols()
      .then((res) => {
        if (isMounted && res.symbols && res.symbols.length > 0) {
          const names = res.symbols.map((s) => s.name);
          setAvailableEntities(Array.from(new Set([...names, ...DEFAULT_FALLBACK_SYMBOLS])));
        }
      })
      .catch(() => {
        // Keeps fallback symbols
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = async (entity?: string) => {
    const target = entity ?? query.trim();
    if (!target || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    onActivity({
      id: crypto.randomUUID(),
      query: `Dependencies of ${target}`,
      entity: target,
      type: 'dependency',
      time: 'just now',
    });

    try {
      const data = await getDependencies(target);
      setResult({
        entity: data.target_entity ?? target,
        dependencies: data.found ? data.dependencies ?? [] : [],
        matches: data.matches ?? [],
        found: data.found ?? false,
      });
      setHistory((prev) => [target, ...prev.filter((h) => h !== target)].slice(0, 8));
      if (entity) setQuery(entity);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Could not reach the backend. Please verify Render service is online.'
          : err instanceof Error
          ? err.message
          : 'Failed to fetch dependencies',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDep = (dep: string) =>
    setExpandedDeps((prev) => {
      const next = new Set(prev);
      next.has(dep) ? next.delete(dep) : next.add(dep);
      return next;
    });

  // Calculate layout coordinates for SVG Graph
  const depCount = result?.dependencies.length ?? 0;
  const rowHeight = 72;
  const graphHeight = Math.max(340, 80 + depCount * rowHeight);
  const rootY = depCount > 0 ? (graphHeight / 2) : 170;
  const rootX = 140;
  const targetX = 420;

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-7 py-4 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between shrink-0 bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Dependency Explorer
            </h1>
            <p className="text-neutral-400 dark:text-neutral-500 text-xs">
              Interactive AST graph & call relationship visualizer
            </p>
          </div>
        </div>

        {/* View toggle when results exist */}
        {result && result.dependencies.length > 0 && (
          <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'graph'
                  ? 'bg-white dark:bg-neutral-800 text-orange-500 dark:text-orange-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Interactive Graph
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-neutral-800 text-orange-500 dark:text-orange-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <ListTree className="w-3.5 h-3.5" />
              List View
            </button>
          </div>
        )}
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
                    placeholder="e.g. getProjects, AdminDashboard…"
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

            {/* Indexed entities chips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Indexed Symbols
                </p>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {availableEntities.length} available
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto scrollbar-hide">
                {availableEntities.map((e) => (
                  <button
                    key={e}
                    onClick={() => handleSearch(e)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900/60 hover:bg-orange-50 dark:hover:bg-orange-500/10 border border-neutral-200 dark:border-neutral-700 hover:border-orange-200 dark:hover:border-orange-500/30 text-neutral-600 dark:text-neutral-300 hover:text-orange-600 dark:hover:text-orange-400 text-xs font-mono transition-all flex items-center gap-1.5"
                  >
                    <span>{e}</span>
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
                      <span className="font-mono text-xs truncate">{h}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2.5 p-3 rounded-xl bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/15 mt-auto">
              <Info className="w-4 h-4 text-orange-500 dark:text-orange-400/60 flex-shrink-0 mt-0.5" />
              <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
                Click any symbol or dependency node to interactively traverse your AST call graph and blast radius.
              </p>
            </div>
          </div>

          {/* Right panel — results & visual graph */}
          <div className="xl:col-span-2 px-6 py-6 flex flex-col">
            {!result && !isLoading && !error && (
              <div className="h-full min-h-[380px] flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 flex items-center justify-center shadow-sm">
                  <Network className="w-8 h-8 text-orange-400 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-neutral-800 dark:text-neutral-200 text-sm font-semibold">
                    Explore Codebase Dependencies
                  </p>
                  <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-1 max-w-sm">
                    Select any indexed symbol from the left or search above to generate an interactive dependency graph.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 max-w-md mt-2">
                  {DEFAULT_FALLBACK_SYMBOLS.slice(0, 4).map((sym) => (
                    <button
                      key={sym}
                      onClick={() => handleSearch(sym)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 hover:bg-orange-500/10 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500/30 text-xs font-mono text-neutral-600 dark:text-neutral-300 transition-colors"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="h-full min-h-[380px] flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-orange-200 dark:border-orange-500/30 border-t-orange-500 animate-spin" />
                <p className="text-neutral-400 dark:text-neutral-500 text-sm font-medium">
                  Traversing AST knowledge graph…
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-600 dark:text-red-400 text-sm font-medium">Query Error</p>
                  <p className="text-red-500/70 dark:text-red-400/60 text-xs mt-1">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="animate-fade-in space-y-6 flex-1 flex flex-col">
                {/* Result metadata header */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/60 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <Code2 className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-orange-600 dark:text-orange-400 font-mono text-base font-bold">
                        {result.entity}
                      </code>
                      {result.matches && result.matches[0] && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono">
                          {result.matches[0].nodeType}
                        </span>
                      )}
                    </div>
                    <p className="text-neutral-400 dark:text-neutral-500 text-xs mt-0.5 truncate">
                      {result.matches && result.matches[0]
                        ? `${result.matches[0].repository} · ${result.matches[0].filePath}`
                        : result.found
                        ? `${result.dependencies.length} direct dependencies mapped`
                        : 'Not found in currently indexed repository'}
                    </p>
                  </div>
                  <div className="ml-auto px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-semibold shrink-0">
                    {result.dependencies.length} deps
                  </div>
                </div>

                {/* Empty / Not Found States */}
                {!result.found ? (
                  <div className="p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-200/80 dark:border-neutral-800 space-y-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          Entity &ldquo;{result.entity}&rdquo; not found in indexed repositories
                        </h3>
                        <p className="text-neutral-400 text-xs mt-1 leading-relaxed">
                          The repository currently indexed is a Next.js web application (e.g.,{' '}
                          <code className="text-orange-500">CodeVoyager3/portfolio</code>). Symbols like generic{' '}
                          <code className="text-neutral-400">UserModel</code> or{' '}
                          <code className="text-neutral-400">PaymentGateway</code> are placeholders and do not exist
                          in this codebase.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800">
                      <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                        Try exploring real symbols from your repository:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_FALLBACK_SYMBOLS.slice(0, 6).map((sym) => (
                          <button
                            key={sym}
                            onClick={() => handleSearch(sym)}
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-800 hover:bg-orange-500/10 border border-neutral-200 dark:border-neutral-700 hover:border-orange-500/40 text-xs font-mono text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <span>{sym}</span>
                            <ArrowRight className="w-3 h-3 text-orange-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : result.dependencies.length === 0 ? (
                  <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800/60 text-neutral-400 dark:text-neutral-500 text-sm">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    No direct outgoing dependencies found. This entity is a leaf node in the call graph.
                  </div>
                ) : viewMode === 'graph' ? (
                  /* VISUAL GRAPH CANVAS */
                  <div className="flex-1 min-h-[380px] rounded-2xl bg-neutral-950 border border-neutral-800 relative overflow-x-auto overflow-y-hidden shadow-inner flex flex-col">
                    {/* Graph Canvas Grid & SVG Lines */}
                    <div
                      className="relative w-full min-w-[620px]"
                      style={{ height: `${graphHeight}px` }}
                    >
                      {/* SVG Canvas for bezier curves */}
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ height: `${graphHeight}px` }}
                      >
                        <defs>
                          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f97316" stopOpacity="0.85" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.85" />
                          </linearGradient>
                          <linearGradient id="edgeGradHover" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ffedd5" stopOpacity="1" />
                            <stop offset="100%" stopColor="#a5b4fc" stopOpacity="1" />
                          </linearGradient>
                        </defs>

                        {result.dependencies.map((dep, i) => {
                          const depY = 60 + i * rowHeight;
                          const isHovered = hoveredDep === dep;
                          // Cubic bezier connecting root node right to target node left
                          const pathData = `M ${rootX + 100} ${rootY} C ${rootX + 190} ${rootY}, ${
                            targetX - 90
                          } ${depY}, ${targetX} ${depY}`;

                          return (
                            <g key={dep}>
                              <path
                                d={pathData}
                                fill="none"
                                stroke={isHovered ? 'url(#edgeGradHover)' : 'url(#edgeGrad)'}
                                strokeWidth={isHovered ? '2.5' : '1.5'}
                                strokeDasharray={isHovered ? 'none' : '4 3'}
                                className="transition-all duration-200"
                              />
                              <circle
                                cx={targetX}
                                cy={depY}
                                r="4"
                                fill="#6366f1"
                                className="animate-pulse"
                              />
                            </g>
                          );
                        })}
                      </svg>

                      {/* Root Central Node */}
                      <div
                        className="absolute -translate-y-1/2 w-52 p-3.5 rounded-xl bg-neutral-900 border-2 border-orange-500/80 shadow-lg shadow-orange-500/10 z-10 transition-transform hover:scale-[1.02]"
                        style={{ left: `${rootX - 100}px`, top: `${rootY}px` }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                            Target Entity
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {result.dependencies.length} calls
                          </span>
                        </div>
                        <div className="font-mono text-sm font-bold text-white truncate">
                          {result.entity}
                        </div>
                        {result.matches && result.matches[0] && (
                          <div className="text-[10px] text-neutral-400 truncate mt-1">
                            {result.matches[0].filePath.split('/').pop()}
                          </div>
                        )}
                      </div>

                      {/* Dependent Child Nodes */}
                      {result.dependencies.map((dep, i) => {
                        const depY = 60 + i * rowHeight;
                        const isHovered = hoveredDep === dep;

                        return (
                          <div
                            key={dep}
                            onMouseEnter={() => setHoveredDep(dep)}
                            onMouseLeave={() => setHoveredDep(null)}
                            className={`absolute -translate-y-1/2 w-64 p-3 rounded-xl border transition-all duration-150 z-10 flex items-center justify-between group ${
                              isHovered
                                ? 'bg-neutral-800/90 border-indigo-400 shadow-md shadow-indigo-500/20 scale-[1.02]'
                                : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                            }`}
                            style={{ left: `${targetX}px`, top: `${depY}px` }}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-1.5">
                                <GitBranch className="w-3 h-3 text-indigo-400 shrink-0" />
                                <span className="font-mono text-xs font-semibold text-neutral-200 truncate group-hover:text-white">
                                  {dep}
                                </span>
                              </div>
                              <span className="text-[10px] text-neutral-500 block truncate mt-0.5">
                                Dependency {i + 1}
                              </span>
                            </div>

                            <button
                              onClick={() => handleSearch(dep)}
                              title={`Explore dependencies of ${dep}`}
                              className="px-2 py-1 rounded bg-neutral-800 group-hover:bg-orange-500 text-[10px] font-semibold text-neutral-300 group-hover:text-white transition-colors shrink-0 flex items-center gap-1"
                            >
                              Explore
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 bg-neutral-900/60 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400 mt-auto">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        Root entity &rarr; Outgoing AST function calls and imports
                      </span>
                      <span>Click &ldquo;Explore&rdquo; to traverse deeper into any node</span>
                    </div>
                  </div>
                ) : (
                  /* LIST / TREE VIEW */
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
                      Dependency Chain ({result.dependencies.length})
                    </p>
                    <div className="space-y-1.5">
                      {result.dependencies.map((dep, i) => {
                        const expanded = expandedDeps.has(dep);
                        return (
                          <div
                            key={i}
                            className="rounded-xl overflow-hidden border border-neutral-100 dark:border-neutral-800/60"
                          >
                            <button
                              onClick={() => toggleDep(dep)}
                              className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-900/40 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors text-left group"
                            >
                              <span className="text-neutral-300 dark:text-neutral-600 font-mono text-xs w-5 text-right">
                                {i + 1}
                              </span>
                              <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <GitBranch className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                              </div>
                              <code className="text-neutral-700 dark:text-neutral-300 font-mono text-sm group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors flex-1 truncate">
                                {dep}
                              </code>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSearch(dep);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-neutral-400 dark:text-neutral-500 hover:text-orange-500 dark:hover:text-orange-400 text-xs transition-all px-2 py-0.5 rounded-md hover:bg-orange-50 dark:hover:bg-orange-500/10 shrink-0 flex items-center gap-1"
                              >
                                Explore
                                <ArrowRight className="w-3 h-3" />
                              </button>
                              {expanded ? (
                                <ChevronDown className="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
                              )}
                            </button>
                            {expanded && (
                              <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800/20 border-t border-neutral-100 dark:border-neutral-800/40 animate-fade-in flex items-center justify-between">
                                <p className="text-neutral-400 dark:text-neutral-500 text-xs">
                                  Direct AST dependency of{' '}
                                  <code className="font-mono text-neutral-600 dark:text-neutral-400">
                                    {result.entity}
                                  </code>
                                </p>
                                <button
                                  onClick={() => handleSearch(dep)}
                                  className="text-orange-500 hover:text-orange-600 text-xs font-semibold flex items-center gap-1"
                                >
                                  Traverse Graph <ArrowRight className="w-3 h-3" />
                                </button>
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
