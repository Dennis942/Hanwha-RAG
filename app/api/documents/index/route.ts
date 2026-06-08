import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    type PdfParse = (dataBuffer: Buffer) => Promise<{ text: string }>;
    const pdfParseModule = (await import("pdf-parse")) as unknown as { default?: PdfParse } & PdfParse;
    const pdfParse = pdfParseModule.default ?? pdfParseModule;
    const parsed = await pdfParse(buffer);

    return parsed.text;
  }

  if (normalizedType === "DOCX") {
    const mammoth = await import("mammoth");
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

async function indexDocument(supabase: ReturnType<typeof createClient>, document: DocumentRow) {
  const { error: indexingStatusError } = await supabase
    .from("documents")
    .update({ status: "indexing", error_message: null })
    .eq("id", document.id);

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

    const rows = chunks.map((content, index) => ({
      document_id: document.id,
      content,
      chunk_index: index,
      embedding: toVector(embeddings[index]),
      metadata: {
        title: document.title,
        file_path: document.file_path,
        file_type: normalizeFileType(document.file_type),
        embedding_model: embeddingModel
      }
    }));

    const { error: insertError } = await supabase.from("document_chunks").insert(rows);

    if (insertError) {
      throw new Error(insertError.message);
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({ status: "indexed", error_message: null })
      .eq("id", document.id);

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
      .update({ status: "failed", error_message: message })
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
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase 환경변수가 설정되지 않았습니다."
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const documentId = typeof body?.documentId === "string" ? body.documentId : null;
    let query = supabase
      .from("documents")
      .select("id,title,file_path,file_type,status")
      .eq("status", "uploaded")
      .order("created_at", { ascending: true });

    if (documentId) {
      query = query.eq("id", documentId);
    }

    const { data: documents, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "인덱싱할 uploaded 상태 문서가 없습니다.",
        results: []
      });
    }

    const results = [];

    for (const document of documents as DocumentRow[]) {
      results.push(await indexDocument(supabase, document));
    }

    return NextResponse.json({
      ok: true,
      results
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
