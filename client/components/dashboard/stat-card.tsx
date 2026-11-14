'use client';

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  iconBg?: string;
  iconColor?: string;
  trend?: { value: string; up: boolean };
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg = 'bg-orange-50 dark:bg-orange-500/10',
  iconColor = 'text-orange-500 dark:text-orange-400',
  trend,
}: StatCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-100 dark:border-neutral-800/60 bg-white dark:bg-neutral-900/40 p-5 hover:shadow-sm transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        {trend && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              trend.up
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                : 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
            }`}
          >
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{value}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">{label}</p>
        {sub && <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}
