# Eagle Next 상용화 체크리스트

## 1. Supabase 준비

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 `outputs/supabase-schema.sql`을 실행합니다.
3. Storage bucket을 만듭니다.
   - 예: `documents`
   - 업로드 파일 원본을 저장합니다.
4. Auth를 켭니다.
   - 사내 이메일 도메인 제한, SSO, MFA는 운영 단계에서 추가합니다.
5. Row Level Security 정책을 추가합니다.
   - 관리자: 문서 업로드, 재처리, 감사 로그 조회
   - 구성원: 문서 검색, Q&A, 출처 조회

공식 문서:
- Supabase Next.js: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- Supabase AI & Vectors: https://supabase.com/docs/guides/ai
- Supabase vector columns: https://supabase.com/docs/guides/ai/vector-columns

## 2. RAG 파이프라인 연결

현재 `lib/rag-service.ts`는 mock입니다. 운영 전환 시 아래 순서로 바꿉니다.

1. 문서 업로드: Supabase Storage에 원본 저장
2. 인덱싱 작업 생성: `ingestion_jobs`에 `Pending` row 생성
3. 본문 추출: PDF/DOCX/TXT 파서 연결
4. 청킹: `document_chunks`에 content 저장
5. 임베딩 생성: OpenAI embedding 또는 사내 모델 사용
6. 벡터 저장: `document_chunks.embedding`
7. 검색: pgvector cosine similarity로 관련 chunk 조회
8. 답변 생성: 검색 결과를 근거로 LLM 호출
9. 출처 저장: `answer_citations` 기록

## 3. Vercel 배포

1. GitHub 저장소에 프로젝트를 push합니다.
2. Vercel에서 새 프로젝트를 import합니다.
3. Framework는 Next.js로 자동 감지됩니다.
4. Environment Variables에 `.env.example` 기준 값을 등록합니다.
5. Production deploy를 실행합니다.

공식 문서:
- Next.js on Vercel: https://vercel.com/docs/concepts/next.js/overview
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables

필수 환경변수:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
RAG_EMBEDDING_MODEL=text-embedding-3-small
RAG_ANSWER_MODEL=gpt-4.1-mini
```

## 4. 운영 전 점검

- 로그인 실패/성공 플로우
- 관리자/구성원 권한 분리
- 문서 업로드 용량 제한
- 인덱싱 실패 재처리
- “자료에서 확인할 수 없습니다” 정책
- 답변 출처 표시
- 감사 로그 저장
- Vercel Production 환경변수 누락 여부
- Supabase RLS 정책 누락 여부
