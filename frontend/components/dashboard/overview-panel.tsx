'use client';

import { useState, useEffect } from 'react';
import {
  Brain, Files, GitBranch, Network, Database,
  Zap, TrendingUp, Clock, ArrowRight, RefreshCw, Cpu, MessageSquare
} from 'lucide-react';
import { StatCard } from './stat-card';
import { ActivityFeed, type ActivityItem } from './activity-feed';

type NavView = 'overview' | 'copilot' | 'dependencies' | 'repositories';

interface OverviewPanelProps {
  onNavigate: (view: NavView) => void;
  activity: ActivityItem[];
  backendOnline: boolean;
}

const quickQueries = [
  'What does the auth module do?',
  'Show dependencies of UserModel',
  'What breaks if I change the payment service?',
  'List all API endpoints in the repo',
  'Explain the database schema relationships',
  'Find all circular dependencies',
];

export function OverviewPanel({ onNavigate, activity, backendOnline }: OverviewPanelProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-7 py-5 border-b border-neutral-100 dark:border-neutral-800/60 flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">Overview</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-0.5">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            {' · '}
            <span className={`font-medium ${backendOnline ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {backendOnline ? '● Backend online' : '● Backend offline'}
            </span>
          </p>
        </div>
        <button className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors text-xs border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-900">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-7 py-6 space-y-8">

        {/* Stats */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
            Graph Statistics
          </h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard icon={Files}   label="Total Files Indexed" value="—" trend={{ value: 'new', up: true }} />
            <StatCard icon={Brain}   label="Graph Entities"       value="—" iconBg="bg-blue-50 dark:bg-blue-500/10" iconColor="text-blue-500 dark:text-blue-400" />
            <StatCard icon={Network} label="Relationships"         value="—" iconBg="bg-indigo-50 dark:bg-indigo-500/10" iconColor="text-indigo-500 dark:text-indigo-400" />
            <StatCard icon={Database}label="Repos Indexed"         value="—" iconBg="bg-emerald-50 dark:bg-emerald-500/10" iconColor="text-emerald-500 dark:text-emerald-400" />
          </div>
        </section>

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Quick queries + shortcuts */}
          <section className="xl:col-span-2 space-y-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Quick Queries
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickQueries.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate('copilot')}
                  className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-900/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-800/60 hover:border-orange-200 dark:hover:border-orange-500/30 rounded-xl text-left text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 text-sm transition-all duration-200 group shadow-sm"
                >
                  <Zap className="w-3.5 h-3.5 text-orange-400 dark:text-orange-500/70 group-hover:text-orange-500 flex-shrink-0 transition-colors" />
                  <span className="truncate">{q}</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 text-orange-500 transition-all -translate-x-1 group-hover:translate-x-0 flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Feature shortcuts */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[
                { icon: MessageSquare, label: 'Copilot Chat',        desc: 'Natural language Q&A',  color: 'text-orange-500',  bg: 'bg-orange-50 dark:bg-orange-500/10',   border: 'hover:border-orange-200 dark:hover:border-orange-500/30', view: 'copilot' as NavView },
                { icon: GitBranch,     label: 'Dependency Explorer', desc: 'Trace relationships',   color: 'text-indigo-500',  bg: 'bg-indigo-50 dark:bg-indigo-500/10',   border: 'hover:border-indigo-200 dark:hover:border-indigo-500/30', view: 'dependencies' as NavView },
                { icon: Database,      label: 'Repositories',        desc: 'Index & manage repos',  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'hover:border-emerald-200 dark:hover:border-emerald-500/30', view: 'repositories' as NavView },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => onNavigate(item.view)}
                    className={`flex flex-col items-start gap-2.5 p-4 bg-white dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800/60 ${item.border} rounded-xl text-left transition-all duration-200 group hover:shadow-sm`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.bg}`}>
                      <Icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="text-neutral-800 dark:text-neutral-200 text-sm font-medium group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors">{item.label}</p>
                      <p className="text-neutral-400 dark:text-neutral-500 text-xs">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Activity feed */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Recent Activity
              </h2>
              <Clock className="w-3.5 h-3.5 text-neutral-300 dark:text-neutral-600" />
            </div>
            <div className="rounded-xl border border-neutral-100 dark:border-neutral-800/60 bg-white dark:bg-neutral-900/40 overflow-hidden">
              <ActivityFeed items={activity} />
            </div>
          </section>
        </div>

        {/* System Health */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
            System Health
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'GraphRAG Engine',    status: backendOnline ? 'Operational' : 'Offline', ok: backendOnline, icon: Brain },
              { label: 'Embedding Pipeline', status: 'Operational', ok: true,  icon: Cpu },
              { label: 'Ingestion Queue',    status: 'Idle',        ok: true,  icon: TrendingUp },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-100 dark:border-neutral-800/60 bg-white dark:bg-neutral-900/40"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.ok ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
                    <Icon className={`w-4.5 h-4.5 ${s.ok ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-neutral-700 dark:text-neutral-300 text-xs font-medium">{s.label}</p>
                    <p className={`text-[11px] font-semibold ${s.ok ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {s.status}
                    </p>
                  </div>
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    {s.ok && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${s.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
