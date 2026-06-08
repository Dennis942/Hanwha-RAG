-- Supabase schema for Hanwha-RAG document upload MVP.
-- Run this in the Supabase SQL Editor before deploying the upload flow.

create extension if not exists vector;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null unique,
  file_type text not null check (file_type in ('PDF', 'TXT', 'DOCX')),
  file_size bigint,
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

alter table public.documents
add column if not exists file_path text;

alter table public.documents
add column if not exists file_type text;

alter table public.documents
add column if not exists file_size bigint;

alter table public.documents
add column if not exists error_message text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'storage_path'
  ) then
    update public.documents
    set file_path = coalesce(file_path, storage_path, 'legacy/' || id::text)
    where file_path is null;
  else
    update public.documents
    set file_path = coalesce(file_path, 'legacy/' || id::text)
    where file_path is null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'document_type'
  ) then
    update public.documents
    set file_type = coalesce(
      file_type,
      case
        when lower(coalesce(document_type, '')) in ('pdf', 'txt', 'docx') then upper(document_type)
        else 'TXT'
      end
    )
    where file_type is null;
  else
    update public.documents
    set file_type = coalesce(file_type, 'TXT')
    where file_type is null;
  end if;
end $$;

update public.documents
set file_type = upper(file_type)
where file_type in ('pdf', 'txt', 'docx');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'document_type'
  ) then
    alter table public.documents alter column document_type drop not null;
  end if;
end $$;

alter table public.documents
alter column file_path set not null,
alter column file_type set not null,
alter column status set default 'uploaded';

alter table public.documents
drop constraint if exists documents_file_type_check;

alter table public.documents
add constraint documents_file_type_check check (file_type in ('PDF', 'TXT', 'DOCX'));

create unique index if not exists documents_file_path_idx
on public.documents (file_path);

create index if not exists documents_created_at_idx
on public.documents (created_at desc);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  content text not null,
  chunk_index integer not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.document_chunks
add column if not exists document_id uuid references public.documents(id) on delete cascade;

alter table public.document_chunks
add column if not exists content text;

alter table public.document_chunks
add column if not exists chunk_index integer;

alter table public.document_chunks
add column if not exists embedding vector(1536);

alter table public.document_chunks
add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.document_chunks
add column if not exists created_at timestamptz not null default now();

create index if not exists document_chunks_document_id_idx
on public.document_chunks (document_id);

create index if not exists document_chunks_embedding_idx
on public.document_chunks
using hnsw (embedding vector_cosine_ops);

create or replace function public.match_document_chunks (
  query_embedding vector(1536),
  match_count integer default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  chunk_index integer,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    document_chunks.chunk_index,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from public.document_chunks
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

drop policy if exists "Allow document list read" on public.documents;
create policy "Allow document list read"
on public.documents
for select
to anon
using (true);

drop policy if exists "Allow document insert" on public.documents;
create policy "Allow document insert"
on public.documents
for insert
to anon
with check (
  status = 'uploaded'
  and file_type in ('PDF', 'TXT', 'DOCX')
);

drop policy if exists "Allow document update" on public.documents;

drop policy if exists "Allow chunk read" on public.document_chunks;
create policy "Allow chunk read"
on public.document_chunks
for select
to anon
using (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

update storage.buckets
set
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where id = 'documents';

drop policy if exists "Allow document file upload" on storage.objects;
create policy "Allow document file upload"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'documents'
  and lower((storage.foldername(name))[1]) = 'uploads'
);

drop policy if exists "Allow document file read" on storage.objects;
create policy "Allow document file read"
on storage.objects
for select
to anon
using (bucket_id = 'documents');

notify pgrst, 'reload schema';
