"use client";

import { Badge, Panel, SectionHeader } from "@/components/ui";
import type { ChatLog } from "@/lib/types";

export function HistoryDetailPanel({ log }: { log: ChatLog | null }) {
  if (!log) {
    return (
      <Panel>
        <SectionHeader title="히스토리 상세" />
        <p className="p-5 text-sm text-slate-500">최근 질문을 선택하면 질문, 답변, 필터, 출처를 확인할 수 있습니다.</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <SectionHeader title="히스토리 상세" action={<Badge tone="blue">{log.projectName ?? "전체"}</Badge>} />
      <div className="space-y-4 p-5">
        <div>
          <p className="text-xs font-semibold text-slate-500">질문</p>
          <p className="mt-2 font-semibold text-ink">{log.question}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">답변</p>
          <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">{log.answer}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">사용 필터</p>
          <pre className="mt-2 overflow-auto rounded-md bg-field p-3 text-xs text-slate-700">{JSON.stringify(log.filters ?? {}, null, 2)}</pre>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">출처</p>
          <pre className="mt-2 overflow-auto rounded-md bg-field p-3 text-xs text-slate-700">{JSON.stringify(log.sources ?? [], null, 2)}</pre>
        </div>
        <p className="text-xs text-slate-500">질문 일시: {log.createdAt}</p>
      </div>
    </Panel>
  );
}

