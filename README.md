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
- `app/api/chat/route.ts`: 질문 embedding, chunk 검색, 문서 기반 답변 생성, chat log 저장 API
- `app/api/documents/register/route.ts`: Storage 업로드 후 documents 테이블 metadata 등록 API
- `app/api/documents/index/route.ts`: 문서 텍스트 추출, chunking, OpenAI embedding, Supabase 저장 API
- `app/globals.css`: Tailwind 및 전역 스타일
- `components/home-page.tsx`: 전체 MVP 화면과 클라이언트 상태
- `components/ui.tsx`: 공통 패널, 배지, 섹션 헤더
- `lib/supabase.ts`: Supabase client 설정
- `lib/types.ts`: 향후 백엔드와 맞출 데이터 모델
- `lib/mock-data.ts`: 샘플 문서, 프로젝트, 태그, 인덱싱 작업
- `lib/rag-service.ts`: mock 검색 및 Q&A 서비스 계층
- `DEPLOYMENT.md`: Supabase/Vercel 상용화 체크리스트
- `supabase-schema.sql`: 문서 업로드 및 인덱싱용 Supabase 테이블, Storage bucket, pgvector, RLS 정책
- `outputs/supabase-schema.sql`: 같은 SQL의 배포 산출물 사본

## 실행

```bash
npm install
npm run dev
```

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다. 기존에 예전 `documents` 테이블을 만든 적이 있어도 다시 실행해야 `file_path`, `file_type`, `file_size`, `error_message`, `document_chunks`, `chat_logs`, `match_document_chunks` 함수와 PostgREST schema cache reload가 적용됩니다.
3. Storage bucket 이름은 `documents`를 사용합니다. SQL에 bucket 생성문이 포함되어 있으므로, 이미 만든 경우에도 그대로 실행할 수 있습니다.
4. `documents` 테이블에는 업로드 성공 시 아래 값이 저장됩니다.
   - `title`
   - `file_path`
   - `file_type`
   - `file_size`
   - `status` = `uploaded`
   - `created_at`
5. 파일은 20MB 이하의 PDF, TXT, DOCX만 허용합니다. 브라우저가 Supabase Storage `documents` bucket에 직접 업로드하고, Storage 경로는 원본 파일명 대신 `uploads/{uuid}.{ext}` 형식으로 저장합니다. 업로드 성공 후 `/api/documents/register` API 라우트가 원본 파일명, Storage path, 파일 유형, 파일 크기를 `documents` 테이블에 저장합니다.

## Vercel 환경변수

Vercel Project Settings > Environment Variables에 아래 값을 등록합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SECRET_KEY=your-supabase-secret-key
OPENAI_API_KEY=your-openai-api-key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY`에는 legacy anon JWT 또는 새 publishable key(`sb_publishable_...`)를 넣을 수 있습니다. 브라우저는 이 키로 Storage에 직접 업로드하고, `/api/documents/register`와 `/api/documents/index`는 서버에서 실행되므로 `documents` insert/update에는 `SUPABASE_SECRET_KEY`를 우선 사용합니다. 기존 legacy 키를 쓰는 프로젝트라면 `SUPABASE_SERVICE_ROLE_KEY`를 대신 등록해도 됩니다.

환경변수 등록 후 Vercel에서 다시 배포하면 문서 업로드 화면에서 PDF, TXT, DOCX 파일을 Supabase Storage의 `documents` bucket에 직접 저장한 뒤 `/api/documents/register`가 문서 metadata를 저장합니다. 큰 PDF도 Vercel Function body limit에 걸리지 않도록 파일 본문은 Vercel API로 보내지 않습니다.

현재 구현은 문서 업로드, 인덱싱, 업로드 문서 기반 질문 답변까지 연결되어 있습니다. `/api/chat`은 질문 embedding을 생성하고 `match_document_chunks`로 상위 chunk 5개를 찾은 뒤, 등록된 문서 근거 안에서만 답변하고 `chat_logs`에 질문/답변/source를 저장합니다.
