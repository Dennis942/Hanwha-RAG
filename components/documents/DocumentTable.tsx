"use client";

import { Badge } from "@/components/ui";
import type { UploadedDocument } from "@/lib/types";
import { getStatusLabel, getStatusTone } from "@/lib/ui-format";

export function DocumentTable(props: {
  documents: UploadedDocument[];
  onDelete?: (id: string) => void;
  onIndex?: (id: string) => void;
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-white">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-field text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3">문서명</th>
            <th className="px-5 py-3">프로젝트/분류</th>
            <th className="px-5 py-3">파일 유형</th>
            <th className="px-5 py-3">업로드</th>
            <th className="px-5 py-3">상태</th>
            <th className="px-5 py-3">작업</th>
          </tr>
        </thead>
        <tbody>
          {props.documents.map((document) => (
            <tr key={document.id} className="border-t border-line">
              <td className="px-5 py-4">
                <p className="font-semibold text-ink">{document.title}</p>
                {document.filePath && <p className="mt-1 max-w-[280px] truncate text-xs text-slate-500">{document.filePath}</p>}
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1">
                  <Badge tone={document.projectName ? "blue" : "neutral"}>{document.projectName ?? "미분류"}</Badge>
                  {document.category && <Badge tone="amber">{document.category}</Badge>}
                  {document.documentType && <Badge>{document.documentType}</Badge>}
                  {document.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                </div>
              </td>
              <td className="px-5 py-4 uppercase">{document.fileType}</td>
              <td className="px-5 py-4">{document.uploader ?? "-"} · {document.uploadedAt ?? "-"}</td>
              <td className="px-5 py-4"><Badge tone={getStatusTone(document.status)}>{getStatusLabel(document.status)}</Badge></td>
              <td className="space-x-2 px-5 py-4">
                <button type="button" onClick={() => props.onOpen?.(document.id)} className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700">상세</button>
                <button type="button" onClick={() => props.onIndex?.(document.id)} className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700">인덱싱 실행</button>
                <button type="button" onClick={() => props.onDelete?.(document.id)} className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700">삭제</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

