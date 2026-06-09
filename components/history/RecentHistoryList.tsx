"use client";

import { Archive } from "lucide-react";
import { recentQuestions } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/ui-format";

export type RecentHistoryItem = {
  id: string;
  question: string;
  sources: unknown[];
  project_name?: string | null;
  created_at: string;
};

export function RecentHistoryList(props: {
  logs: RecentHistoryItem[];
  onOpenHistory: (log: RecentHistoryItem) => void;
  onOpenQuestion: (question: string) => void;
}) {
  return (
    <div className="mt-8 border-t border-line pt-5">
      <p className="mb-3 px-2 text-xs font-bold text-slate-500">최근 질문/답변 히스토리</p>
      <div className="space-y-1">
        {props.logs.length === 0 && recentQuestions.slice(0, 3).map((item) => (
          <button key={item} type="button" onClick={() => props.onOpenQuestion(item)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-field focus:outline-none focus:ring-2 focus:ring-ocean/30">
            <Archive size={15} aria-hidden />
            <span className="truncate">{item}</span>
          </button>
        ))}
        {props.logs.map((log) => (
          <button key={log.id} type="button" onClick={() => props.onOpenHistory(log)} className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-field focus:outline-none focus:ring-2 focus:ring-ocean/30">
            <span className="block truncate font-semibold text-ink">{log.question}</span>
            <span className="mt-1 block text-xs text-slate-500">{formatDateTime(log.created_at)} · {(log.sources ?? []).length} sources · {log.project_name ?? "전체"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

