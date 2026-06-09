export type Role = "member" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type Project = {
  id: string;
  name: string;
  owner: string;
  status: "진행" | "운영" | "완료";
  documentCount: number;
};

export type Tag = {
  id: string;
  name: string;
  documentCount: number;
};

export type DocumentStatus =
  | "Uploaded"
  | "Pending"
  | "Processing"
  | "Indexed"
  | "Failed"
  | "Reprocessing"
  | "Deleted";

export type DocumentType = "계약서" | "회의록" | "결정사항" | "운영이력" | "요약";

export type Document = {
  id: string;
  title: string;
  type: DocumentType;
  projectId: string;
  tagIds: string[];
  uploader: string;
  uploadedAt: string;
  status: DocumentStatus;
  version: string;
  summary: string;
};

export type AnswerCitation = {
  documentId: string;
  section: string;
  snippet: string;
  score: number;
};

export type RagAnswer = {
  answer: string | null;
  confidence: "high" | "medium" | "low" | "none";
  citations: AnswerCitation[];
  relatedDocumentIds: string[];
  followUps: string[];
};

export type IngestionJob = {
  id: string;
  documentId: string;
  status: DocumentStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  status: string;
  owner: string;
  period?: string;
  tags: string[];
  updatedAt?: string;
  documentCount?: number;
  decisionCount?: number;
};

export type UploadedDocument = {
  id: string;
  title: string;
  fileType: string;
  projectName?: string;
  category?: string;
  documentType?: string;
  tags: string[];
  uploader?: string;
  uploadedAt?: string;
  status: string;
  filePath?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};

export type ChatLog = {
  id: string;
  question: string;
  answer: string;
  sources: unknown[];
  filters?: Record<string, unknown> | null;
  projectId?: string | null;
  projectName?: string | null;
  createdAt: string;
};

export type AdminActivityLog = {
  id: string;
  actor: string;
  action: string;
  createdAt: string;
  status: "성공" | "실패" | "대기";
};

export type SearchResult = {
  id: string;
  title: string;
  projectName?: string;
  category?: string;
  documentType?: string;
  tags: string[];
  fileType?: string;
  status: string;
  chunkPreview?: string;
  filePath?: string;
};
