-- Supabase schema for Hanwha-RAG document upload MVP.
-- Run this in the Supabase SQL Editor before deploying the upload flow.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null unique,
  file_type text not null check (file_type in ('pdf', 'txt', 'docx')),
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

create index if not exists documents_created_at_idx
on public.documents (created_at desc);

alter table public.documents enable row level security;

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
  and file_type in ('pdf', 'txt', 'docx')
);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

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
