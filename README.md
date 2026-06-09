# RAG 기반 업무 히스토리 조회 웹페이지 MVP

Next.js, TypeScript, Tailwind CSS 기반의 사내 업무 히스토리 조회 MVP입니다.

## 포함 화면

- 로그인
- 메인화면 및 기능 바로가기
- 주황색 문서 업로드 CTA를 통한 문서 등록
- 문서 관리 통합 검색
- 업무 질의 및 출처 표시
- 프로젝트 상세
- 관리자 인덱싱 상태

## 구조

- `app/page.tsx`: App Router page 엔트리
- `app/api/chat/route.ts`: 질문 embedding, chunk 검색, 문서 기반 답변 생성, chat log 저장 API
- `app/api/projects/route.ts`: 프로젝트 목록 조회 및 생성 API
- `app/api/projects/[id]/route.ts`: 프로젝트 상세 조회 및 수정 API
- `app/api/search/route.ts`: 업로드 문서 및 indexed chunk 키워드 검색 API
- `app/api/documents/register/route.ts`: Storage 업로드 후 documents 테이블 metadata 등록 API
- `app/api/documents/[id]/route.ts`: 문서 프로젝트/카테고리/태그 분류 수정 API
- `app/api/documents/index/route.ts`: 문서 텍스트 추출, chunking, OpenAI embedding, Supabase 저장 API
- `app/globals.css`: Tailwind 및 전역 스타일
- `components/home-page.tsx`: 기존 Supabase/RAG 기능을 연결하는 클라이언트 상태 컨테이너
- `components/layout/AppLayout.tsx`: 좌측 사이드바, 상단 헤더, 메인 콘텐츠를 묶는 앱 레이아웃
- `components/layout/Sidebar.tsx`: 메인화면, 업무 질의, 문서 관리, 프로젝트, 관리자 메뉴
- `components/layout/Header.tsx`: 서비스명, 현재 화면명, 사용자 프로필 placeholder
- `components/chat/ChatbotPanel.tsx`: 첫 화면의 챗봇 중심 Q&A 패널
- `components/chat/ChatMessage.tsx`: 채팅 메시지 bubble
- `components/history/RecentHistoryList.tsx`: 최근 질문/답변 히스토리 목록
- `components/history/HistoryDetailPanel.tsx`: 질문/답변/필터/출처 상세 패널
- `components/documents/DocumentUploadCard.tsx`: 문서 업로드 UI 구조
- `components/documents/DocumentTable.tsx`: 문서 목록, 상태, 작업 버튼 테이블
- `components/projects/ProjectHistoryTable.tsx`: 프로젝트 및 업무 히스토리 테이블
- `components/search/WorkSearchPanel.tsx`: 문서 관리 검색 입력과 결과 카드
- `components/admin/AdminStatsCards.tsx`: 관리자 통계 카드
- `components/ui.tsx`: 공통 패널, 배지, 섹션 헤더
- `lib/supabase.ts`: Supabase client 설정
- `lib/types.ts`: 화면 분리와 백엔드 연결에 공통으로 쓰는 데이터 모델
- `lib/ui-format.ts`: 상태 badge, 날짜 표시 등 UI 포맷 유틸
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
2. Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다. 기존에 예전 `documents` 테이블을 만든 적이 있어도 다시 실행해야 `projects`, `documents` metadata 컬럼, `document_chunks`, `chat_logs`, 필터 지원 `match_document_chunks` 함수와 PostgREST schema cache reload가 적용됩니다.
3. Storage bucket 이름은 `documents`를 사용합니다. SQL에 bucket 생성문이 포함되어 있으므로, 이미 만든 경우에도 그대로 실행할 수 있습니다.
4. `documents` 테이블에는 업로드 성공 시 아래 값이 저장됩니다.
   - `title`
   - `file_path`
   - `file_type`
   - `file_size`
   - `project_id`
   - `project_name`
   - `category`
   - `document_type`
   - `tags`
   - `description`
   - `status` = `uploaded`
   - `created_at`
5. 파일은 20MB 이하의 PDF, TXT, DOCX만 허용합니다. 브라우저가 Supabase Storage `documents` bucket에 직접 업로드하고, Storage 경로는 원본 파일명 대신 `uploads/{uuid}.{ext}` 형식으로 저장합니다. 업로드 성공 후 `/api/documents/register` API 라우트가 원본 파일명, Storage path, 파일 유형, 파일 크기를 `documents` 테이블에 저장합니다.
6. `documents` Storage bucket은 private으로 유지합니다. 현재 SQL은 anon 업로드 정책만 두고 anon 파일 읽기 정책은 생성하지 않습니다. 인덱싱 API는 서버의 `SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY`로 Storage 파일을 다운로드합니다.
7. `documents.status`는 `uploaded`, `indexing`, `indexed`, `failed`만 허용하고, `document_chunks`는 `(document_id, chunk_index)`가 중복되지 않도록 관리합니다.
8. `projects.owner`는 기본값이 `미지정`입니다. 프로젝트 생성 UI/API도 담당자/담당부서 값이 비어 있으면 `미지정`으로 저장해 `not null` 제약에 걸리지 않도록 방어합니다.

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

## API 에러 응답

API Route는 실패 시 아래 형태를 공통으로 반환합니다. 화면은 `message`와 `error.code`를 함께 읽어 사용자에게 원인을 표시합니다.

```json
{
  "ok": false,
  "message": "사용자에게 보여줄 오류 메시지",
  "step": "실패 단계",
  "error": {
    "code": "machine_readable_error_code",
    "message": "사용자에게 보여줄 오류 메시지",
    "step": "실패 단계",
    "details": {}
  }
}
```

## 통합 업무 흐름

- 프로젝트는 업무 폴더 역할을 하며 이름, 설명, 상태, 카테고리, 태그, 목적, 담당자, 기간, 메모, 결정사항, 타임라인을 저장합니다.
- `새 질문 시작`은 기존 질문 입력, 히스토리 상세, 답변, 출처 패널을 초기화하고 업무 질의의 새 질문 모드로 이동합니다.
- 메인화면은 기본 진입 화면이며, 업무 질의는 업로드 및 인덱싱된 문서를 근거로 질문하는 화면입니다. 최근 업무 히스토리는 기존 질문/답변을 다시 확인하는 읽기 화면입니다.
- 왼쪽 사이드바 메뉴는 메인화면, 업무 질의, 문서 관리, 프로젝트, 관리자만 제공합니다. 문서 업로드는 사이드바 메뉴가 아니라 상단 주황색 CTA 버튼과 메인화면 업로드 아이콘을 통해 접근합니다.
- 문서 업로드 화면은 새 문서 등록 전용입니다. 프로젝트, 카테고리, 문서 유형, 태그, 설명을 입력하고 파일을 업로드한 뒤 `문서 관리에서 확인하기` 버튼으로 업로드 결과를 확인합니다.
- 문서 관리 화면은 기존 문서 관리와 문서/업무 검색을 통합한 화면입니다. 검색어가 없으면 Supabase `documents` 테이블의 전체 문서 목록을 먼저 보여주고, 검색어 또는 필터가 있으면 문서명 검색, 프로젝트/카테고리/문서 유형/태그/상태/업로드일 필터, 인덱싱된 본문 chunk 검색 결과를 함께 제공합니다.
- 문서 관리에서는 분류 수정, 인덱싱 실행, 삭제, 이 문서 기준 질문하기를 수행할 수 있습니다.
- 문서 관리에서 프로젝트/카테고리/문서 유형/태그/설명을 수정하면 `documents.status`를 `uploaded`로 되돌려 재인덱싱을 유도합니다.
- 문서 삭제 시 `documents` row, `document_chunks` row, Supabase Storage `documents` bucket의 원본 파일을 함께 삭제합니다.
- 인덱싱 시 `document_chunks.metadata`에는 문서명, file path, 프로젝트, 카테고리, 문서 유형, 태그, chunk 번호, embedding model이 함께 저장됩니다.
- Q&A 필터의 프로젝트/카테고리/문서 유형/태그는 `match_document_chunks` 검색 조건으로 전달됩니다.
- 왼쪽 최근 업무 히스토리는 `chat_logs` 기반으로 최근 질문, 일시, 출처 수, 프로젝트명을 보여주며 클릭 시 저장된 질문/답변 상세를 표시합니다. 히스토리 삭제 시 `chat_logs` row가 삭제됩니다.
- 문서 관리의 검색 기능은 답변 생성이 아니라 최신 `documents` metadata와 매칭 chunk를 찾는 기능입니다. 결과 카드에는 `documents` 테이블의 프로젝트, 카테고리, 문서 유형, 태그, 상태를 우선 표시합니다.
- 분류 수정 후 업무검색 필터는 `documents` 테이블의 실제 distinct 값 기준으로 다시 구성됩니다. 본문 chunk metadata는 재인덱싱 후 최신 분류값으로 갱신됩니다.

## 운영 전 체크리스트

- Vercel Production/Preview 환경에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`가 모두 등록되어 있는지 확인합니다.
- Supabase SQL Editor에서 최신 `supabase-schema.sql`을 실행하고, 마지막 `notify pgrst, 'reload schema';`까지 성공했는지 확인합니다.
- 프로젝트 생성 오류를 막기 위해 최신 SQL의 `projects.owner` 기본값 migration을 반드시 실행합니다.
- Storage `documents` bucket이 private인지 확인하고, `storage.objects`에 anon select/read 정책이 남아 있지 않은지 확인합니다.
- 브라우저 직접 업로드를 유지하는 동안 anon insert 정책은 `bucket_id = 'documents'` 및 `uploads/` 경로로 제한합니다.
- Supabase Table Editor에서 `documents.file_path`, `documents.file_type`, `documents.status`, `documents.error_message`, `document_chunks.embedding`, `chat_logs.sources`, `chat_logs.filters` 컬럼이 있는지 확인합니다.
- Vercel 배포 후 TXT, PDF, DOCX 각각으로 `업로드 -> documents 등록 -> 인덱싱 -> Q&A -> 업무검색` 흐름을 한 번씩 점검합니다.
- 기존 indexed 문서의 분류를 수정한 경우 해당 문서는 다시 `uploaded` 상태가 되므로, 관리자 화면에서 재인덱싱을 실행해야 Q&A chunk metadata까지 최신화됩니다.
- 인덱싱 실패 문서는 `documents.error_message`를 확인하고, 실패 원인이 OpenAI key, PDF 텍스트 추출, Storage 다운로드, schema cache 중 어디인지 분류합니다.
- 내부 파일럿 전에는 service role 계정 사용 범위, RLS 정책, 업로드 가능한 사용자 범위를 다시 확정합니다.
