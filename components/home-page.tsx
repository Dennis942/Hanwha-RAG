"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Filter,
  History,
  KeyRound,
  LayoutDashboard,
  Lock,
  MessageSquareText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { ChatbotPanel } from "@/components/chat/ChatbotPanel";
import { RecentHistoryList, type RecentHistoryItem } from "@/components/history/RecentHistoryList";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge, FieldLabel, Panel, SectionHeader } from "@/components/ui";
import { documents, projects, tags } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase, supabaseDiagnostics, type SupabaseDocument, type SupabaseProject } from "@/lib/supabase";
import type { ChangeEvent, ReactNode } from "react";

const statusTone = {
  uploaded: "blue",
  indexing: "amber",
  indexed: "green",
  failed: "red",
  Uploaded: "blue",
  Pending: "amber",
  Processing: "amber",
  Indexed: "green",
  Failed: "red",
  Reprocessing: "blue",
  Deleted: "neutral"
} as const;

const allowedDocumentExtensions = ["pdf", "txt", "docx"] as const;
const documentsBucketName = "documents";
const maxFileSizeBytes = 20 * 1024 * 1024;
const contentTypes: Record<(typeof allowedDocumentExtensions)[number], string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};
const projectStatuses = ["진행", "보류", "완료", "검토중"];
const projectCategories = ["토큰증권 플랫폼", "계약 관리 고도화", "감리/입찰", "MSP/클라우드", "뮤직카우", "NXT/NXG", "스테이블코인", "내부 업무개선", "기타"];
const documentCategories = ["결정사항", "회의록", "계약/협약", "보고자료", "제안서", "입찰/감리", "기술문서", "정책/규정", "운영/장애", "기타"];
const documentTypes = ["보고서", "회의록", "계약서", "제안서", "기술문서", "산출물", "이메일/메모", "기타"];
const defaultOwner = "미지정";
const defaultFilterOptions = { categories: documentCategories, documentTypes, tags: [] as string[], statuses: [] as string[] };

type UploadDebugInfo = {
  selectedFile?: string;
  selectedFileType?: string;
  selectedFileSize?: number;
  storageUploadStarted: boolean;
  bucketName: string;
  filePath?: string;
  registerStep?: string;
  registerResponseJson?: string;
  storagePath?: string;
  uploadErrorJson?: string;
  networkError?: {
    name?: string;
    message?: string;
    stack?: string;
  };
  registerStarted: boolean;
  registerErrorJson?: string;
};

type RegisterApiResponse = {
  ok: boolean;
  step?: string;
  message?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  bucketName?: string;
  filePath?: string;
  storagePath?: string;
  registerErrorJson?: string;
  networkError?: {
    name?: string;
    message?: string;
    stack?: string;
  };
};

type ApiErrorResponse = {
  message?: string;
  error?: {
    code?: string;
    message?: string;
    step?: string;
  };
};

type ChatSource = {
  documentId: string;
  documentTitle: string;
  filePath: string;
  projectId?: string | null;
  projectName?: string | null;
  category?: string | null;
  documentType?: string | null;
  tags?: string[];
  chunkIndex: number;
  similarity: number;
  content: string;
};

type ChatApiResponse = {
  ok: boolean;
  answer?: string;
  sources?: ChatSource[];
  diagnostics?: {
    filters?: Record<string, unknown>;
    searchedChunkCount?: number;
    indexedDocumentCount?: number;
  };
  message?: string;
};

type ChatLog = {
  id: string;
  question: string;
  answer: string;
  sources: unknown[];
  filters?: Record<string, unknown> | null;
  project_id?: string | null;
  project_name?: string | null;
  created_at: string;
};

type SearchResult = {
  document_id: string;
  title: string;
  project_id?: string | null;
  project_name?: string | null;
  category?: string | null;
  document_type?: string | null;
  tags?: string[];
  file_type: string;
  file_path: string;
  status: string;
  created_at?: string | null;
  description?: string | null;
  indexing_required?: boolean;
  matched_chunks: Array<{ chunk_index: number; content_preview: string; match_type: string }>;
};

type UploadMetadata = {
  projectId: string;
  category: string;
  documentType: string;
  tags: string;
  description: string;
};

function getStatusTone(status: string) {
  return statusTone[status as keyof typeof statusTone] ?? "neutral";
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    uploaded: "인덱싱 필요",
    indexing: "인덱싱 중",
    indexed: "인덱싱 완료",
    failed: "인덱싱 실패",
    Uploaded: "업로드됨",
    Pending: "대기",
    Processing: "처리 중",
    Indexed: "인덱싱 완료",
    Failed: "실패",
    Reprocessing: "재처리 중",
    Deleted: "삭제됨"
  };

  return labels[status] ?? status;
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function makeStoragePath(fileType: string) {
  return `uploads/${crypto.randomUUID()}.${fileType}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function stringifyDebugValue(value: unknown) {
  try {
    return JSON.stringify(value, Object.getOwnPropertyNames(value), 2);
  } catch {
    return String(value);
  }
}

function getNetworkError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    name: typeof error,
    message: stringifyDebugValue(error),
    stack: undefined
  };
}

function getApiErrorMessage(data: unknown, fallback: string) {
  const response = data as ApiErrorResponse | null;
  const message = response?.error?.message || response?.message || fallback;
  const code = response?.error?.code;

  return code ? `${message} (${code})` : message;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.filter(isNonEmptyString)));
}

async function loadDocumentFilterOptions() {
  const client = supabase as any;

  if (!client) {
    return defaultFilterOptions;
  }

  const { data } = await client
    .from("documents")
    .select("category,document_type,tags,status");

  const rows = (data ?? []) as any[];

  return {
    categories: uniqueStrings(rows.map((item) => item.category)),
    documentTypes: uniqueStrings(rows.map((item) => item.document_type)),
    tags: uniqueStrings(rows.flatMap((item) => (Array.isArray(item.tags) ? item.tags : []))),
    statuses: uniqueStrings(rows.map((item) => item.status))
  };
}

const nav = [
  { id: "dashboard", label: "홈", icon: LayoutDashboard },
  { id: "ask", label: "문서 Q&A", icon: MessageSquareText },
  { id: "search", label: "문서/업무 검색", icon: Search },
  { id: "documents", label: "문서 관리", icon: FileText },
  { id: "project", label: "프로젝트", icon: History },
  { id: "admin", label: "관리자", icon: ShieldCheck }
];

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [activePage, setActivePage] = useState("dashboard");
  const [question, setQuestion] = useState("RAG MVP에서 가장 먼저 구현해야 하는 화면은 무엇인가요?");
  const [searchQuery, setSearchQuery] = useState("RAG");
  const [projectFilter, setProjectFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [projectRows, setProjectRows] = useState<SupabaseProject[]>([]);
  const [recentChatLogs, setRecentChatLogs] = useState<ChatLog[]>([]);
  const [selectedChatLog, setSelectedChatLog] = useState<ChatLog | null>(null);
  const [questionResetToken, setQuestionResetToken] = useState(0);
  const [documentMetadataVersion, setDocumentMetadataVersion] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    void loadProjects();
    void loadRecentChatLogs();
  }, [isLoggedIn]);

  async function loadProjects() {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();

      if (data.ok) {
        setProjectRows(data.projects ?? []);
      }
    } catch {
      setProjectRows([]);
    }
  }

  async function loadRecentChatLogs() {
    try {
      const response = await fetch("/api/chat");
      const data = await response.json();

      if (data.ok) {
        setRecentChatLogs(data.logs ?? []);
      }
    } catch {
      setRecentChatLogs([]);
    }
  }

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
    setSelectedChatLog(null);
    setActivePage("ask");
  }

  function openHistory(log: ChatLog) {
    setSelectedChatLog(log);
    setQuestion(log.question);
    setActivePage("ask");
  }

  function startNewQuestionSession() {
    setQuestion("");
    setSelectedChatLog(null);
    setQuestionResetToken((current) => current + 1);
    setActivePage("ask");
  }

  async function handleDocumentMetadataChanged() {
    setDocumentMetadataVersion((current) => current + 1);
    await loadProjects();
  }

  if (!isLoggedIn) {
    return <LoginPage loginError={loginError} onLogin={handleLogin} />;
  }

  const currentPageLabel = nav.find((item) => item.id === activePage)?.label ?? "홈";

  return (
    <AppLayout
      activePage={activePage}
      currentPageLabel={currentPageLabel}
      navItems={nav}
      onNavigate={setActivePage}
      onUploadClick={() => setActivePage("documents")}
      sidebarContent={
        <RecentHistoryList
          logs={recentChatLogs as RecentHistoryItem[]}
          onOpenHistory={(log) => openHistory(log as ChatLog)}
          onOpenQuestion={openQuestion}
        />
      }
    >
          {activePage === "dashboard" && (
            <ChatbotPanel
              question={question}
              onOpenQuestion={openQuestion}
              onQuestionChange={setQuestion}
              onSearchClick={() => setActivePage("search")}
              onSubmitQuestion={() => setActivePage("ask")}
              onUploadClick={() => setActivePage("documents")}
            />
          )}
          {activePage === "ask" && (
            <AskPage
              projectFilter={projectFilter}
              question={question}
              setProjectFilter={setProjectFilter}
              setQuestion={setQuestion}
              setTagFilter={setTagFilter}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              projects={projectRows}
              historyLog={selectedChatLog}
              onNewQuestion={startNewQuestionSession}
              onRefreshHistory={loadRecentChatLogs}
              tagFilter={tagFilter}
              resetToken={questionResetToken}
              documentMetadataVersion={documentMetadataVersion}
            />
          )}
          {activePage === "search" && (
            <SearchPage
              projectFilter={projectFilter}
              searchQuery={searchQuery}
              setProjectFilter={setProjectFilter}
              setSearchQuery={setSearchQuery}
              setTagFilter={setTagFilter}
              setTypeFilter={setTypeFilter}
              projects={projectRows}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              tagFilter={tagFilter}
              typeFilter={typeFilter}
              setQuestion={setQuestion}
              setActivePage={setActivePage}
              documentMetadataVersion={documentMetadataVersion}
              onStartQuestion={startNewQuestionSession}
            />
          )}
          {activePage === "documents" && <DocumentsPage projects={projectRows} onProjectsChanged={handleDocumentMetadataChanged} />}
          {activePage === "project" && <ProjectPage projects={projectRows} onProjectsChanged={loadProjects} />}
          {activePage === "admin" && <AdminPage projects={projectRows} />}
    </AppLayout>
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
            {["문서 등록", "문서 Q&A", "출처 검증"].map((item) => (
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

function AskPage(props: {
  projectFilter: string;
  question: string;
  categoryFilter: string;
  typeFilter: string;
  setProjectFilter: (value: string) => void;
  setQuestion: (value: string) => void;
  setCategoryFilter: (value: string) => void;
  setTypeFilter: (value: string) => void;
  setTagFilter: (value: string) => void;
  projects: SupabaseProject[];
  historyLog: ChatLog | null;
  onNewQuestion: () => void;
  onRefreshHistory: () => Promise<void> | void;
  tagFilter: string;
  resetToken: number;
  documentMetadataVersion: number;
}) {
  const { categoryFilter, documentMetadataVersion, historyLog, onNewQuestion, onRefreshHistory, projectFilter, projects, question, resetToken, setCategoryFilter, setProjectFilter, setQuestion, setTagFilter, setTypeFilter, tagFilter, typeFilter } = props;
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [diagnostics, setDiagnostics] = useState<ChatApiResponse["diagnostics"] | null>(null);
  const [filterOptions, setFilterOptions] = useState({ categories: documentCategories, documentTypes, tags: [] as string[] });
  const selectedProject = projects.find((project) => project.id === projectFilter);

  useEffect(() => {
    if (!historyLog) {
      return;
    }

    setAnswer(historyLog.answer);
    setSources((historyLog.sources ?? []) as ChatSource[]);
    setAskError("");
    setDiagnostics(null);
  }, [historyLog]);

  useEffect(() => {
    setAnswer("");
    setSources([]);
    setAskError("");
    setDiagnostics(null);
  }, [resetToken]);

  useEffect(() => {
    async function loadFilterOptions() {
      const options = await loadDocumentFilterOptions();

      setFilterOptions({
        categories: options.categories.length > 0 ? options.categories : documentCategories,
        documentTypes: options.documentTypes.length > 0 ? options.documentTypes : documentTypes,
        tags: options.tags
      });
    }

    void loadFilterOptions();
  }, [documentMetadataVersion]);

  async function askQuestion() {
    const normalizedQuestion = question.trim();

    if (!normalizedQuestion) {
      setAskError("질문을 입력해주세요.");
      return;
    }

    setIsAsking(true);
    setAskError("");
    setAnswer("");
    setSources([]);
    setDiagnostics(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: normalizedQuestion,
          filters: {
            project_id: projectFilter || null,
            project_name: selectedProject?.name ?? null,
            category: categoryFilter || null,
            document_type: typeFilter || null,
            tag: tagFilter || null
          }
        })
      });
      const responseText = await response.text();
      let responseData: ChatApiResponse;

      try {
        responseData = JSON.parse(responseText) as ChatApiResponse;
      } catch {
        responseData = {
          ok: false,
          message: responseText || `질문 API가 ${response.status} 상태를 반환했습니다.`
        };
      }

      if (!response.ok || !responseData.ok) {
        throw new Error(getApiErrorMessage(responseData, "질문 처리에 실패했습니다."));
      }

      setAnswer(responseData.answer ?? "등록된 문서에서 확인되지 않습니다.");
      setSources(responseData.sources ?? []);
      setDiagnostics(responseData.diagnostics ?? null);
      await onRefreshHistory();
    } catch (error) {
      setAskError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel>
        <SectionHeader title="문서 Q&A" action={<Badge tone="amber">출처 기반 답변</Badge>} />
        <div className="space-y-4 p-5">
          <PageIntro
            title="질문하면 관련 문서와 근거를 함께 보여줍니다"
            description="추천 질문, 최근 히스토리, 입력창에서 넘어온 질문은 이 화면에서 답변 본문과 citation 카드로 분리되어 표시됩니다."
          />
          {historyLog ? (
            <div className="rounded-md border border-line bg-field p-4">
              <p className="text-xs font-semibold text-slate-500">히스토리 상세</p>
              <p className="mt-2 font-semibold text-ink">{historyLog.question}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(historyLog.created_at)}</p>
            </div>
          ) : (
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-36 w-full rounded-md border border-line bg-field p-4 text-base" />
          )}
          <Filters
            projectFilter={projectFilter}
            setProjectFilter={setProjectFilter}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            projects={projects}
            categories={filterOptions.categories}
            documentTypes={filterOptions.documentTypes}
            tags={filterOptions.tags}
          />
          {sources.length === 0 && answer && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              선택한 필터에 해당하는 인덱싱 완료 문서가 없습니다. 필터를 해제하거나 문서를 인덱싱한 뒤 다시 질문해주세요.
              <span className="mt-2 block text-xs">현재 필터: {JSON.stringify(diagnostics?.filters ?? {})}</span>
              <span className="block text-xs">인덱싱 완료 문서 수: {diagnostics?.indexedDocumentCount ?? 0} · 검색된 chunk 수: {diagnostics?.searchedChunkCount ?? 0}</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => void askQuestion()}
            disabled={isAsking || Boolean(historyLog)}
            className="flex h-11 items-center gap-2 rounded-md bg-ocean px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <MessageSquareText size={18} aria-hidden />
            {isAsking ? "답변 생성 중" : "문서 기반 질문하기"}
          </button>
          {historyLog && (
            <div className="flex gap-2">
              <button type="button" onClick={onNewQuestion} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-700">새 질문 시작</button>
            </div>
          )}
          {askError && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{askError}</p>}
          <div className="rounded-md border border-line bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-ink">답변</h3>
              <Badge tone={sources.length === 0 ? "red" : "green"}>{sources.length === 0 ? "no source" : `${sources.length} sources`}</Badge>
            </div>
            {answer ? <p className="whitespace-pre-line leading-7 text-slate-700">{answer}</p> : <p className="rounded-md bg-field p-4 font-semibold text-slate-600">질문을 입력하고 실행하면 등록된 문서 기준으로 답변합니다.</p>}
          </div>
          {sources.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">답변 출처</h3>
              {sources.map((source) => (
                <SourceCard key={`${source.documentId}-${source.chunkIndex}`} source={source} />
              ))}
            </div>
          )}
        </div>
      </Panel>
      <Panel>
        <SectionHeader title="출처 및 관련 문서" />
        <div className="space-y-4 p-5">
          {sources.length === 0 && <p className="text-sm text-slate-500">아직 참조한 문서 chunk가 없습니다.</p>}
          {sources.map((source) => (
            <SourceCard key={`side-${source.documentId}-${source.chunkIndex}`} source={source} />
          ))}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">후속 질문 추천</h3>
            <div className="space-y-2">
              {["이 문서들의 핵심 내용을 요약해줘", "근거가 되는 파일 경로를 알려줘", "업로드된 문서에서 확인 가능한 리스크를 찾아줘"].map((item) => (
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

function SourceCard({ source }: { source: ChatSource }) {
  return (
    <div className="rounded-md border border-line bg-field p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{source.documentTitle}</p>
        <Badge tone="blue">{Math.round(source.similarity * 100)}%</Badge>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        <Badge tone={source.projectName ? "blue" : "neutral"}>{source.projectName ?? "미분류"}</Badge>
        {source.category && <Badge tone="amber">{source.category}</Badge>}
        {source.documentType && <Badge>{source.documentType}</Badge>}
        {(source.tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}
      </div>
      <p className="break-all text-xs font-semibold text-slate-500">{source.filePath}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">chunk #{source.chunkIndex}</p>
      <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-700">{source.content}</p>
    </div>
  );
}

function SearchPage(props: {
  projectFilter: string;
  searchQuery: string;
  setProjectFilter: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setTagFilter: (value: string) => void;
  setTypeFilter: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  projects: SupabaseProject[];
  setQuestion: (value: string) => void;
  setActivePage: (value: string) => void;
  tagFilter: string;
  typeFilter: string;
  documentMetadataVersion: number;
  onStartQuestion: () => void;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filterOptions, setFilterOptions] = useState(defaultFilterOptions);
  const selectedProject = props.projects.find((project) => project.id === props.projectFilter);

  useEffect(() => {
    async function refreshFilters() {
      const options = await loadDocumentFilterOptions();

      setFilterOptions({
        categories: options.categories.length > 0 ? options.categories : documentCategories,
        documentTypes: options.documentTypes.length > 0 ? options.documentTypes : documentTypes,
        tags: options.tags,
        statuses: options.statuses
      });
    }

    void refreshFilters();
  }, [props.documentMetadataVersion]);

  async function runSearch() {
    setIsSearching(true);
    setMessage("");

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: props.searchQuery,
          project_id: props.projectFilter || null,
          project_name: selectedProject?.name ?? null,
          category: props.categoryFilter || null,
          document_type: props.typeFilter || null,
          tag: props.tagFilter || null,
          status: statusFilter || null
        })
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(getApiErrorMessage(data, "검색에 실패했습니다."));
      }

      setResults(data.results ?? []);

      if ((data.results ?? []).length === 0) {
        setMessage("현재 필터에 해당하는 인덱싱 완료 문서가 없거나, 분류가 수정되었지만 아직 재인덱싱되지 않았습니다. 업무검색은 업로드 문서명과 인덱싱된 본문을 기준으로 검색합니다.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <Panel>
      <SectionHeader title="문서/업무 검색" action={<Badge tone="blue">문서 metadata + chunk 검색</Badge>} />
      <div className="space-y-4 p-5">
        <PageIntro
          title="업로드된 문서와 근거 chunk를 찾습니다"
          description="문서/업무 검색은 최신 documents metadata와 인덱싱된 본문 chunk를 함께 확인하는 화면입니다."
        />
        <div className="flex flex-col gap-3 lg:flex-row">
          <input value={props.searchQuery} onChange={(event) => props.setSearchQuery(event.target.value)} placeholder="프로젝트, 계약 조건, 결정사항 검색" className="h-11 flex-1 rounded-md border border-line bg-field px-3" />
          <button type="button" onClick={() => void runSearch()} className="h-11 rounded-md bg-ocean px-4 font-semibold text-white disabled:bg-slate-400" disabled={isSearching}>{isSearching ? "검색 중" : "검색"}</button>
        </div>
        <Filters
          projectFilter={props.projectFilter}
          setProjectFilter={props.setProjectFilter}
          categoryFilter={props.categoryFilter}
          setCategoryFilter={props.setCategoryFilter}
          typeFilter={props.typeFilter}
          setTypeFilter={props.setTypeFilter}
            tagFilter={props.tagFilter}
            setTagFilter={props.setTagFilter}
            projects={props.projects}
            categories={filterOptions.categories}
            documentTypes={filterOptions.documentTypes}
            tags={filterOptions.tags}
          />
        <div className="grid gap-3 rounded-md border border-line bg-white p-3 md:grid-cols-[1fr_2fr]">
          <span className="flex items-center text-sm font-semibold text-slate-600">인덱싱 상태</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-md border border-line bg-field px-3 text-sm">
            <option value="">전체 상태</option>
            {(filterOptions.statuses.length > 0 ? filterOptions.statuses : ["uploaded", "indexed", "failed"]).map((status) => <option key={status} value={status}>{getStatusLabel(status)}</option>)}
          </select>
        </div>
        {message && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
        <div className="space-y-3">
          {results.map((document) => (
            <article key={document.document_id} className="rounded-md border border-line bg-white p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <p className="font-semibold text-ink">{document.title}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{document.file_path}</p>
                  {document.description && <p className="mt-2 text-sm leading-6 text-slate-600">{document.description}</p>}
                </div>
                <Badge tone={getStatusTone(document.status)}>{getStatusLabel(document.status)}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge tone={document.project_name ? "blue" : "neutral"}>{document.project_name ?? "미분류"}</Badge>
                {document.category && <Badge tone="amber">{document.category}</Badge>}
                {document.document_type && <Badge>{document.document_type}</Badge>}
                {(document.tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}
              </div>
              {document.indexing_required && <p className="mt-3 rounded-md bg-field p-3 text-sm text-slate-600">분류가 수정되었거나 아직 인덱싱되지 않았습니다. 관리자 화면에서 인덱싱을 실행하면 최신 분류가 chunk metadata에 반영됩니다.</p>}
              {document.matched_chunks.length > 0 && (
                <div className="mt-3 space-y-2">
                  {document.matched_chunks.map((chunk) => (
                    <div key={chunk.chunk_index} className="rounded-md bg-field p-3 text-sm text-slate-700">
                      <p className="text-xs font-semibold text-slate-500">chunk #{chunk.chunk_index}</p>
                      <p className="mt-1 leading-6">{chunk.content_preview}</p>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  props.onStartQuestion();
                  props.setQuestion(`${document.title} 기준으로 핵심 내용을 알려줘`);
                  props.setProjectFilter(document.project_id ?? "");
                  props.setActivePage("ask");
                }}
                className="mt-3 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700"
              >
                이 문서 기준으로 문서 Q&A
              </button>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function DocumentsPage({ projects, onProjectsChanged }: { projects: SupabaseProject[]; onProjectsChanged: () => Promise<void> | void }) {
  const [documentRows, setDocumentRows] = useState<SupabaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState<UploadMetadata>({
    projectId: "",
    category: documentCategories[0],
    documentType: documentTypes[0],
    tags: "",
    description: ""
  });
  const [editingDocument, setEditingDocument] = useState<SupabaseDocument | null>(null);
  const [uploadDebugInfo, setUploadDebugInfo] = useState<UploadDebugInfo>({
    storageUploadStarted: false,
    bucketName: documentsBucketName,
    registerStarted: false
  });

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function loadDocuments() {
    const client = supabase as any;

    if (!client) {
      setIsLoading(false);
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }

    setIsLoading(true);
    setError("");

    const { data, error: loadError } = await client
      .from("documents")
      .select("id,title,file_path,file_type,file_size,project_id,project_name,category,document_type,tags,description,status,error_message,created_at,updated_at")
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

    const client = supabase as any;

    if (!client) {
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }

    const fileType = getFileExtension(file.name);

    if (!allowedDocumentExtensions.includes(fileType as (typeof allowedDocumentExtensions)[number])) {
      setError("PDF, TXT, DOCX 파일만 업로드할 수 있습니다.");
      setMessage("");
      return;
    }

    if (file.size > maxFileSizeBytes) {
      setError("파일은 20MB 이하만 업로드할 수 있습니다.");
      setMessage("");
      setUploadDebugInfo((current) => ({
        ...current,
        selectedFile: file.name,
        selectedFileType: fileType.toUpperCase(),
        selectedFileSize: file.size,
        registerStep: "validation"
      }));
      return;
    }

    setIsUploading(true);
    setError("");
    setMessage("");

    const filePath = makeStoragePath(fileType);
    const selectedProject = projects.find((project) => project.id === metadata.projectId);

    setUploadDebugInfo({
      selectedFile: file.name,
      selectedFileType: fileType.toUpperCase(),
      selectedFileSize: file.size,
      storageUploadStarted: true,
      bucketName: documentsBucketName,
      filePath,
      registerStarted: false
    });

    try {
      const { data: uploadData, error: storageError } = await client.storage
        .from(documentsBucketName)
        .upload(filePath, file, {
          cacheControl: "3600",
          contentType: contentTypes[fileType as (typeof allowedDocumentExtensions)[number]],
          metadata: {
            title: file.name,
            originalFileName: file.name,
            fileSize: String(file.size)
          },
          upsert: false
        });

      if (storageError) {
        const uploadErrorJson = stringifyDebugValue(storageError);
        setUploadDebugInfo((current) => ({
          ...current,
          registerStep: "storage-upload-failed",
          storagePath: undefined,
          uploadErrorJson
        }));
        setError(storageError.message || uploadErrorJson);
        setIsUploading(false);
        return;
      }

      const storagePath = uploadData?.path ?? filePath;

      setUploadDebugInfo((current) => ({
        ...current,
        registerStep: "storage-upload-complete",
        storagePath,
        registerStarted: true
      }));

      const registerResponse = await fetch("/api/documents/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: file.name,
          file_path: storagePath,
          file_type: fileType.toUpperCase(),
          file_size: file.size,
          project_id: selectedProject?.id ?? null,
          project_name: selectedProject?.name ?? null,
          category: metadata.category,
          document_type: metadata.documentType,
          tags: metadata.tags,
          description: metadata.description
        })
      });
      const registerResponseText = await registerResponse.text();
      let registerData: RegisterApiResponse;

      try {
        registerData = JSON.parse(registerResponseText) as RegisterApiResponse;
      } catch {
        registerData = {
          ok: false,
          step: "api-response",
          message: registerResponseText || `문서 등록 API가 ${registerResponse.status} 상태를 반환했습니다.`,
          registerErrorJson: registerResponseText
        };
      }

      if (!registerResponse.ok || !registerData.ok) {
        setUploadDebugInfo((current) => ({
          ...current,
          bucketName: registerData.bucketName ?? current.bucketName,
          filePath: registerData.filePath ?? current.filePath,
          selectedFile: registerData.fileName ?? current.selectedFile,
          selectedFileType: registerData.fileType ?? current.selectedFileType,
          selectedFileSize: registerData.fileSize ?? current.selectedFileSize,
          registerStep: registerData.step,
          registerResponseJson: stringifyDebugValue(registerData),
          storagePath: registerData.storagePath ?? current.storagePath,
          networkError: registerData.networkError,
          registerStarted: true,
          registerErrorJson: registerData.registerErrorJson
        }));
        setError(getApiErrorMessage(registerData, "문서 metadata 저장에 실패했습니다."));
        setIsUploading(false);
        return;
      }

      setUploadDebugInfo((current) => ({
        ...current,
        bucketName: registerData.bucketName ?? current.bucketName,
        filePath: registerData.filePath ?? current.filePath,
        selectedFile: registerData.fileName ?? current.selectedFile,
        selectedFileType: registerData.fileType ?? current.selectedFileType,
        selectedFileSize: registerData.fileSize ?? current.selectedFileSize,
        registerStep: "documents-register-complete",
        registerResponseJson: stringifyDebugValue(registerData),
        storagePath: registerData.storagePath ?? current.storagePath,
        registerStarted: true
      }));
      setMessage(`${file.name} 업로드가 완료되었습니다. 저장 경로: ${registerData.storagePath ?? storagePath}`);
      setIsUploading(false);
      await loadDocuments();
      await onProjectsChanged();
    } catch (apiException) {
      const networkError = getNetworkError(apiException);
      setUploadDebugInfo((current) => ({
        ...current,
        registerStep: "network-error",
        networkError,
        registerResponseJson: stringifyDebugValue(apiException),
        uploadErrorJson: stringifyDebugValue(apiException)
      }));
      setError(networkError.message || "업로드 중 네트워크 오류가 발생했습니다.");
      setIsUploading(false);
    }
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
          <div className="mb-4 grid gap-3 rounded-md border border-line bg-white p-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              프로젝트
              <select value={metadata.projectId} onChange={(event) => setMetadata((current) => ({ ...current, projectId: event.target.value }))} className="mt-2 h-10 w-full rounded-md border border-line bg-field px-3 font-normal">
                <option value="">프로젝트 없음 / 미분류</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              업무 카테고리
              <select value={metadata.category} onChange={(event) => setMetadata((current) => ({ ...current, category: event.target.value }))} className="mt-2 h-10 w-full rounded-md border border-line bg-field px-3 font-normal">
                {documentCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              문서 유형
              <select value={metadata.documentType} onChange={(event) => setMetadata((current) => ({ ...current, documentType: event.target.value }))} className="mt-2 h-10 w-full rounded-md border border-line bg-field px-3 font-normal">
                {documentTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              태그
              <input value={metadata.tags} onChange={(event) => setMetadata((current) => ({ ...current, tags: event.target.value }))} placeholder="토큰증권, 예탁결제원, 결정사항" className="mt-2 h-10 w-full rounded-md border border-line bg-field px-3 font-normal" />
            </label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              문서 설명/메모
              <textarea value={metadata.description} onChange={(event) => setMetadata((current) => ({ ...current, description: event.target.value }))} className="mt-2 min-h-20 w-full rounded-md border border-line bg-field p-3 font-normal" />
            </label>
          </div>
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
          <UploadDiagnostics debugInfo={uploadDebugInfo} />
        </div>
      </Panel>
      <Panel>
        <SectionHeader title="문서 목록" action={<button type="button" onClick={() => void loadDocuments()} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700"><RefreshCcw size={14} aria-hidden />새로고침</button>} />
        <SupabaseDocumentTable
          documents={documentRows}
          isLoading={isLoading}
          projects={projects}
          onEditDocument={setEditingDocument}
        />
      </Panel>
      {editingDocument && (
        <DocumentClassificationEditor
          document={editingDocument}
          projects={projects}
          onClose={() => setEditingDocument(null)}
          onSaved={async () => {
            setEditingDocument(null);
            setMessage("문서 분류가 저장되었습니다. 분류 변경으로 재인덱싱이 필요합니다.");
            await loadDocuments();
            await onProjectsChanged();
          }}
        />
      )}
    </div>
  );
}

function ProjectPage({ projects, onProjectsChanged }: { projects: SupabaseProject[]; onProjectsChanged: () => Promise<void> | void }) {
  const [selectedProject, setSelectedProject] = useState<SupabaseProject | null>(projects[0] ?? null);
  const [allProjectDocuments, setAllProjectDocuments] = useState<SupabaseDocument[]>([]);
  const [allProjectChatLogs, setAllProjectChatLogs] = useState<ChatLog[]>([]);
  const [documentsForProject, setDocumentsForProject] = useState<SupabaseDocument[]>([]);
  const [chatLogsForProject, setChatLogsForProject] = useState<ChatLog[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "진행",
    category: projectCategories[0],
    tags: "",
    objective: "",
    owner: defaultOwner,
    start_date: "",
    end_date: "",
    memo: "",
    decisions: "",
    timeline: ""
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      setSelectedProject(projects[0]);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (!selectedProject || !supabase) {
      return;
    }

    void loadProjectCounts();
    void loadProjectRelatedData(selectedProject.id);
  }, [selectedProject]);

  async function loadProjectCounts() {
    const client = supabase as any;

    if (!client) {
      return;
    }

    const { data: docs } = await client
      .from("documents")
      .select("id,project_id,status,title,file_path,file_type,created_at");
    const { data: logs } = await client
      .from("chat_logs")
      .select("*");

    setAllProjectDocuments((docs ?? []) as SupabaseDocument[]);
    setAllProjectChatLogs((logs ?? []) as ChatLog[]);
  }

  function getProjectCounts(projectId: string) {
    const docs = allProjectDocuments.filter((document) => document.project_id === projectId);
    const logs = allProjectChatLogs.filter((log) => log.project_id === projectId);

    return {
      documentCount: docs.length,
      indexedCount: docs.filter((document) => document.status === "indexed").length,
      recentQuestionCount: logs.length
    };
  }

  async function loadProjectRelatedData(projectId: string) {
    const client = supabase as any;

    if (!client) {
      return;
    }

    const { data: docs } = await client
      .from("documents")
      .select("id,title,file_path,file_type,file_size,project_id,project_name,category,document_type,tags,description,status,error_message,created_at,updated_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    const { data: logs } = await client
      .from("chat_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    setDocumentsForProject((docs ?? []) as SupabaseDocument[]);
    setChatLogsForProject((logs ?? []) as ChatLog[]);
  }

  function fillForm(project: SupabaseProject) {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status ?? "진행",
      category: project.category ?? projectCategories[0],
      tags: (project.tags ?? []).join(", "),
      objective: project.objective ?? "",
      owner: project.owner ?? defaultOwner,
      start_date: project.start_date ?? "",
      end_date: project.end_date ?? "",
      memo: project.memo ?? "",
      decisions: JSON.stringify(project.decisions ?? [], null, 2),
      timeline: JSON.stringify(project.timeline ?? [], null, 2)
    });
    setShowForm(true);
  }

  async function saveProject() {
    setError("");

    try {
      const body = {
        ...form,
        tags: form.tags,
        decisions: JSON.parse(form.decisions || "[]"),
        timeline: JSON.parse(form.timeline || "[]")
      };
      const isEditing = Boolean(editingProjectId);
      const response = await fetch(isEditing ? `/api/projects/${editingProjectId}` : "/api/projects", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(getApiErrorMessage(data, "프로젝트 저장에 실패했습니다. 담당자/담당부서 값을 확인해주세요."));
      }

      setSelectedProject(data.project);
      setShowForm(false);
      setEditingProjectId("");
      await onProjectsChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Panel>
        <SectionHeader title="프로젝트 목록" action={<button type="button" onClick={() => {
          setSelectedProject(null);
          setEditingProjectId("");
          setForm({ name: "", description: "", status: "진행", category: projectCategories[0], tags: "", objective: "", owner: defaultOwner, start_date: "", end_date: "", memo: "", decisions: "", timeline: "" });
          setShowForm(true);
        }} className="rounded-md bg-ocean px-3 py-2 text-xs font-semibold text-white">새 프로젝트 만들기</button>} />
        <div className="space-y-4 p-5">
          {projects.length === 0 && <p className="rounded-md border border-line bg-field p-4 text-sm text-slate-600">아직 생성된 프로젝트가 없습니다. 새 프로젝트를 만들어보세요.</p>}
          {projects.map((project) => (
            <ProjectListItem key={project.id} project={project} counts={getProjectCounts(project.id)} onSelect={() => setSelectedProject(project)} />
          ))}
        </div>
      </Panel>
      <Panel>
        <SectionHeader title={showForm ? "프로젝트 정보 입력" : "프로젝트 상세"} action={selectedProject && !showForm ? <button type="button" onClick={() => fillForm(selectedProject)} className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700">프로젝트 정보 수정</button> : undefined} />
        <div className="space-y-4 p-5">
          {showForm ? (
            <div className="grid gap-3 md:grid-cols-2">
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="프로젝트명" className="h-10 rounded-md border border-line bg-field px-3" />
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="h-10 rounded-md border border-line bg-field px-3">
                {projectStatuses.map((status) => <option key={status}>{status}</option>)}
              </select>
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="h-10 rounded-md border border-line bg-field px-3">
                {projectCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
              <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="태그" className="h-10 rounded-md border border-line bg-field px-3" />
              <label className="text-sm font-semibold text-slate-700">
                담당자/담당부서
                <input value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} placeholder={defaultOwner} className="mt-2 h-10 w-full rounded-md border border-line bg-field px-3 font-normal" />
              </label>
              <input value={form.objective} onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} placeholder="주요 목적" className="h-10 rounded-md border border-line bg-field px-3" />
              <input type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} className="h-10 rounded-md border border-line bg-field px-3" />
              <input type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} className="h-10 rounded-md border border-line bg-field px-3" />
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="프로젝트 설명" className="min-h-24 rounded-md border border-line bg-field p-3 md:col-span-2" />
              <textarea value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} placeholder="메모" className="min-h-20 rounded-md border border-line bg-field p-3 md:col-span-2" />
              <textarea value={form.decisions} onChange={(event) => setForm((current) => ({ ...current, decisions: event.target.value }))} placeholder='주요 결정사항 JSON 예: [{"date":"2026-06-08","text":"범위 확정"}]' className="min-h-20 rounded-md border border-line bg-field p-3 md:col-span-2" />
              <textarea value={form.timeline} onChange={(event) => setForm((current) => ({ ...current, timeline: event.target.value }))} placeholder='타임라인 JSON 예: [{"date":"2026-06-08","text":"킥오프"}]' className="min-h-20 rounded-md border border-line bg-field p-3 md:col-span-2" />
              {error && <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 md:col-span-2">{error}</p>}
              <button type="button" onClick={() => void saveProject()} className="rounded-md bg-ocean px-4 py-2 text-sm font-semibold text-white">저장</button>
            </div>
          ) : selectedProject ? (
            <div className="space-y-4">
              <PageIntro title={selectedProject.name} description={selectedProject.description ?? "프로젝트 설명이 없습니다."} />
              <div className="grid gap-3 md:grid-cols-2">
                <InfoBox label="상태" value={selectedProject.status ?? "진행"} />
                <InfoBox label="카테고리" value={selectedProject.category ?? "-"} />
                <InfoBox label="담당자/부서" value={selectedProject.owner ?? "-"} />
                <InfoBox label="기간" value={`${selectedProject.start_date ?? "-"} ~ ${selectedProject.end_date ?? "-"}`} />
                <InfoBox label="주요 목적" value={selectedProject.objective ?? "-"} />
                <InfoBox label="메모" value={selectedProject.memo ?? "-"} />
              </div>
              <div className="flex flex-wrap gap-1">{(selectedProject.tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>
              <ProjectJsonList title="주요 결정사항" items={selectedProject.decisions ?? []} />
              <ProjectJsonList title="타임라인" items={selectedProject.timeline ?? []} />
              <ProjectRelatedSection title="이 프로젝트의 문서 목록" empty="연결된 문서가 없습니다.">
                {documentsForProject.map((document) => (
                  <div key={document.id} className="rounded-md border border-line bg-field p-3">
                    <p className="font-semibold text-ink">{document.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{document.category ?? "-"} · {document.document_type ?? "-"} · {getStatusLabel(document.status)}</p>
                  </div>
                ))}
              </ProjectRelatedSection>
              <ProjectRelatedSection title="이 프로젝트 관련 질문 이력" empty="아직 질문 이력이 없습니다.">
                {chatLogsForProject.map((log) => (
                  <div key={log.id} className="rounded-md border border-line bg-field p-3">
                    <p className="font-semibold text-ink">{log.question}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
                  </div>
                ))}
              </ProjectRelatedSection>
            </div>
          ) : (
            <p className="rounded-md border border-line bg-field p-4 text-sm text-slate-600">프로젝트를 선택하거나 새 프로젝트를 만들어보세요.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-field p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-ink">{value}</p>
    </div>
  );
}

function ProjectListItem({
  project,
  counts,
  onSelect
}: {
  project: SupabaseProject;
  counts: { documentCount: number; indexedCount: number; recentQuestionCount: number };
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="block w-full rounded-md border border-line bg-white p-4 text-left hover:border-ocean">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">{project.name}</p>
        <Badge tone="green">{project.status ?? "진행"}</Badge>
      </div>
      <p className="line-clamp-2 text-sm text-slate-600">{project.description ?? "설명 없음"}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {project.category && <Badge tone="amber">{project.category}</Badge>}
        {(project.tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
        <span>문서 {counts.documentCount}</span>
        <span>완료 {counts.indexedCount}</span>
        <span>질문 {counts.recentQuestionCount}</span>
      </div>
      <p className="mt-3 text-xs text-slate-500">생성 {project.created_at ? formatDateTime(project.created_at) : "-"} · 수정 {project.updated_at ? formatDateTime(project.updated_at) : "-"}</p>
      <span className="mt-3 inline-block rounded-md border border-line px-3 py-1 text-xs font-semibold text-slate-700">상세 보기</span>
    </button>
  );
}

function ProjectJsonList({ title, items }: { title: string; items: Array<{ date?: string; text?: string }> }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {items.length === 0 && <p className="text-sm text-slate-500">등록된 내용이 없습니다.</p>}
      {items.map((item, index) => (
        <p key={`${item.date}-${index}`} className="text-sm leading-6 text-slate-700">{item.date ? `${item.date} · ` : ""}{item.text}</p>
      ))}
    </div>
  );
}

function ProjectRelatedSection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];

  return (
    <div className="rounded-md border border-line bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : <div className="space-y-2">{children}</div>}
    </div>
  );
}

function AdminPage({ projects }: { projects: SupabaseProject[] }) {
  const [documentRows, setDocumentRows] = useState<SupabaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [indexingDocumentId, setIndexingDocumentId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadDocuments() {
    const client = supabase as any;

    if (!client) {
      setIsLoading(false);
      setError("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }

    setIsLoading(true);

    const { data, error: loadError } = await client
      .from("documents")
      .select("id,title,file_path,file_type,file_size,project_id,project_name,category,document_type,tags,description,status,error_message,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setDocumentRows(data ?? []);
      setError("");
    }

    setIsLoading(false);
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function runIndexing(documentId: string) {
    setIndexingDocumentId(documentId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/documents/index", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ documentId })
      });
      const responseData = await response.json();

      if (!response.ok || !responseData.ok) {
        throw new Error(getApiErrorMessage(responseData, "인덱싱 실행에 실패했습니다."));
      }

      const result = responseData.results?.[0];

      if (result?.status === "failed") {
        setError(result.error ?? "인덱싱에 실패했습니다.");
      } else {
        setMessage(`${result?.title ?? "문서"} 인덱싱이 완료되었습니다.`);
      }

      await loadDocuments();
    } catch (indexingError) {
      setError(indexingError instanceof Error ? indexingError.message : String(indexingError));
    } finally {
      setIndexingDocumentId("");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel>
        <SectionHeader title="인덱싱 상태" action={<Badge tone="blue">documents 테이블</Badge>} />
        <div className="p-5 pb-0">
          <PageIntro
            title="문서 인덱싱 운영 콘솔"
            description="인덱싱 필요 상태 문서를 텍스트로 추출하고 chunk, embedding을 생성해 document_chunks 테이블에 저장합니다."
          />
          {message && <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        </div>
        <SupabaseDocumentTable
          documents={documentRows}
          isLoading={isLoading}
          projects={projects}
          indexingDocumentId={indexingDocumentId}
          onIndexDocument={runIndexing}
        />
      </Panel>
      <Panel>
        <SectionHeader title="관리자 알림" />
        <div className="space-y-3 p-5">
          <p className="rounded-md border border-line bg-field p-3 text-sm text-slate-700">OPENAI_API_KEY가 Vercel 환경변수에 있어야 임베딩을 생성할 수 있습니다.</p>
          <p className="rounded-md border border-line bg-field p-3 text-sm text-slate-700">실패한 문서는 error_message에 원인이 저장됩니다.</p>
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

function Filters(props: {
  projectFilter: string;
  setProjectFilter: (value: string) => void;
  tagFilter: string;
  setTagFilter: (value: string) => void;
  categoryFilter?: string;
  setCategoryFilter?: (value: string) => void;
  typeFilter?: string;
  setTypeFilter?: (value: string) => void;
  projects?: SupabaseProject[];
  categories?: string[];
  documentTypes?: string[];
  tags?: string[];
}) {
  return (
    <div className="grid gap-3 rounded-md border border-line bg-white p-3 md:grid-cols-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <Filter size={17} aria-hidden />
        필터
      </div>
      <select value={props.projectFilter} onChange={(event) => props.setProjectFilter(event.target.value)} className="h-10 rounded-md border border-line bg-field px-3 text-sm">
        <option value="">전체 프로젝트</option>
        {(props.projects ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      {props.setCategoryFilter && (
        <select value={props.categoryFilter ?? ""} onChange={(event) => props.setCategoryFilter?.(event.target.value)} className="h-10 rounded-md border border-line bg-field px-3 text-sm">
          <option value="">전체 카테고리</option>
          {(props.categories ?? documentCategories).map((category) => <option key={category}>{category}</option>)}
        </select>
      )}
      {props.setTypeFilter && (
        <select value={props.typeFilter ?? ""} onChange={(event) => props.setTypeFilter?.(event.target.value)} className="h-10 rounded-md border border-line bg-field px-3 text-sm">
          <option value="">전체 문서 유형</option>
          {(props.documentTypes ?? documentTypes).map((type) => <option key={type}>{type}</option>)}
        </select>
      )}
      <select value={props.tagFilter} onChange={(event) => props.setTagFilter(event.target.value)} className="h-10 rounded-md border border-line bg-field px-3 text-sm">
        <option value="">전체 태그</option>
        {(props.tags ?? []).map((tag) => <option key={tag} value={tag}>{tag}</option>)}
      </select>
    </div>
  );
}

function UploadDiagnostics({ debugInfo }: { debugInfo: UploadDebugInfo }) {
  return (
    <div className="mt-4 rounded-md border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">업로드 진단 정보</h3>
        <Badge tone={debugInfo.storageUploadStarted ? "blue" : "neutral"}>
          {debugInfo.storageUploadStarted ? "Storage upload 시작됨" : "대기 중"}
        </Badge>
      </div>
      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">NEXT_PUBLIC_SUPABASE_URL</dt>
          <dd className="mt-1 break-all text-slate-800">{supabaseDiagnostics.hasUrl ? supabaseDiagnostics.url : "없음"}</dd>
        </div>
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">NEXT_PUBLIC_SUPABASE_ANON_KEY</dt>
          <dd className="mt-1 break-all text-slate-800">{supabaseDiagnostics.hasAnonKey ? supabaseDiagnostics.anonKeyPreview : "없음"}</dd>
        </div>
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">Bucket</dt>
          <dd className="mt-1 break-all text-slate-800">{debugInfo.bucketName}</dd>
        </div>
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">File path</dt>
          <dd className="mt-1 break-all text-slate-800">{debugInfo.filePath ?? "파일 선택 전"}</dd>
        </div>
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">선택 파일</dt>
          <dd className="mt-1 break-all text-slate-800">{debugInfo.selectedFile ?? "없음"}</dd>
        </div>
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">파일 유형</dt>
          <dd className="mt-1 break-all text-slate-800">{debugInfo.selectedFileType ?? "없음"}</dd>
        </div>
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">파일 크기</dt>
          <dd className="mt-1 break-all text-slate-800">{debugInfo.selectedFileSize == null ? "없음" : `${(debugInfo.selectedFileSize / 1024 / 1024).toFixed(2)} MB`}</dd>
        </div>
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">Storage 저장 path</dt>
          <dd className="mt-1 break-all text-slate-800">{debugInfo.storagePath ?? "아직 성공하지 않음"}</dd>
        </div>
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">documents register 시작</dt>
          <dd className="mt-1 text-slate-800">{debugInfo.registerStarted ? "예" : "아니오"}</dd>
        </div>
        <div className="rounded-md bg-field p-3">
          <dt className="font-semibold text-slate-600">register 처리 단계</dt>
          <dd className="mt-1 break-all text-slate-800">{debugInfo.registerStep ?? "아직 응답 없음"}</dd>
        </div>
      </dl>
      {debugInfo.uploadErrorJson && (
        <DebugBlock title="Storage upload error JSON.stringify 결과" value={debugInfo.uploadErrorJson} tone="red" />
      )}
      {debugInfo.registerResponseJson && (
        <DebugBlock title="documents register API 응답" value={debugInfo.registerResponseJson} tone={debugInfo.registerStep?.includes("failed") ? "red" : "neutral"} />
      )}
      {debugInfo.networkError && (
        <DebugBlock title="Fetch/network error detail" value={stringifyDebugValue(debugInfo.networkError)} tone="red" />
      )}
      {debugInfo.registerErrorJson && (
        <DebugBlock title="documents register error JSON.stringify 결과" value={debugInfo.registerErrorJson} tone="red" />
      )}
    </div>
  );
}

function DebugBlock({ title, value, tone = "neutral" }: { title: string; value: string; tone?: "red" | "neutral" }) {
  const className = tone === "red"
    ? "mt-3 max-h-80 overflow-auto rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
    : "mt-3 max-h-80 overflow-auto rounded-md border border-line bg-field p-3 text-xs text-slate-800";

  return (
    <div>
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      <pre className={className}>{value}</pre>
    </div>
  );
}

function SupabaseDocumentTable({
  documents,
  indexingDocumentId = "",
  isLoading,
  projects = [],
  onEditDocument,
  onIndexDocument
}: {
  documents: SupabaseDocument[];
  indexingDocumentId?: string;
  isLoading: boolean;
  projects?: SupabaseProject[];
  onEditDocument?: (document: SupabaseDocument) => void;
  onIndexDocument?: (documentId: string) => void;
}) {
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
            <th className="px-5 py-3">프로젝트/분류</th>
            <th className="px-5 py-3">파일 유형</th>
            <th className="px-5 py-3">업로드 일시</th>
            <th className="px-5 py-3">상태</th>
            {(onIndexDocument || onEditDocument) && <th className="px-5 py-3">작업</th>}
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id} className="border-t border-line">
              <td className="px-5 py-4">
                <p className="font-semibold text-ink">{document.title}</p>
                <p className="mt-1 max-w-[280px] truncate text-xs text-slate-500">{document.file_path}</p>
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1">
                  <Badge tone={document.project_id ? "blue" : "neutral"}>{document.project_name ?? projects.find((project) => project.id === document.project_id)?.name ?? "미분류"}</Badge>
                  {document.category && <Badge tone="amber">{document.category}</Badge>}
                  {document.document_type && <Badge>{document.document_type}</Badge>}
                  {(document.tags ?? []).map((tag) => <Badge key={tag}>{tag}</Badge>)}
                </div>
              </td>
              <td className="px-5 py-4 uppercase">{document.file_type}</td>
              <td className="px-5 py-4">{formatDateTime(document.created_at)}</td>
              <td className="px-5 py-4">
                <div className="space-y-1">
                  <Badge tone={getStatusTone(document.status)}>{getStatusLabel(document.status)}</Badge>
                  {document.error_message && <p className="max-w-[260px] text-xs leading-5 text-rose-600">{document.error_message}</p>}
                </div>
              </td>
              {(onIndexDocument || onEditDocument) && (
                <td className="space-y-2 px-5 py-4">
                  {onIndexDocument && (
                    <button
                      type="button"
                      disabled={document.status !== "uploaded" || Boolean(indexingDocumentId)}
                      onClick={() => onIndexDocument(document.id)}
                      className="block rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-field disabled:text-slate-400"
                    >
                      {indexingDocumentId === document.id ? "인덱싱 중" : "인덱싱 실행"}
                    </button>
                  )}
                  {onEditDocument && (
                    <button type="button" onClick={() => onEditDocument(document)} className="block rounded-md border border-line px-3 py-2 text-xs font-semibold text-slate-700">
                      분류 수정
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentClassificationEditor({
  document,
  projects,
  onClose,
  onSaved
}: {
  document: SupabaseDocument;
  projects: SupabaseProject[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    projectId: document.project_id ?? "",
    category: document.category ?? documentCategories[0],
    documentType: document.document_type ?? documentTypes[0],
    tags: (document.tags ?? []).join(", "),
    description: document.description ?? ""
  });
  const [error, setError] = useState("");

  async function save() {
    const project = projects.find((item) => item.id === form.projectId);
    const response = await fetch(`/api/documents/${document.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        project_id: project?.id ?? null,
        project_name: project?.name ?? null,
        category: form.category,
        document_type: form.documentType,
        tags: form.tags,
        description: form.description
      })
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      setError(getApiErrorMessage(data, "문서 분류 저장에 실패했습니다."));
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl rounded-md bg-white p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-ink">문서 분류 수정</h3>
          <button type="button" onClick={onClose} className="rounded-md border border-line px-3 py-1 text-sm">닫기</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <select value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))} className="h-10 rounded-md border border-line bg-field px-3">
            <option value="">프로젝트 없음 / 미분류</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="h-10 rounded-md border border-line bg-field px-3">
            {documentCategories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <select value={form.documentType} onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))} className="h-10 rounded-md border border-line bg-field px-3">
            {documentTypes.map((type) => <option key={type}>{type}</option>)}
          </select>
          <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} className="h-10 rounded-md border border-line bg-field px-3" placeholder="태그" />
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24 rounded-md border border-line bg-field p-3 md:col-span-2" placeholder="설명" />
        </div>
        <p className="mt-3 text-sm text-amber-700">저장하면 상태가 인덱싱 필요로 변경되어 재인덱싱이 필요합니다.</p>
        {error && <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button type="button" onClick={() => void save()} className="mt-4 rounded-md bg-ocean px-4 py-2 text-sm font-semibold text-white">저장</button>
      </div>
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
              <td className="px-5 py-4"><Badge tone={getStatusTone(document.status)}>{getStatusLabel(document.status)}</Badge></td>
              {!compact && <td className="px-5 py-4">{document.status === "Failed" ? <button className="rounded-md border border-line px-3 py-2 text-xs font-semibold">재시도</button> : <button className="rounded-md border border-line px-3 py-2 text-xs font-semibold">상세</button>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
