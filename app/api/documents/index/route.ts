import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { apiError, apiOk, getErrorMessage, getServerSupabaseClient, stringifyDebugValue } from "@/lib/api-response";

const documentsBucketName = "documents";
const embeddingModel = "text-embedding-3-small";
const chunkSize = 1000;
const embeddingBatchSize = 100;

export const runtime = "nodejs";
export const maxDuration = 60;

type DocumentRow = {
  id: string;
  title: string;
  file_path: string;
  file_type: string;
  status: string;
  project_id?: string | null;
  project_name?: string | null;
  category?: string | null;
  document_type?: string | null;
  tags?: string[] | null;
};

type DocumentStatus = "uploaded" | "indexing" | "indexed" | "failed";
type DocumentUpdatePayload = {
  status: DocumentStatus;
  error_message: string | null;
};
type DocumentChunkInsertPayload = {
  document_id: string;
  content: string;
  chunk_index: number;
  embedding: string;
  metadata: {
    document_id: string;
    title: string;
    file_path: string;
    project_id: string | null;
    project_name: string | null;
    category: string | null;
    document_type: string | null;
    tags: string[];
    chunk_index: number;
    file_type: string;
    embedding_model: string;
  };
};
type SupabaseQueryError = {
  message: string;
};
type SupabaseQueryResult<T> = {
  data: T | null;
  error: SupabaseQueryError | null;
};

function documentStatusPayload(status: DocumentStatus, errorMessage: string | null = null): DocumentUpdatePayload {
  return {
    status,
    error_message: errorMessage
  };
}

function normalizeFileType(fileType: string) {
  return fileType.trim().toUpperCase();
}

function splitIntoChunks(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const chunks: string[] = [];

  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize).trim();

    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

async function extractTextFromFile(file: Blob, fileType: string) {
  const normalizedType = normalizeFileType(fileType);

  if (normalizedType === "TXT") {
    return file.text();
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (normalizedType === "PDF") {
    const parsed = await pdfParse(buffer);

    return parsed.text;
  }

  if (normalizedType === "DOCX") {
    const result = await mammoth.extractRawText({ buffer });

    return result.value;
  }

  throw new Error(`지원하지 않는 파일 유형입니다: ${fileType}`);
}

async function createEmbeddings(chunks: string[]) {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const embeddings: number[][] = [];

  for (let index = 0; index < chunks.length; index += embeddingBatchSize) {
    const batch = chunks.slice(index, index + embeddingBatchSize);
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: embeddingModel,
        input: batch
      })
    });

    const responseText = await response.text();
    const responseBody = parseJsonResponse(responseText);

    if (!response.ok) {
      throw new Error(responseBody?.error?.message ?? "OpenAI embedding 생성에 실패했습니다.");
    }

    const batchEmbeddings = (responseBody.data as Array<{ embedding: number[]; index: number }>)
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}

function toVector(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

function parseJsonResponse(text: string): {
  data?: Array<{ embedding: number[]; index: number }>;
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

async function indexDocument(supabase: any, document: DocumentRow) {
  const { error: indexingStatusError } = (await supabase
    .from("documents")
    .update(documentStatusPayload("indexing"))
    .eq("id", document.id)) as SupabaseQueryResult<null>;

  if (indexingStatusError) {
    return {
      documentId: document.id,
      title: document.title,
      status: "failed",
      error: indexingStatusError.message
    };
  }

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from(documentsBucketName)
      .download(document.file_path);

    if (downloadError || !file) {
      throw new Error(downloadError?.message ?? "Storage에서 파일을 다운로드하지 못했습니다.");
    }

    const text = await extractTextFromFile(file, document.file_type);
    const chunks = splitIntoChunks(text);

    if (chunks.length === 0) {
      throw new Error("추출된 텍스트가 없습니다.");
    }

    const embeddings = await createEmbeddings(chunks);

    await supabase.from("document_chunks").delete().eq("document_id", document.id);

    const rows: DocumentChunkInsertPayload[] = chunks.map((content, index) => ({
      document_id: document.id,
      content,
      chunk_index: index,
      embedding: toVector(embeddings[index]),
      metadata: {
        document_id: document.id,
        title: document.title,
        file_path: document.file_path,
        project_id: document.project_id ?? null,
        project_name: document.project_name ?? null,
        category: document.category ?? null,
        document_type: document.document_type ?? null,
        tags: document.tags ?? [],
        chunk_index: index,
        file_type: normalizeFileType(document.file_type),
        embedding_model: embeddingModel
      }
    }));

    const { error: insertError } = (await supabase.from("document_chunks").insert(rows)) as SupabaseQueryResult<null>;

    if (insertError) {
      throw new Error(insertError.message);
    }

    const { error: updateError } = (await supabase
      .from("documents")
      .update(documentStatusPayload("indexed"))
      .eq("id", document.id)) as SupabaseQueryResult<null>;

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      documentId: document.id,
      title: document.title,
      status: "indexed",
      chunkCount: chunks.length
    };
  } catch (error) {
    const message = getErrorMessage(error);

    await supabase
      .from("documents")
      .update(documentStatusPayload("failed", message))
      .eq("id", document.id);

    return {
      documentId: document.id,
      title: document.title,
      status: "failed",
      error: message
    };
  }
}

export async function POST(request: Request) {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return apiError("Supabase 서버 환경변수가 설정되지 않았습니다.", {
      status: 500,
      code: "missing_supabase_server_key",
      step: "configuration"
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const documentId = typeof body?.documentId === "string" ? body.documentId : null;
    let query = (supabase as any)
      .from("documents")
      .select("id,title,file_path,file_type,status,project_id,project_name,category,document_type,tags")
      .eq("status", "uploaded")
      .order("created_at", { ascending: true });

    if (documentId) {
      query = query.eq("id", documentId);
    }

    const { data: documents, error } = (await query) as SupabaseQueryResult<DocumentRow[]>;

    if (error) {
      throw new Error(error.message);
    }

    if (!documents || documents.length === 0) {
      return apiOk({
        message: "인덱싱할 uploaded 상태 문서가 없습니다.",
        results: []
      });
    }

    const results = [];

    for (const document of documents as DocumentRow[]) {
      results.push(await indexDocument(supabase, document));
    }

    return apiOk({
      results
    });
  } catch (error) {
    return apiError(getErrorMessage(error), {
      status: 500,
      code: "document_index_failed",
      step: "documents-index",
      details: stringifyDebugValue(error)
    });
  }
}
