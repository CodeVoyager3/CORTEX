'use client';

import { useState } from 'react';
import {
  Brain,
  LayoutDashboard,
  MessageSquare,
  GitBranch,
  Database,
  Settings,
  HelpCircle,
  ChevronDown,
  AlertTriangle,
  Activity,
  Cpu,
  ChevronRight,
  User,
  ChevronsUpDown,
} from 'lucide-react';

export type NavView = 'overview' | 'copilot' | 'dependencies' | 'repositories';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
}

const mainNav = [
  { id: 'overview' as NavView,      label: 'Overview',             icon: LayoutDashboard, description: 'Stats & insights' },
  { id: 'copilot' as NavView,       label: 'Copilot Chat',         icon: MessageSquare,   description: 'Ask the codebase' },
  { id: 'dependencies' as NavView,  label: 'Dependency Explorer',  icon: GitBranch,       description: 'Graph traversal' },
  { id: 'repositories' as NavView,  label: 'Repositories',         icon: Database,        description: 'Manage indexed repos' },
];

const monitors = [
  { label: 'Graph Health',      icon: Activity,      status: 'online' as const },
  { label: 'Ingestion Queue',   icon: Cpu,           status: 'idle'   as const },
  { label: 'SLA Alerts',        icon: AlertTriangle, status: 'warn'   as const },
];

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  const [monitorsOpen, setMonitorsOpen] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(true);

  return (
    <aside className="flex flex-col h-full w-64 bg-neutral-50 dark:bg-neutral-900/60 border-r border-neutral-100 dark:border-neutral-800/60 shrink-0 overflow-hidden">

      {/* Logo header */}
      <div className="flex items-center justify-between px-4 h-[60px] border-b border-neutral-100 dark:border-neutral-800/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-orange-500 flex items-center justify-center shadow-sm">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-neutral-900 dark:text-neutral-100 font-semibold text-sm tracking-tight">OceanLabs</span>
            <p className="text-neutral-400 dark:text-neutral-500 text-[10px] -mt-0.5">CORTEX Intelligence</p>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="flex-1 overflow-y-auto scrollbar-hide py-3 px-2.5">
        <div className="space-y-0.5">
          {mainNav.map((item) => {
            const active = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`
                  w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-left transition-all duration-200 group
                  ${active
                    ? 'bg-orange-500 text-white shadow-[inset_2px_4px_8px_rgba(255,255,255,0.25),inset_-2px_-4px_8px_rgba(0,0,0,0.2)]'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06),inset_-2px_-2px_5px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.04)] hover:text-neutral-700 dark:hover:text-neutral-300'}
                `}
              >
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-white' : 'text-neutral-400 dark:text-neutral-500'}`} />
                <div className="min-w-0">
                  <p className={`text-[15px] font-medium tracking-tight truncate ${active ? 'text-white' : ''}`}>
                    {item.label}
                  </p>
                </div>
                {active && <ChevronRight className="w-4 h-4 text-white/70 ml-auto flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Pinned Monitors section */}
        <div className="mt-5">
          <button
            onClick={() => setMonitorsOpen(!monitorsOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 mb-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
          >
            <span className="text-[13px] font-medium tracking-tight">Pinned monitors</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${monitorsOpen ? 'rotate-180' : ''}`} />
          </button>

          {monitorsOpen && (
            <div className="space-y-0.5 px-1.5">
              {monitors.map((m) => {
                const Icon = m.icon;
                const dotColor = m.status === 'online' ? 'bg-emerald-400' : m.status === 'warn' ? 'bg-amber-400' : 'bg-neutral-300 dark:bg-neutral-600';
                return (
                  <div
                    key={m.label}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors group text-[14px]"
                  >
                    <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                    <span className="flex-1 truncate">{m.label}</span>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Operator console */}
        <div className="mt-3">
          <button
            onClick={() => setConsoleOpen(!consoleOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 mb-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-400 transition-colors"
          >
            <span className="text-[13px] font-medium tracking-tight">Operator console</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${consoleOpen ? 'rotate-180' : ''}`} />
          </button>

          {consoleOpen && (
            <div className="space-y-0.5 px-1.5">
              {[
                { label: 'Settings', icon: Settings },
                { label: 'Help Center', icon: HelpCircle },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors text-[14px]"
                  >
                    <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* User footer */}
      <div className="border-t border-neutral-100 dark:border-neutral-800/60 px-3 py-3">
        <div className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-neutral-800 dark:text-neutral-200 text-sm font-medium truncate">Engineer</p>
            <p className="text-neutral-400 dark:text-neutral-500 text-[11px] truncate">cortex workspace</p>
          </div>
          <ChevronsUpDown className="w-4 h-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
        </div>
      </div>
    </aside>
  );
}
