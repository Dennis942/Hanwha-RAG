import type { Document, IngestionJob, Project, RagAnswer, Tag, User } from "./types";

export const currentUser: User = {
  id: "u-001",
  name: "DA플랫폼팀 관리자",
  email: "admin@company.example",
  role: "admin"
};

export const projects: Project[] = [
  { id: "p-contract", name: "계약 관리 고도화", owner: "DA플랫폼팀", status: "운영", documentCount: 18 },
  { id: "p-search", name: "업무 히스토리 RAG", owner: "DA플랫폼팀", status: "진행", documentCount: 11 },
  { id: "p-ops", name: "운영 리포트 자동화", owner: "관리자", status: "완료", documentCount: 9 }
];

export const tags: Tag[] = [
  { id: "t-contract", name: "계약", documentCount: 12 },
  { id: "t-meeting", name: "회의록", documentCount: 24 },
  { id: "t-decision", name: "결정사항", documentCount: 16 },
  { id: "t-ops", name: "운영", documentCount: 10 },
  { id: "t-security", name: "보안", documentCount: 7 }
];

export const documents: Document[] = [
  {
    id: "d-001",
    title: "RAG 업무 히스토리 구축 킥오프 회의록",
    type: "회의록",
    projectId: "p-search",
    tagIds: ["t-meeting", "t-decision"],
    uploader: "김도윤",
    uploadedAt: "2026-05-28 14:20",
    status: "Indexed",
    version: "v1.0",
    summary: "문서 업로드, 검색, 자연어 Q&A를 MVP 범위로 확정하고 실제 RAG 파이프라인은 mock 서비스로 시작하기로 결정했습니다."
  },
  {
    id: "d-002",
    title: "계약 관리 고도화 2차 변경 계약서",
    type: "계약서",
    projectId: "p-contract",
    tagIds: ["t-contract", "t-security"],
    uploader: "박서연",
    uploadedAt: "2026-05-24 10:05",
    status: "Indexed",
    version: "v2.1",
    summary: "데이터 보관 기간, 감사 로그 보존, 외부망 접근 시 인증 의무를 계약 조건에 추가했습니다."
  },
  {
    id: "d-003",
    title: "운영 리포트 자동화 장애 회고",
    type: "운영이력",
    projectId: "p-ops",
    tagIds: ["t-ops", "t-decision"],
    uploader: "이민재",
    uploadedAt: "2026-05-19 18:40",
    status: "Processing",
    version: "v1.3",
    summary: "배치 지연 원인은 권한 만료였으며, 재발 방지를 위해 만료 7일 전 알림을 추가하기로 했습니다."
  },
  {
    id: "d-004",
    title: "검색 품질 평가 기준",
    type: "결정사항",
    projectId: "p-search",
    tagIds: ["t-decision"],
    uploader: "최하린",
    uploadedAt: "2026-05-15 09:30",
    status: "Failed",
    version: "v0.9",
    summary: "질문 답변은 출처 2개 이상 또는 신뢰도 기준을 충족할 때만 생성하고, 근거가 부족하면 확인 불가 상태를 반환합니다."
  }
];

export const recentQuestions = [
  "RAG MVP에서 가장 먼저 구현해야 하는 화면은 무엇인가요?",
  "외부망 접근 시 계약서에 명시된 보안 조건은 무엇인가요?",
  "운영 리포트 자동화 장애의 재발 방지 조치는 무엇인가요?"
];

export const ingestionJobs: IngestionJob[] = [
  { id: "j-101", documentId: "d-001", status: "Indexed", startedAt: "2026-05-28 14:22", completedAt: "2026-05-28 14:27" },
  { id: "j-102", documentId: "d-002", status: "Indexed", startedAt: "2026-05-24 10:08", completedAt: "2026-05-24 10:14" },
  { id: "j-103", documentId: "d-003", status: "Processing", startedAt: "2026-05-19 18:45" },
  { id: "j-104", documentId: "d-004", status: "Failed", startedAt: "2026-05-15 09:33", error: "본문 추출 실패: 지원하지 않는 파일 암호화 형식" }
];

export const sampleAnswer: RagAnswer = {
  answer:
    "MVP 우선순위는 로그인, 대시보드, 문서 업로드, 문서 목록/상세, 업무 히스토리 검색, Q&A, 출처 표시, 프로젝트/태그 필터, 관리자 인덱싱 상태 화면 순서로 정리되어 있습니다.",
  confidence: "high",
  citations: [
    {
      documentId: "d-001",
      section: "회의록 / MVP 범위",
      snippet: "문서 업로드, 검색, 자연어 Q&A를 MVP 범위로 확정했습니다.",
      score: 0.91
    },
    {
      documentId: "d-004",
      section: "결정사항 / 답변 정책",
      snippet: "근거가 부족하면 확인 불가 상태를 반환합니다.",
      score: 0.82
    }
  ],
  relatedDocumentIds: ["d-001", "d-004"],
  followUps: ["관리자 화면에는 어떤 상태가 보여야 하나요?", "출처 신뢰도 기준은 어떻게 정했나요?", "실제 벡터 DB 연결 시 필요한 API는 무엇인가요?"]
};
