import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServerKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServerKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServerKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function normalize(value: unknown) {
  if (value && typeof value === "object") {
    return JSON.stringify(value).toLowerCase();
  }

  return String(value ?? "").trim().toLowerCase();
}

function includesKeyword(values: unknown[], query: string) {
  if (!query) {
    return true;
  }

  return values.some((value) => normalize(Array.isArray(value) ? value.join(" ") : value).includes(query));
}

function matchesFilters(document: any, filters: any) {
  return (
    (!filters.project_id || document.project_id === filters.project_id) &&
    (!filters.project_name || document.project_name === filters.project_name) &&
    (!filters.category || document.category === filters.category) &&
    (!filters.document_type || document.document_type === filters.document_type) &&
    (!filters.tag || (Array.isArray(document.tags) && document.tags.includes(filters.tag))) &&
    (!filters.status || document.status === filters.status)
  );
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const query = normalize(body.query);
  const filters = {
    project_id: body.project_id || null,
    project_name: body.project_name || null,
    category: body.category || null,
    document_type: body.document_type || null,
    tag: body.tag || null,
    status: body.status || null
  };

  const { data: documents, error: documentError } = await (supabase as any)
    .from("documents")
    .select("id,title,project_id,project_name,category,document_type,tags,file_type,file_path,status,description,created_at")
    .order("created_at", { ascending: false });

  if (documentError) {
    return NextResponse.json({ ok: false, message: documentError.message }, { status: 500 });
  }

  const { data: chunks, error: chunkError } = await (supabase as any)
    .from("document_chunks")
    .select("document_id,content,chunk_index,metadata")
    .limit(500);

  if (chunkError) {
    return NextResponse.json({ ok: false, message: chunkError.message }, { status: 500 });
  }

  const chunksByDocument = new Map<string, any[]>();

  for (const chunk of chunks ?? []) {
    const bucket = chunksByDocument.get(chunk.document_id) ?? [];
    bucket.push(chunk);
    chunksByDocument.set(chunk.document_id, bucket);
  }

  const results = (documents ?? [])
    .filter((document: any) => matchesFilters(document, filters))
    .map((document: any) => {
      const documentChunks = chunksByDocument.get(document.id) ?? [];
      const matchedChunks = documentChunks
        .filter((chunk) => includesKeyword([chunk.content, chunk.metadata], query))
        .slice(0, 5)
        .map((chunk) => ({
          chunk_index: chunk.chunk_index,
          content_preview: String(chunk.content ?? "").slice(0, 260),
          match_type: "keyword"
        }));
      const documentMatches = includesKeyword(
        [
          document.title,
          document.project_name,
          document.category,
          document.document_type,
          document.tags,
          document.description,
          document.file_path
        ],
        query
      );

      return {
        document_id: document.id,
        title: document.title,
        project_id: document.project_id,
        project_name: document.project_name,
        category: document.category,
        document_type: document.document_type,
        tags: document.tags ?? [],
        file_type: document.file_type,
        file_path: document.file_path,
        status: document.status,
        created_at: document.created_at,
        description: document.description,
        matched_chunks: matchedChunks,
        document_matches: documentMatches
      };
    })
    .filter((result: any) => !query || result.document_matches || result.matched_chunks.length > 0);

  return NextResponse.json({
    ok: true,
    results,
    diagnostics: {
      totalDocuments: documents?.length ?? 0,
      indexedChunkCount: chunks?.length ?? 0,
      query,
      filters
    }
  });
}
