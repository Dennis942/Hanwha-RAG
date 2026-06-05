import { documents, sampleAnswer } from "./mock-data";
import type { Document, RagAnswer } from "./types";

export type SearchFilters = {
  projectId?: string;
  tagId?: string;
  documentType?: string;
};

export function searchWorkHistory(query: string, filters: SearchFilters): Document[] {
  const normalized = query.trim().toLowerCase();

  return documents.filter((document) => {
    const matchesQuery =
      !normalized ||
      `${document.title} ${document.summary} ${document.type}`.toLowerCase().includes(normalized);
    const matchesProject = !filters.projectId || document.projectId === filters.projectId;
    const matchesTag = !filters.tagId || document.tagIds.includes(filters.tagId);
    const matchesType = !filters.documentType || document.type === filters.documentType;

    return matchesQuery && matchesProject && matchesTag && matchesType;
  });
}

export function askKnowledgeBase(question: string): RagAnswer {
  const normalized = question.trim();

  if (!normalized || normalized.includes("급여") || normalized.includes("개인정보")) {
    return {
      answer: null,
      confidence: "none",
      citations: [],
      relatedDocumentIds: [],
      followUps: ["프로젝트명이나 문서 유형을 포함해서 다시 질문해보세요."]
    };
  }

  return sampleAnswer;
}
