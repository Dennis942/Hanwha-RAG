"use client";

import { CircleArrowRight, Search, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui";

const exampleQuestions = [
  "최근 진행 중인 프로젝트 현황 알려줘",
  "지난 회의록에서 결정된 사항 요약해줘",
  "A 프로젝트 계약/견적 이력 찾아줘",
  "특정 고객사 관련 업무 히스토리 보여줘"
];

export function ChatbotPanel(props: {
  question: string;
  onOpenQuestion: (question: string) => void;
  onQuestionChange: (value: string) => void;
  onSearchClick: () => void;
  onSubmitQuestion: () => void;
  onUploadClick: () => void;
}) {
  return (
    <div className="relative min-h-[720px] overflow-hidden rounded-md border border-line bg-white">
      <section className="mx-auto flex min-h-[720px] w-full max-w-[1080px] flex-col px-6 py-8">
        <div className="mx-auto w-full flex-1 pt-8">
          <div className="text-center">
            <Badge tone="amber">Project Knowledge Base</Badge>
            <h2 className="mt-3 text-2xl font-bold text-ink">DA플랫폼팀 업무 히스토리 Q&A</h2>
            <p className="mt-2 text-sm text-slate-500">프로젝트 진행 기록, 회의록, 계약/견적 이력을 기반으로 질문하고 출처를 확인합니다.</p>
          </div>
          <div className="mx-auto mt-8 grid w-full max-w-[900px] gap-3 md:grid-cols-2 xl:grid-cols-4">
            {exampleQuestions.map((item) => (
              <button key={item} type="button" onClick={() => props.onOpenQuestion(item)} className="min-h-28 rounded-md border border-line bg-field p-4 text-center text-sm font-semibold text-slate-700 shadow-sm hover:border-[#f37321] hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-[#f37321]/30">
                <Sparkles className="mx-auto mb-3 text-[#f37321]" size={20} aria-hidden />
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1040px] pb-2">
          <div className="rounded-md border border-line bg-white p-3 shadow-panel">
            <label className="sr-only" htmlFor="chat-home-question">질문 입력</label>
            <textarea
              id="chat-home-question"
              value={props.question}
              onChange={(event) => props.onQuestionChange(event.target.value)}
              className="min-h-16 w-full resize-none border-0 bg-white p-2 text-base outline-none focus:ring-0"
              placeholder="업로드 및 인덱싱된 문서에 질문할 내용을 입력하세요."
            />
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button type="button" onClick={props.onUploadClick} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-field focus:outline-none focus:ring-2 focus:ring-ocean/30" title="문서 업로드" aria-label="문서 업로드">
                  <Upload size={18} aria-hidden />
                </button>
                <button type="button" onClick={props.onSearchClick} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-field focus:outline-none focus:ring-2 focus:ring-ocean/30" title="문서 관리" aria-label="문서 관리">
                  <Search size={18} aria-hidden />
                </button>
              </div>
              <button type="button" onClick={props.onSubmitQuestion} title="문서 Q&A로 이동" aria-label="문서 Q&A로 이동" className="flex h-11 w-11 items-center justify-center rounded-md bg-[#f37321] text-white hover:bg-[#dd6415] focus:outline-none focus:ring-2 focus:ring-[#f37321]/40">
                <CircleArrowRight size={24} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
