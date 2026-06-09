"use client";

import { Badge } from "@/components/ui";
import type { ProjectRecord } from "@/lib/types";

export function ProjectHistoryTable({ projects }: { projects: ProjectRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-field text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3">프로젝트명</th>
            <th className="px-5 py-3">상태</th>
            <th className="px-5 py-3">담당자</th>
            <th className="px-5 py-3">기간</th>
            <th className="px-5 py-3">태그</th>
            <th className="px-5 py-3">최근 업데이트</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-t border-line">
              <td className="px-5 py-4 font-semibold text-ink">{project.name}</td>
              <td className="px-5 py-4"><Badge tone={project.status === "완료" ? "green" : "blue"}>{project.status}</Badge></td>
              <td className="px-5 py-4">{project.owner}</td>
              <td className="px-5 py-4">{project.period ?? "-"}</td>
              <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{project.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div></td>
              <td className="px-5 py-4">{project.updatedAt ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

