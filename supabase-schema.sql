-- Supabase schema for Hanwha-RAG document upload MVP.
-- Run this in the Supabase SQL Editor before deploying the upload flow.

create extension if not exists vector;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text default '진행',
  category text,
  tags text[] default '{}'::text[],
  objective text,
  owner text default '미지정',
  start_date date,
  end_date date,
  memo text,
  decisions jsonb default '[]'::jsonb,
  timeline jsonb default '[]'::jsonb,
  archived boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists status text default '진행';
alter table public.projects add column if not exists category text;
alter table public.projects add column if not exists tags text[] default '{}'::text[];
alter table public.projects add column if not exists objective text;
alter table public.projects add column if not exists owner text;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists end_date date;
alter table public.projects add column if not exists memo text;
alter table public.projects add column if not exists decisions jsonb default '[]'::jsonb;
alter table public.projects add column if not exists timeline jsonb default '[]'::jsonb;
alter table public.projects add column if not exists archived boolean default false;
alter table public.projects add column if not exists created_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();

update public.projects
set owner = '미지정'
where owner is null or btrim(owner) = '';

alter table public.projects alter column owner set default '미지정';

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

alter table public.documents add column if not exists project_id uuid;
alter table public.documents add column if not exists project_name text;
alter table public.documents add column if not exists category text;
alter table public.documents add column if not exists document_type text;
alter table public.documents add column if not exists tags text[] default '{}'::text[];
alter table public.documents add column if not exists description text;
alter table public.documents add column if not exists updated_at timestamptz not null default now();

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

alter table public.documents
drop constraint if exists documents_status_check;

alter table public.documents
add constraint documents_status_check check (status in ('uploaded', 'indexing', 'indexed', 'failed'));

create unique index if not exists documents_file_path_idx
on public.documents (file_path);

create index if not exists documents_created_at_idx
on public.documents (created_at desc);

create index if not exists documents_title_idx
on public.documents (title);

create index if not exists documents_project_id_idx
on public.documents (project_id);

create index if not exists documents_project_name_idx
on public.documents (project_name);

create index if not exists documents_category_idx
on public.documents (category);

create index if not exists documents_status_idx
on public.documents (status);

create index if not exists projects_updated_at_idx
on public.projects (updated_at desc);

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

create unique index if not exists document_chunks_document_id_chunk_index_idx
on public.document_chunks (document_id, chunk_index);

create index if not exists document_chunks_embedding_idx
on public.document_chunks
using hnsw (embedding vector_cosine_ops);

create or replace function public.match_document_chunks (
  query_embedding vector(1536),
  match_count integer default 5,
  filter_project_id uuid default null,
  filter_project_name text default null,
  filter_category text default null,
  filter_document_type text default null,
  filter_tag text default null
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
  where
    (filter_project_id is null or (document_chunks.metadata->>'project_id')::uuid = filter_project_id)
    and (filter_project_name is null or document_chunks.metadata->>'project_name' = filter_project_name)
    and (filter_category is null or document_chunks.metadata->>'category' = filter_category)
    and (filter_document_type is null or document_chunks.metadata->>'document_type' = filter_document_type)
    and (
      filter_tag is null
      or exists (
        select 1
        from jsonb_array_elements_text(coalesce(document_chunks.metadata->'tags', '[]'::jsonb)) as tag(value)
        where tag.value = filter_tag
      )
    )
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;

create table if not exists public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sources jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  project_id uuid,
  project_name text,
  created_at timestamptz not null default now()
);

alter table public.chat_logs add column if not exists filters jsonb not null default '{}'::jsonb;
alter table public.chat_logs add column if not exists project_id uuid;
alter table public.chat_logs add column if not exists project_name text;

alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_logs enable row level security;

drop policy if exists "Allow project read" on public.projects;
create policy "Allow project read"
on public.projects
for select
to anon
using (true);

drop policy if exists "Allow document list read" on public.documents;
create policy "Allow document list read"
on public.documents
for select
to anon
using (true);

drop policy if exists "Allow document insert" on public.documents;

drop policy if exists "Allow document update" on public.documents;

drop policy if exists "Allow chunk read" on public.document_chunks;
create policy "Allow chunk read"
on public.document_chunks
for select
to anon
using (true);

drop policy if exists "Allow chat log read" on public.chat_logs;
create policy "Allow chat log read"
on public.chat_logs
for select
to anon
using (true);

create index if not exists chat_logs_project_id_idx
on public.chat_logs (project_id);

create index if not exists chat_logs_created_at_idx
on public.chat_logs (created_at desc);

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

notify pgrst, 'reload schema';
