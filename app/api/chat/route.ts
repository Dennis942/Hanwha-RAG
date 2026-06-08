import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const embeddingModel = "text-embedding-3-small";
const answerModel = "gpt-4o-mini";
const fallbackAnswer = "등록된 문서에서 확인되지 않습니다.";

export const runtime = "nodejs";
export const maxDuration = 60;

type MatchChunk = {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  metadata: {
    document_id?: string;
    title?: string;
    file_path?: string;
    project_id?: string;
    project_name?: string;
    category?: string;
    document_type?: string;
    tags?: string[];
    file_type?: string;
  } | null;
  similarity: number;
};

type Source = {
  documentId: string;
  documentTitle: string;
  filePath: string;
  projectId: string | null;
  projectName: string | null;
  category: string | null;
  documentType: string | null;
  tags: string[];
  chunkIndex: number;
  similarity: number;
  content: string;
};

type ChatFilters = {
  project_id?: string | null;
  project_name?: string | null;
  category?: string | null;
  document_type?: string | null;
  tag?: string | null;
};

function stringifyDebugValue(value: unknown) {
  try {
    return JSON.stringify(value, Object.getOwnPropertyNames(value), 2);
  } catch {
    return String(value);
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return stringifyDebugValue(error);
}

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

function toVector(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

function parseJsonResponse(text: string): {
  data?: Array<{ embedding: number[] }>;
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
} {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: {
        message: text
      }
    };
  }
}

async function createQuestionEmbedding(question: string) {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: question
    })
  });
  const responseBody = parseJsonResponse(await response.text());

  if (!response.ok) {
    throw new Error(responseBody.error?.message ?? "질문 embedding 생성에 실패했습니다.");
  }

  const embedding = responseBody.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error("질문 embedding 응답이 비어 있습니다.");
  }

  return embedding;
}

function buildSources(chunks: MatchChunk[]): Source[] {
  return chunks.map((chunk) => ({
    documentId: chunk.document_id,
    documentTitle: chunk.metadata?.title ?? "제목 없는 문서",
    filePath: chunk.metadata?.file_path ?? "",
    projectId: chunk.metadata?.project_id ?? null,
    projectName: chunk.metadata?.project_name ?? null,
    category: chunk.metadata?.category ?? null,
    documentType: chunk.metadata?.document_type ?? null,
    tags: Array.isArray(chunk.metadata?.tags) ? chunk.metadata.tags : [],
    chunkIndex: chunk.chunk_index,
    similarity: chunk.similarity,
    content: chunk.content
  }));
}

function buildContext(sources: Source[]) {
  return sources
    .map((source, index) => {
      return [
        `[Source ${index + 1}]`,
        `문서명: ${source.documentTitle}`,
        `파일 경로: ${source.filePath}`,
        `프로젝트: ${source.projectName ?? "미분류"}`,
        `카테고리: ${source.category ?? "미분류"}`,
        `문서 유형: ${source.documentType ?? "미분류"}`,
        `태그: ${source.tags.join(", ") || "없음"}`,
        `chunk 번호: ${source.chunkIndex}`,
        `내용: ${source.content}`
      ].join("\n");
    })
    .join("\n\n");
}

async function createAnswer(question: string, sources: Source[]) {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  if (sources.length === 0) {
    return fallbackAnswer;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: answerModel,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You answer only from the provided document context. If the context does not contain enough evidence, answer exactly: 등록된 문서에서 확인되지 않습니다. Do not use outside knowledge."
        },
        {
          role: "user",
          content: `질문:\n${question}\n\n등록된 문서 context:\n${buildContext(sources)}`
        }
      ]
    })
  });
  const responseBody = parseJsonResponse(await response.text());

  if (!response.ok) {
    throw new Error(responseBody.error?.message ?? "답변 생성에 실패했습니다.");
  }

  return responseBody.choices?.[0]?.message?.content?.trim() || fallbackAnswer;
}

function normalizeFilters(value: any): ChatFilters {
  return {
    project_id: value?.project_id || null,
    project_name: value?.project_name || null,
    category: value?.category || null,
    document_type: value?.document_type || null,
    tag: value?.tag || null
  };
}

async function saveChatLog(supabase: any, input: { question: string; answer: string; sources: Source[]; filters: ChatFilters }) {
  const { error } = await supabase.from("chat_logs").insert({
    question: input.question,
    answer: input.answer,
    sources: input.sources,
    filters: input.filters,
    project_id: input.filters.project_id,
    project_name: input.filters.project_name,
    created_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function GET() {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase 서버 환경변수가 설정되지 않았습니다."
      },
      { status: 500 }
    );
  }

  const { data, error } = await (supabase as any)
    .from("chat_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, logs: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase 서버 환경변수가 설정되지 않았습니다."
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const question = String(body?.question ?? "").trim();

    if (!question) {
      return NextResponse.json(
        {
          ok: false,
          message: "질문을 입력해주세요."
        },
        { status: 400 }
      );
    }

    const filters = normalizeFilters(body?.filters);
    const embedding = await createQuestionEmbedding(question);
    const { data: chunks, error: matchError } = await (supabase as any).rpc("match_document_chunks", {
      query_embedding: toVector(embedding),
      match_count: 5,
      filter_project_id: filters.project_id,
      filter_project_name: filters.project_name,
      filter_category: filters.category,
      filter_document_type: filters.document_type,
      filter_tag: filters.tag
    });

    if (matchError) {
      throw new Error(matchError.message);
    }

    const sources = buildSources((chunks ?? []) as MatchChunk[]);
    const answer = await createAnswer(question, sources);
    const { count: indexedDocumentCount } = await (supabase as any)
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "indexed");

    await saveChatLog(supabase, {
      question,
      answer,
      sources,
      filters
    });

    return NextResponse.json({
      ok: true,
      answer,
      sources,
      diagnostics: {
        filters,
        searchedChunkCount: sources.length,
        indexedDocumentCount: indexedDocumentCount ?? 0
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: getErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
