'use client';

import { MessageSquare, Brain, Clock } from 'lucide-react';

export interface ActivityItem {
  id: string;
  query: string;
  entity?: string;
  time: string;
  type: 'chat' | 'ingest' | 'dependency';
}

const typeConfig = {
  chat:       { icon: MessageSquare, iconCls: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10',  label: 'Copilot' },
  ingest:     { icon: Brain,         iconCls: 'text-blue-500 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-500/10',      label: 'Ingested' },
  dependency: { icon: Brain,         iconCls: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10',  label: 'Graph' },
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Clock className="w-8 h-8 text-neutral-200 dark:text-neutral-700" />
        <p className="text-neutral-400 dark:text-neutral-500 text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {items.map((item, i) => {
        const cfg = typeConfig[item.type];
        const Icon = cfg.icon;
        return (
          <div
            key={item.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors duration-200 group cursor-pointer"
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${cfg.bg}`}>
              <Icon className={`w-3.5 h-3.5 ${cfg.iconCls}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-neutral-700 dark:text-neutral-300 text-xs font-medium truncate group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors">
                {item.query}
              </p>
              {item.entity && (
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono mt-0.5 truncate">
                  → {item.entity}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-1 text-neutral-300 dark:text-neutral-600">
              <Clock className="w-3 h-3" />
              <span className="text-[11px]">{item.time}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
