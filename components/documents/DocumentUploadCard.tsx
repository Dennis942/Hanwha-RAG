"use client";

import type { ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { Panel, SectionHeader } from "@/components/ui";

export function DocumentUploadCard(props: {
  disabled?: boolean;
  onFileChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Panel>
      <SectionHeader title="문서 업로드" />
      <div className="space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            프로젝트
            <input className="mt-2 h-10 w-full rounded-md border border-line bg-field px-3 font-normal" placeholder="프로젝트 선택 영역" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            문서 유형
            <input className="mt-2 h-10 w-full rounded-md border border-line bg-field px-3 font-normal" placeholder="회의록, 계약/견적, 보고서" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            태그
            <input className="mt-2 h-10 w-full rounded-md border border-line bg-field px-3 font-normal" placeholder="프로젝트 진행 기록, 회의록" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            카테고리
            <input className="mt-2 h-10 w-full rounded-md border border-line bg-field px-3 font-normal" placeholder="업무 카테고리" />
          </label>
          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            설명
            <textarea className="mt-2 min-h-20 w-full rounded-md border border-line bg-field p-3 font-normal" placeholder="문서 설명 또는 메모" />
          </label>
        </div>
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-line bg-field text-center hover:border-ocean">
          <Upload className="text-ocean" size={28} aria-hidden />
          <span className="mt-3 font-semibold text-ink">DOC, DOCX, PDF, TXT, HWP, PPT, PPTX 업로드</span>
          <span className="mt-1 text-sm text-slate-500">실제 업로드 로직은 기존 Supabase Storage 흐름에 연결합니다.</span>
          <input
            type="file"
            accept=".doc,.docx,.pdf,.txt,.hwp,.ppt,.pptx"
            className="sr-only"
            disabled={props.disabled}
            onChange={props.onFileChange}
          />
        </label>
      </div>
    </Panel>
  );
}

