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

- `app/page.tsx`: App Router page 엔트리
- `app/globals.css`: Tailwind 및 전역 스타일
- `components/home-page.tsx`: 전체 MVP 화면과 클라이언트 상태
- `components/ui.tsx`: 공통 패널, 배지, 섹션 헤더
- `lib/supabase.ts`: Supabase client 설정
- `lib/types.ts`: 향후 백엔드와 맞출 데이터 모델
- `lib/mock-data.ts`: 샘플 문서, 프로젝트, 태그, 인덱싱 작업
- `lib/rag-service.ts`: mock 검색 및 Q&A 서비스 계층
- `DEPLOYMENT.md`: Supabase/Vercel 상용화 체크리스트
- `supabase-schema.sql`: 문서 업로드 1단계용 Supabase 테이블, Storage bucket, RLS 정책
- `outputs/supabase-schema.sql`: 같은 SQL의 배포 산출물 사본

## 실행

```bash
npm install
npm run dev
```

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
3. Storage bucket 이름은 `documents`를 사용합니다. SQL에 bucket 생성문이 포함되어 있으므로, 이미 만든 경우에도 그대로 실행할 수 있습니다.
4. `documents` 테이블에는 업로드 성공 시 아래 값이 저장됩니다.
   - `title`
   - `file_path`
   - `file_type`
   - `status` = `uploaded`
   - `created_at`

## Vercel 환경변수

Vercel Project Settings > Environment Variables에 아래 값을 등록합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SECRET_KEY=your-supabase-secret-key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY`에는 legacy anon JWT 또는 새 publishable key(`sb_publishable_...`)를 넣을 수 있습니다. 문서 업로드 API 라우트는 서버에서 실행되므로 Storage 저장과 `documents` insert에는 `SUPABASE_SECRET_KEY`를 우선 사용합니다. 기존 legacy 키를 쓰는 프로젝트라면 `SUPABASE_SERVICE_ROLE_KEY`를 대신 등록해도 됩니다.

환경변수 등록 후 Vercel에서 다시 배포하면 문서 업로드 화면에서 PDF, TXT, DOCX 파일을 Next.js API 라우트로 전송하고, 서버가 Supabase Storage의 `documents` bucket에 저장한 뒤 문서 목록과 인덱싱 상태 화면에서 `documents` 테이블 목록을 조회합니다.

현재 구현은 실제 RAG 파이프라인 대신 mock service layer를 사용합니다. OpenAI 임베딩과 RAG 답변 기능은 아직 연결하지 않았으며, 이후 `lib/rag-service.ts`를 API 호출, PostgreSQL + pgvector, 외부 Vector DB, LLM API 연결부로 교체하면 됩니다.
