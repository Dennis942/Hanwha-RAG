import type { ReactNode } from "react";

export type StatusTone = "blue" | "green" | "amber" | "red" | "neutral";

export function getStatusTone(status: string): StatusTone {
  const tones: Record<string, StatusTone> = {
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
  };

  return tones[status] ?? "neutral";
}

export function getStatusLabel(status: string) {
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

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getChildItems(children: ReactNode) {
  return Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
}

