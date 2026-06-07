"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CircleArrowRight,
  FileSearch,
  FileText,
  Filter,
  History,
  KeyRound,
  LayoutDashboard,
  Lock,
  MessageSquareText,
  PanelLeftClose,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { Badge, FieldLabel, Panel, SectionHeader } from "@/components/ui";
import { currentUser, documents, projects, recentQuestions, tags } from "@/lib/mock-data";
import { askKnowledgeBase, searchWorkHistory } from "@/lib/rag-service";
import { isSupabaseConfigured, supabase, type SupabaseDocument } from "@/lib/supabase";
import type { ChangeEvent } from "react";
import type { LucideIcon } from "lucide-react";

const statusTone = {
  uploaded: "blue",
  Uploaded: "blue",
  Pending: "amber",
  Processing: "amber",
  Indexed: "green",
  Failed: "red",
  Reprocessing: "blue",
  Deleted: "neutral"
} as const;

const allowedDocumentExtensions = ["pdf", "txt", "docx"] as const;

function getStatusTone(status: string) {
  return statusTone[status as keyof typeof statusTone] ?? "neutral";
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function makeStoragePath(file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;

  return `uploads/${id}-${safeName}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

const nav = [
  { id: "dashboard", label: "메인 챗봇", icon: LayoutDashboard },
  { id: "ask", label: "Q&A", icon: MessageSquareText },
  { id: "search", label: "업무 검색", icon: Search },
  { id: "documents", label: "문서 관리", icon: FileText },
  { id: "project", label: "프로젝트", icon: History },
  { id: "admin", label: "관리자", icon: ShieldCheck }
];

const quickActions: Array<{ page: string; icon: LucideIcon; label: string }> = [
  { page: "ask", icon: MessageSquareText, label: "질문하기" },
  { page: "documents", icon: Upload, label: "문서 업로드" },
  { page: "search", icon: FileSearch, label: "히스토리 검색" },
  { page: "admin", icon: ShieldCheck, label: "인덱싱 상태" },
  { page: "project", icon: History, label: "프로젝트 보기" }
];

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [question, setQuestion] = useState("RAG MVP에서 가장 먼저 구현해야 하는 화면은 무엇인가요?");
  const [searchQuery, setSearchQuery] = useState("RAG");
  const [projectFilter, setProjectFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const answer = useMemo(() => askKnowledgeBase(question), [question]);
  const searchResults = useMemo(
    () => searchWorkHistory(searchQuery, { projectId: projectFilter, tagId: tagFilter, documentType: typeFilter }),
    [projectFilter, searchQuery, tagFilter, typeFilter]
  );

  function handleLogin(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    if (!email.includes("@") || password.length < 6) {
      setLoginError("이메일 형식과 6자리 이상의 비밀번호를 확인해주세요.");
      return;
    }

    setLoginError("");
    setIsLoggedIn(true);
  }

  function openQuestion(nextQuestion: string) {
    setQuestion(nextQuestion);
    setActivePage("ask");
  }

  if (!isLoggedIn) {
    return <LoginPage loginError={loginError} onLogin={handleLogin} />;
  }

  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-line bg-white px-4 py-5">
          <div className="mb-6 flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <HanwhaMark />
              <div>
                <p className="text-xl font-bold tracking-normal text-ink">Eagle Next</p>
                <p className="text-xs text-slate-500">Hanwha Work AI</p>
              </div>
            </div>
            <PanelLeftClose size={18} className="text-slate-500" aria-hidden />
          </div>
          <button
            type="button"
            onClick={() => setActivePage("dashboard")}
            className="mb-6 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[#f37321] bg-white text-sm font-bold text-[#f37321] transition hover:bg-orange-50"
          >
            <PlusCircle size={18} aria-hidden />
            New Chat
          </button>
          <nav className="space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
                    isActive ? "bg-[#111111] text-white" : "text-slate-700 hover:bg-field"
                  }`}
                >
                  <Icon size={18} aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-8 border-t border-line pt-5">
            <p className="mb-3 px-2 text-xs font-bold text-slate-500">최근 업무 히스토리</p>
            <div className="space-y-1">
              {recentQuestions.map((item) => (
                <button key={item} type="button" onClick={() => openQuestion(item)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-field">
                  <Archive size={15} aria-hidden />
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 rounded-md border border-line bg-field p-3">
            <p className="text-sm font-semibold text-ink">{currentUser.name}</p>
            <p className="mt-1 text-xs text-slate-500">{currentUser.email}</p>
            <Badge tone="amber">Admin</Badge>
          </div>
          <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Powered by Hanwha AI</p>
        </aside>

        <section className="px-5 py-6 lg:px-8">
          <AppHeader setActivePage={setActivePage} />
          {activePage === "dashboard" && (
            <Dashboard
              question={question}
              openQuestion={openQuestion}
              setActivePage={setActivePage}
              setQuestion={setQuestion}
            />
          )}
          {activePage === "ask" && (
            <AskPage
              answer={answer}
              projectFilter={projectFilter}
              question={question}
              setProjectFilter={setProjectFilter}
              setQuestion={setQuestion}
              setTagFilter={setTagFilter}
              tagFilter={tagFilter}
            />
          )}
          {activePage === "search" && (
            <SearchPage
              projectFilter={projectFilter}
              results={searchResults}
              searchQuery={searchQuery}
              setProjectFilter={setProjectFilter}
              setSearchQuery={setSearchQuery}
              setTagFilter={setTagFilter}
              setTypeFilter={setTypeFilter}
              tagFilter={tagFilter}
              typeFilter={typeFilter}
            />
          )}
          {activePage === "documents" && <DocumentsPage />}
          {activePage === "project" && <ProjectPage />}
          {activePage === "admin" && <AdminPage />}
        </section>
      </div>
    </main>
  );
}

function LoginPage({ loginError, onLogin }: { loginError: string; onLogin: (formData: FormData) => void }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_480px]">
      <section className="flex items-center px-8 py-10 lg:px-16">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ocean">
            <ShieldCheck size={17} aria-hidden />
            근거 기반 업무 지식 조회
          </div>
          <h1 className="text-4xl font-bold leading-tight text-ink md:text-5xl">RAG 기반 업무 히스토리 조회 웹페이지</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            계약서, 회의록, 결정사항, 운영 이력을 업로드하고 질문하면 관련 문서와 출처를 함께 확인할 수 있는 사내 업무 지식베이스 MVP입니다.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["문서 업로드", "자연어 Q&A", "출처 검증"].map((item) => (
              <div key={item} className="rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-panel">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="flex items-center bg-white px-6 py-10 shadow-panel">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onLogin(new FormData(event.currentTarget));
          }}
          className="w-full"
        >
          <div className="mb-8">
            <Lock className="mb-4 text-ocean" size={30} aria-hidden />
            <h2 className="text-2xl font-bold text-ink">로그인</h2>
            <p className="mt-2 text-sm text-slate-500">외부망 접근 보호를 위해 인증 후 이용할 수 있습니다.</p>
          </div>
          <div className="space-y-4">
            <div>
              <FieldLabel>이메일</FieldLabel>
              <input name="email" type="email" placeholder="admin@company.example" className="mt-2 h-11 w-full rounded-md border border-line bg-field px-3" />
            </div>
            <div>
              <FieldLabel>비밀번호</FieldLabel>
              <input name="password" type="password" placeholder="6자리 이상" className="mt-2 h-11 w-full rounded-md border border-line bg-field px-3" />
            </div>
            {loginError && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loginError}</p>}
            <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ocean font-semibold text-white" type="submit">
              <KeyRound size={18} aria-hidden />
              로그인
            </button>
          </div>
          <p className="mt-5 rounded-md border border-line bg-field px-3 py-3 text-xs leading-5 text-slate-500">
            접속 기록과 문서 조회 이력은 감사 로그에 저장됩니다. 회사 승인 계정으로만 접근해주세요.
          </p>
        </form>
      </section>
    </main>
  );
}

function HanwhaMark() {
  return (
    <div className="relative h-11 w-11" aria-label="Hanwha inspired orange mark">
      <span className="absolute left-1 top-3 h-6 w-9 rotate-[-20deg] rounded-[50%] border-[5px] border-[#f37321]" />
      <span className="absolute left-3 top-4 h-6 w-8 rotate-[24deg] rounded-[50%] border-[4px] border-[#f89b61]" />
      <span className="absolute left-4 top-2 h-7 w-8 rotate-[14deg] rounded-[50%] border-[4px] border-[#ffb37a]" />
    </div>
  );
}

function AppHeader({ setActivePage }: { setActivePage: (page: string) => void }) {
  return (
    <header className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <p className="text-sm font-semibold text-[#f37321]">Hanwha Work AI</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">업무 히스토리 AI 플랫폼</h1>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setActivePage("documents")} className="flex h-10 items-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-slate-700">
          <Upload size={17} aria-hidden />
          업로드
        </button>
        <button type="button" onClick={() => setActivePage("dashboard")} className="flex h-10 items-center gap-2 rounded-md bg-[#f37321] px-3 text-sm font-semibold text-white">
          <MessageSquareText size={17} aria-hidden />
          질문하기
        </button>
      </div>
    </header>
  );
}

function Dashboard({
  openQuestion,
  question,
  setActivePage,
  setQuestion
}: {
  openQuestion: (question: string) => void;
  question: string;
  setActivePage: (page: string) => void;
  setQuestion: (value: string) => void;
}) {
  return (
    <div className="relative min-h-[720px] overflow-hidden rounded-md border border-line bg-white">
      <div className="min-h-[720px]">
        <section className="mx-auto flex min-h-[720px] w-full max-w-[1080px] flex-col px-6 py-8">
          <div className="mx-auto w-full flex-1 pt-8">
            <div className="text-center">
              <Badge tone="amber">Recommendation</Badge>
              <h2 className="mt-3 text-2xl font-bold text-ink">어떤 업무를 도와드릴까요?</h2>
              <p className="mt-2 text-sm text-slate-500">계약서, 회의록, 결정사항, 운영 이력을 기반으로 답변합니다.</p>
            </div>
            <div className="mx-auto mt-8 grid w-full max-w-[860px] gap-4 md:grid-cols-3">
              {[
                "최근 결정사항 요약해줘",
                "계약서 보안 조건 찾아줘",
                "운영 장애 이력 알려줘"
              ].map((item) => (
                <button key={item} type="button" onClick={() => openQuestion(item)} className="min-h-28 rounded-md border border-line bg-field p-4 text-center text-sm font-semibold text-slate-700 shadow-sm hover:border-[#f37321] hover:bg-orange-50">
                  <Sparkles className="mx-auto mb-3 text-[#f37321]" size={20} aria-hidden />
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="mx-auto w-full max-w-[1040px] pb-2">
            <div className="rounded-md border border-line bg-white p-3 shadow-panel">
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                className="min-h-16 w-full resize-none border-0 bg-white p-2 text-base outline-none"
                placeholder="What task can I help you with?"
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button type="button" onClick={() => setActivePage("documents")} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-field" title="문서 업로드">
                    <Upload size={18} aria-hidden />
                  </button>
                  <button type="button" onClick={() => setActivePage("search")} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-field" title="검색">
                    <Search size={18} aria-hidden />
                  </button>
                </div>
                <button type="button" onClick={() => setActivePage("ask")} className="flex h-11 w-11 items-center justify-center rounded-md bg-[#f37321] text-white">
                  <CircleArrowRight size={24} aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AskPage(props: {
  answer: ReturnType<typeof askKnowledgeBase>;
  projectFilter: string;
  question: string;
  setProjectFilter: (value: string) => void;
  setQuestion: (value: string) => void;
  setTagFilter: (value: string) => void;
  tagFilter: string;
}) {
  const { answer, projectFilter, question, setProjectFilter, setQuestion, setTagFilter, tagFilter } = props;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel>
        <SectionHeader title="자연어 Q&A" action={<Badge tone="amber">출처 기반 답변</Badge>} />
        <div className="space-y-4 p-5">
          <PageIntro
            title="질문하면 관련 문서와 근거를 함께 보여줍니다"
            description="추천 질문, 최근 히스토리, 입력창에서 넘어온 질문은 이 화면에서 답변 본문과 citation 카드로 분리되어 표시됩니다."
          />
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-36 w-full rounded-md border border-line bg-field p-4 text-base" />
          <Filters projectFilter={projectFilter} setProjectFilter={setProjectFilter} tagFilter={tagFilter} setTagFilter={setTagFilter} />
          <button className="flex h-11 items-center gap-2 rounded-md bg-ocean px-4 font-semibold text-white">
            <MessageSquareText size={18} aria-hidden />
            질문하기
          </button>
          <div className="rounded-md border border-line bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-ink">답변</h3>
              <Badge tone={answer.confidence === "none" ? "red" : "green"}>{answer.confidence}</Badge>
            </div>
            {answer.answer ? <p className="leading-7 text-slate-700">{answer.answer}</p> : <p className="rounded-md bg-field p-4 font-semibold text-slate-600">자료에서 확인할 수 없습니다</p>}
          </div>
        </div>
      </Panel>
      <Panel>
        <SectionHeader title="출처 및 관련 문서" />
        <div className="space-y-4 p-5">
          {answer.citations.length === 0 && <p className="text-sm text-slate-500">충분한 근거 문서가 없습니다.</p>}
          {answer.citations.map((citation) => {
            const document = documents.find((item) => item.id === citation.documentId);
            return (
              <div key={`${citation.documentId}-${citation.section}`} className="rounded-md border border-line bg-field p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{document?.title}</p>
                  <Badge tone="blue">{Math.round(citation.score * 100)}%</Badge>
                </div>
                <p className="text-xs font-semibold text-slate-500">{citation.section}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{citation.snippet}</p>
              </div>
            );
          })}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">후속 질문 추천</h3>
            <div className="space-y-2">
              {answer.followUps.map((item) => (
                <button key={item} onClick={() => setQuestion(item)} className="w-full rounded-md border border-line bg-white p-3 text-left text-sm text-slate-700">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SearchPage(props: {
  projectFilter: string;
  results: typeof documents;
  searchQuery: string;
  setProjectFilter: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setTagFilter: (value: string) => void;
  setTypeFilter: (value: string) => void;
  tagFilter: string;
  typeFilter: string;
}) {
  return (
    <Panel>
      <SectionHeader title="업무 히스토리 검색" action={<Badge tone="blue">키워드 + 의미 검색 준비</Badge>} />
      <div className="space-y-4 p-5">
        <PageIntro
          title="업무 히스토리 검색 상세"
          description="프로젝트, 태그, 문서 유형 조건을 조합해 계약 조건, 회의 결정사항, 운영 이력 문서를 빠르게 찾는 화면입니다."
        />
        <div className="flex flex-col gap-3 lg:flex-row">
          <input value={props.searchQuery} onChange={(event) => props.setSearchQuery(event.target.value)} placeholder="프로젝트, 계약 조건, 결정사항 검색" className="h-11 flex-1 rounded-md border border-line bg-field px-3" />
          <select value={props.typeFilter} onChange={(event) => props.setTypeFilter(event.target.value)} className="h-11 rounded-md border border-line bg-white px-3">
            <option value="">전체 유형</option>
            {["계약서", "회의록", "결정사항", "운영이력", "요약"].map((type) => <option key={type}>{type}</option>)}
          </select>
          <select className="h-11 rounded-md border border-line bg-white px-3">
            <option>관련도순</option>
            <option>최신순</option>
          </select>
        </div>
        <Filters projectFilter={props.projectFilter} setProjectFilter={props.setProjectFilter} tagFilter={props.tagFilter} setTagFilter={props.setTagFilter} />
        <div className="space-y-3">
          {props.results.map((document) => (
            <article key={document.id} className="rounded-md border border-line bg-white p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <p className="font-semibold text-ink">{document.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{document.summary}</p>
                </div>
                <Badge tone={statusTone[document.status]}>{document.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{projects.find((project) => project.id === document.projectId)?.name}</span>
                <span>{document.type}</span>
                <span>{document.uploadedAt}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function DocumentsPage() {
  const [documentRows, setDocumentRows] = useState<SupabaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function loadDocuments() {
    if (!supabase) {
      setIsLoading(false);
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }

    setIsLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("documents")
      .select("id,title,file_path,file_type,status,created_at")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setDocumentRows([]);
    } else {
      setDocumentRows(data ?? []);
    }

    setIsLoading(false);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!supabase) {
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }

    const fileType = getFileExtension(file.name);

    if (!allowedDocumentExtensions.includes(fileType as (typeof allowedDocumentExtensions)[number])) {
      setError("PDF, TXT, DOCX 파일만 업로드할 수 있습니다.");
      setMessage("");
      return;
    }

    setIsUploading(true);
    setError("");
    setMessage("");

    const filePath = makeStoragePath(file);
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

    if (uploadError) {
      setError(uploadError.message);
      setIsUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      title: file.name,
      file_path: filePath,
      file_type: fileType,
      status: "uploaded",
      created_at: new Date().toISOString()
    });

    if (insertError) {
      setError(insertError.message);
      setIsUploading(false);
      return;
    }

    setMessage(`${file.name} 업로드가 완료되었습니다.`);
    setIsUploading(false);
    await loadDocuments();
  }

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeader title="문서 업로드" action={<Badge tone={isSupabaseConfigured ? "green" : "red"}>{isSupabaseConfigured ? "Supabase 연결" : "설정 필요"}</Badge>} />
        <div className="p-5">
          <PageIntro
            title="문서 업로드 및 인덱싱 요청"
            description="PDF, DOCX, TXT 파일을 등록하면 Supabase Storage documents bucket에 저장하고 documents 테이블에 업로드 상태를 기록합니다."
          />
          <div className="flex min-h-40 flex-col items-center justify-center rounded-md border-2 border-dashed border-line bg-field text-center">
            <Upload className="text-ocean" size={30} aria-hidden />
            <p className="mt-3 font-semibold text-ink">PDF, TXT, DOCX 문서를 업로드하세요</p>
            <p className="mt-1 text-sm text-slate-500">선택한 파일은 documents bucket에 저장되고 목록에 즉시 반영됩니다.</p>
            <label className={`mt-4 inline-flex cursor-pointer rounded-md px-4 py-2 text-sm font-semibold text-white ${isUploading ? "bg-slate-400" : "bg-ocean"}`}>
              {isUploading ? "업로드 중" : "파일 선택"}
              <input
                type="file"
                accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                disabled={isUploading}
                onChange={handleFileChange}
              />
            </label>
          </div>
          {message && <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </div>
      </Panel>
      <Panel>
        <SectionHeader title="문서 목록" action={<button type="button" onClick={() => void loadDocuments()} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700"><RefreshCcw size={14} aria-hidden />새로고침</button>} />
        <SupabaseDocumentTable documents={documentRows} isLoading={isLoading} />
      </Panel>
    </div>
  );
}

function ProjectPage() {
  const project = projects[1];
  const projectDocuments = documents.filter((document) => document.projectId === project.id);
  const timeline = [
    ["2026-05-15", "검색 품질 평가 기준 초안 작성"],
    ["2026-05-28", "킥오프 회의에서 MVP 범위 확정"],
    ["2026-06-04", "mock RAG 서비스 기반 화면 MVP 구성"]
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Panel>
        <SectionHeader title="프로젝트 개요" action={<Badge tone="green">{project.status}</Badge>} />
        <div className="space-y-4 p-5">
          <h2 className="text-xl font-bold text-ink">{project.name}</h2>
          <p className="text-sm leading-6 text-slate-600">신규 담당자가 업무 맥락, 결정사항, 문서 근거를 빠르게 파악할 수 있도록 구성한 지식베이스 구축 프로젝트입니다.</p>
          <Badge tone="green">{project.status}</Badge>
          <div className="flex flex-wrap gap-2">{tags.slice(1, 4).map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}</div>
        </div>
      </Panel>
      <Panel>
        <SectionHeader title="히스토리 요약 및 주요 결정사항" />
        <div className="space-y-4 p-5">
          <PageIntro
            title="프로젝트별 업무 맥락 상세"
            description="관련 문서, 질문/답변, 결정사항, 타임라인을 한 화면에서 확인하는 프로젝트 상세 화면입니다."
          />
          <p className="rounded-md border border-line bg-field p-4 text-sm leading-6 text-slate-700">
            MVP는 로그인, 대시보드, 문서 업로드, 검색, Q&A, 출처 표시, 관리자 인덱싱 상태를 우선 구현합니다. 실제 RAG 파이프라인은 mock 서비스 계층으로 시작하고, 향후 PostgreSQL + pgvector 또는 외부 Vector DB로 확장합니다.
          </p>
          <div className="space-y-3">
            {projectDocuments.map((document) => (
              <div key={document.id} className="rounded-md border border-line bg-white p-4">
                <p className="font-semibold text-ink">{document.title}</p>
                <p className="mt-2 text-sm text-slate-600">{document.summary}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-line bg-field p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">주요 결정사항</h3>
              <ul className="space-y-2 text-sm leading-6 text-slate-700">
                <li>근거가 부족한 질문에는 답변을 생성하지 않습니다.</li>
                <li>답변 본문과 출처 카드는 화면에서 명확히 분리합니다.</li>
                <li>인덱싱 실패 문서는 관리자 화면에서 재처리합니다.</li>
              </ul>
            </div>
            <div className="rounded-md border border-line bg-field p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">타임라인</h3>
              <div className="space-y-3">
                {timeline.map(([date, label]) => (
                  <div key={date} className="flex gap-3 text-sm">
                    <span className="w-24 font-semibold text-ocean">{date}</span>
                    <span className="text-slate-700">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function AdminPage() {
  const [documentRows, setDocumentRows] = useState<SupabaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDocuments() {
      if (!supabase) {
        setIsLoading(false);
        setError("Supabase 환경변수가 설정되지 않았습니다.");
        return;
      }

      const { data, error: loadError } = await supabase
        .from("documents")
        .select("id,title,file_path,file_type,status,created_at")
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
      } else {
        setDocumentRows(data ?? []);
      }

      setIsLoading(false);
    }

    void loadDocuments();
  }, []);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel>
        <SectionHeader title="인덱싱 상태" action={<Badge tone="blue">documents 테이블</Badge>} />
        <div className="p-5 pb-0">
          <PageIntro
            title="문서 인덱싱 운영 콘솔"
            description="이번 1단계에서는 업로드된 문서가 documents 테이블에 uploaded 상태로 저장되었는지 확인합니다."
          />
          {error && <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </div>
        <SupabaseDocumentTable documents={documentRows} isLoading={isLoading} />
      </Panel>
      <Panel>
        <SectionHeader title="관리자 알림" />
        <div className="space-y-3 p-5">
          <p className="rounded-md border border-line bg-field p-3 text-sm text-slate-700">OpenAI 임베딩과 답변 생성은 아직 연결하지 않았습니다.</p>
          <p className="rounded-md border border-line bg-field p-3 text-sm text-slate-700">다음 단계에서 추출, 청킹, 임베딩 작업 상태를 별도 테이블로 확장할 수 있습니다.</p>
        </div>
      </Panel>
    </div>
  );
}

function PageIntro({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-orange-100 bg-orange-50 px-4 py-3">
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function Distribution({ title, items }: { title: string; items: [string, number][] }) {
  const max = Math.max(...items.map(([, value]) => value));
  return (
    <Panel>
      <SectionHeader title={title} />
      <div className="space-y-3 p-5">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-slate-700">{label}</span>
              <span className="text-slate-500">{value}</span>
            </div>
            <div className="h-2 rounded bg-field">
              <div className="h-2 rounded bg-ocean" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Filters(props: { projectFilter: string; setProjectFilter: (value: string) => void; tagFilter: string; setTagFilter: (value: string) => void }) {
  return (
    <div className="grid gap-3 rounded-md border border-line bg-white p-3 md:grid-cols-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <Filter size={17} aria-hidden />
        필터
      </div>
      <select value={props.projectFilter} onChange={(event) => props.setProjectFilter(event.target.value)} className="h-10 rounded-md border border-line bg-field px-3 text-sm">
        <option value="">전체 프로젝트</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <select value={props.tagFilter} onChange={(event) => props.setTagFilter(event.target.value)} className="h-10 rounded-md border border-line bg-field px-3 text-sm">
        <option value="">전체 태그</option>
        {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
      </select>
    </div>
  );
}

function SupabaseDocumentTable({ documents, isLoading }: { documents: SupabaseDocument[]; isLoading: boolean }) {
  if (isLoading) {
    return <p className="p-5 text-sm text-slate-500">문서 목록을 불러오는 중입니다.</p>;
  }

  if (documents.length === 0) {
    return <p className="p-5 text-sm text-slate-500">아직 업로드된 문서가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-field text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3">문서명</th>
            <th className="px-5 py-3">파일 유형</th>
            <th className="px-5 py-3">Storage 경로</th>
            <th className="px-5 py-3">업로드 일시</th>
            <th className="px-5 py-3">상태</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id} className="border-t border-line">
              <td className="px-5 py-4 font-semibold text-ink">{document.title}</td>
              <td className="px-5 py-4 uppercase">{document.file_type}</td>
              <td className="max-w-[320px] truncate px-5 py-4 text-slate-600">{document.file_path}</td>
              <td className="px-5 py-4">{formatDateTime(document.created_at)}</td>
              <td className="px-5 py-4"><Badge tone={getStatusTone(document.status)}>{document.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentTable({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-field text-xs uppercase text-slate-500">
          <tr>
            <th className="px-5 py-3">문서명</th>
            <th className="px-5 py-3">유형</th>
            <th className="px-5 py-3">프로젝트</th>
            {!compact && <th className="px-5 py-3">태그</th>}
            <th className="px-5 py-3">업로더</th>
            <th className="px-5 py-3">업로드 일시</th>
            <th className="px-5 py-3">상태</th>
            {!compact && <th className="px-5 py-3">작업</th>}
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id} className="border-t border-line">
              <td className="px-5 py-4 font-semibold text-ink">{document.title}</td>
              <td className="px-5 py-4">{document.type}</td>
              <td className="px-5 py-4">{projects.find((project) => project.id === document.projectId)?.name}</td>
              {!compact && <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{document.tagIds.map((tagId) => <Badge key={tagId}>{tags.find((tag) => tag.id === tagId)?.name}</Badge>)}</div></td>}
              <td className="px-5 py-4">{document.uploader}</td>
              <td className="px-5 py-4">{document.uploadedAt}</td>
              <td className="px-5 py-4"><Badge tone={statusTone[document.status]}>{document.status}</Badge></td>
              {!compact && <td className="px-5 py-4">{document.status === "Failed" ? <button className="rounded-md border border-line px-3 py-2 text-xs font-semibold">재시도</button> : <button className="rounded-md border border-line px-3 py-2 text-xs font-semibold">상세</button>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
