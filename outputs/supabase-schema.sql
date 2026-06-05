-- Eagle Next RAG MVP schema draft for Supabase Postgres + pgvector.
-- Run in Supabase SQL Editor after enabling the vector extension.

create extension if not exists vector;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner text not null,
  status text not null default '진행',
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  document_type text not null,
  project_id uuid references public.projects(id),
  uploader_id uuid,
  storage_path text,
  status text not null default 'Uploaded',
  version text not null default 'v1.0',
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.document_tags (
  document_id uuid references public.documents(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (document_id, tag_id)
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  chunk_index integer not null,
  section text,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_embedding_idx
on public.document_chunks
using hnsw (embedding vector_cosine_ops);

create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  status text not null default 'Pending',
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  question text not null,
  project_id uuid references public.projects(id),
  created_at timestamptz not null default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  answer text,
  confidence text not null default 'none',
  created_at timestamptz not null default now()
);

create table if not exists public.answer_citations (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid references public.answers(id) on delete cascade,
  document_id uuid references public.documents(id),
  chunk_id uuid references public.document_chunks(id),
  section text,
  snippet text,
  score numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
