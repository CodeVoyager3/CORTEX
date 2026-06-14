'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Brain, Bell, ChevronRight, Sun, Moon } from 'lucide-react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { OverviewPanel } from '@/components/dashboard/overview-panel';
import { CopilotPanel } from '@/components/dashboard/copilot-panel';
import { DependencyPanel } from '@/components/dashboard/dependency-panel';
import { RepoPanel } from '@/components/dashboard/repo-panel';
import { type ActivityItem } from '@/components/dashboard/activity-feed';

export type NavView = 'overview' | 'copilot' | 'dependencies' | 'repositories';

const viewLabels: Record<NavView, string> = {
  overview: 'Overview',
  copilot: 'Copilot Chat',
  dependencies: 'Dependency Explorer',
  repositories: 'Repositories',
};

export default function DashboardPage() {
  const [currentView, setCurrentView] = useState<NavView>('overview');
  const [backendOnline, setBackendOnline] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isDark, setIsDark] = useState(true); // default dark like incident dashboard

  // Backend health ping
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/health', {
          signal: AbortSignal.timeout(3000),
        });
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const addActivity = useCallback((item: ActivityItem) => {
    setActivity((prev) => [item, ...prev].slice(0, 20));
  }, []);

  const breadcrumbs: NavView[] =
    currentView !== 'overview' ? ['overview', currentView] : ['overview'];

  return (
    /* Root wrapper carries the .dark class for Tailwind class-based dark mode */
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col overflow-hidden font-sans transition-colors duration-300">

        {/* ── Top Nav ── */}
        <header className="w-full bg-white dark:bg-neutral-950 border-b border-neutral-100 dark:border-neutral-800/60 px-5 h-[60px] flex items-center justify-between shrink-0 z-30">
          {/* Left: logo + breadcrumbs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shadow-sm animate-cortex-pulse">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="text-neutral-900 dark:text-neutral-100 font-bold text-sm tracking-tight hidden sm:block">
                CORTEX
              </span>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 ml-3">
              {breadcrumbs.map((crumb, i) => (
                <div key={crumb} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600" />}
                  <button
                    onClick={() => setCurrentView(crumb)}
                    className={`text-xs px-2 py-1 rounded-md transition-colors ${
                      i === breadcrumbs.length - 1
                        ? 'text-neutral-700 dark:text-neutral-300 font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700'
                        : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400'
                    }`}
                  >
                    {viewLabels[crumb]}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right: status + theme toggle + bell + user */}
          <div className="flex items-center gap-2">
            {/* Backend status */}
            <div
              className={`hidden sm:flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg ${
                backendOnline
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                  : 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {backendOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                )}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${backendOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </span>
              {backendOnline ? 'Backend online' : 'Backend offline'}
            </div>

            {/* Theme toggle — like watermelon dashboards */}
            <button
              onClick={() => setIsDark(!isDark)}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-all duration-200 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06),inset_-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]"
              aria-label="Toggle theme"
            >
              {isDark
                ? <Sun className="w-3.5 h-3.5" />
                : <Moon className="w-3.5 h-3.5" />
              }
            </button>

            {/* Notification bell */}
            <button className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 transition-all duration-200 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06),inset_-2px_-2px_5px_rgba(255,255,255,0.8)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]">
              <Bell className="w-3.5 h-3.5" />
              {activity.length > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-orange-500 rounded-full" />
              )}
            </button>

            {/* Clerk user button */}
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'h-7 w-7 rounded-full ring-2 ring-orange-500/30 ring-offset-1',
                  userButtonPopoverCard: 'shadow-xl border border-neutral-200 dark:border-neutral-700',
                  userButtonPopoverActionButton: 'hover:bg-neutral-100 dark:hover:bg-neutral-700',
                  userButtonPopoverFooter: 'hidden',
                },
              }}
            />
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar currentView={currentView} onNavigate={setCurrentView} />

          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Tab strip */}
            <div className="border-b border-neutral-100 dark:border-neutral-800/60 px-4 overflow-x-auto scrollbar-hide shrink-0 bg-white dark:bg-neutral-950">
              <div className="flex gap-0 min-w-max">
                {(Object.entries(viewLabels) as [NavView, string][]).map(([view, label]) => {
                  const active = currentView === view;
                  return (
                    <button
                      key={view}
                      onClick={() => setCurrentView(view)}
                      className={`
                        relative flex items-center gap-2 px-4 py-3.5 text-[13px] font-medium transition-all duration-200 border-b-[1.5px]
                        ${active
                          ? 'text-neutral-900 dark:text-neutral-100 border-orange-500'
                          : 'text-neutral-400 dark:text-neutral-500 border-transparent hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-neutral-200 dark:hover:border-neutral-700'}
                      `}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active panel */}
            <div className="flex-1 flex overflow-hidden bg-white dark:bg-neutral-950">
              {currentView === 'overview' && (
                <OverviewPanel onNavigate={setCurrentView} activity={activity} backendOnline={backendOnline} />
              )}
              {currentView === 'copilot' && (
                <CopilotPanel onActivity={addActivity} />
              )}
              {currentView === 'dependencies' && (
                <DependencyPanel onActivity={addActivity} />
              )}
              {currentView === 'repositories' && (
                <RepoPanel onActivity={addActivity} />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
