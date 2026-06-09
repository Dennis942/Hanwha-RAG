"use client";

import { Badge, Panel, SectionHeader } from "@/components/ui";
import type { SearchResult } from "@/lib/types";
import { getStatusLabel, getStatusTone } from "@/lib/ui-format";

export function WorkSearchPanel(props: {
  query: string;
  results: SearchResult[];
  onAskFromDocument?: (id: string) => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
}) {
  return (
    <Panel>
      <SectionHeader title="문서·업무 검색" action={<Badge tone="blue">documents + chunks</Badge>} />
      <div className="space-y-4 p-5">
        <label className="block text-sm font-semibold text-slate-700">
          검색어
          <div className="mt-2 flex flex-col gap-3 md:flex-row">
            <input value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} className="h-11 flex-1 rounded-md border border-line bg-field px-3 font-normal" placeholder="프로젝트, 고객사, 계약 조건, 결정사항 검색" />
            <button type="button" onClick={props.onSearch} className="h-11 rounded-md bg-ocean px-4 font-semibold text-white">검색</button>
          </div>
        </label>
        <div className="space-y-3">
          {props.results.map((result) => (
            <article key={result.id} className="rounded-md border border-line bg-white p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <p className="font-semibold text-ink">{result.title}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{result.filePath ?? "file_path 연결 예정"}</p>
                </div>
                <Badge tone={getStatusTone(result.status)}>{getStatusLabel(result.status)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge tone={result.projectName ? "blue" : "neutral"}>{result.projectName ?? "미분류"}</Badge>
                {result.category && <Badge tone="amber">{result.category}</Badge>}
                {result.documentType && <Badge>{result.documentType}</Badge>}
                {result.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
              </div>
              {result.chunkPreview && <p className="mt-3 rounded-md bg-field p-3 text-sm leading-6 text-slate-700">{result.chunkPreview}</p>}
              <button type="button" onClick={() => props.onAskFromDocument?.(result.id)} className="mt-3 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700">이 문서 기준으로 질문하기</button>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}

