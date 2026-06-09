import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG 기반 업무 히스토리 조회",
  description: "업무 문서 검색과 근거 기반 Q&A를 위한 MVP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
