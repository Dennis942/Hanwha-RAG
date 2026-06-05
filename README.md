# RAG 기반 업무 히스토리 조회 웹페이지 MVP

Next.js, TypeScript, Tailwind CSS 기반의 사내 업무 히스토리 조회 MVP입니다.

## 포함 화면

- 로그인
- 챗봇형 메인 화면 및 기능 바로가기
- 문서 업로드 및 문서 목록
- 업무 히스토리 검색
- 자연어 Q&A 및 출처 표시
- 프로젝트 상세
- 관리자 인덱싱 상태

## 구조

- `app/page.tsx`: 전체 MVP 화면과 클라이언트 상태
- `app/globals.css`: Tailwind 및 전역 스타일
- `components/ui.tsx`: 공통 패널, 배지, 섹션 헤더
- `lib/types.ts`: 향후 백엔드와 맞출 데이터 모델
- `lib/mock-data.ts`: 샘플 문서, 프로젝트, 태그, 인덱싱 작업
- `lib/rag-service.ts`: mock 검색 및 Q&A 서비스 계층
- `DEPLOYMENT.md`: Supabase/Vercel 상용화 체크리스트
- `outputs/supabase-schema.sql`: Supabase Postgres + pgvector 스키마 초안

## 실행

```bash
npm install
npm run dev
```

현재 구현은 실제 RAG 파이프라인 대신 mock service layer를 사용합니다. 이후 `lib/rag-service.ts`를 API 호출, PostgreSQL + pgvector, 외부 Vector DB, LLM API 연결부로 교체하면 됩니다.
