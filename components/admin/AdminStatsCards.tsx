"use client";

import { Panel } from "@/components/ui";

export type AdminStat = {
  label: string;
  value: string | number;
  helper?: string;
};

export function AdminStatsCards({ stats }: { stats: AdminStat[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {stats.map((stat) => (
        <Panel key={stat.label} className="p-4">
          <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
          <p className="mt-2 text-2xl font-bold text-ink">{stat.value}</p>
          {stat.helper && <p className="mt-1 text-xs text-slate-500">{stat.helper}</p>}
        </Panel>
      ))}
    </div>
  );
}

