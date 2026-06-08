import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const documentsBucketName = "documents";
const allowedDocumentTypes = ["PDF", "TXT", "DOCX"] as const;
const maxFileSizeBytes = 20 * 1024 * 1024;

export const runtime = "nodejs";

type RegisterBody = {
  title?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
};

function stringifyDebugValue(value: unknown) {
  try {
    return JSON.stringify(value, Object.getOwnPropertyNames(value), 2);
  } catch {
    return String(value);
  }
}

function getErrorDetail(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    name: typeof error,
    message: stringifyDebugValue(error),
    stack: undefined
  };
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

function isAllowedFileType(fileType: string): fileType is (typeof allowedDocumentTypes)[number] {
  return allowedDocumentTypes.includes(fileType as (typeof allowedDocumentTypes)[number]);
}

function isSafeStoragePath(filePath: string, fileType: string) {
  return new RegExp(`^uploads/[0-9a-f-]{36}\\.${fileType.toLowerCase()}$`, "i").test(filePath);
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        step: "configuration",
        message: "SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다."
      },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as RegisterBody;
    const title = String(body.title ?? "").trim();
    const filePath = String(body.file_path ?? "").trim();
    const fileType = normalizeFileType(String(body.file_type ?? ""));
    const fileSize = Number(body.file_size ?? 0);

    if (!title || !filePath || !isAllowedFileType(fileType) || !isSafeStoragePath(filePath, fileType)) {
      return NextResponse.json(
        {
          ok: false,
          step: "validation",
          message: "문서 등록 요청의 파일 정보가 올바르지 않습니다.",
          bucketName: documentsBucketName,
          fileName: title,
          filePath,
          fileType,
          fileSize
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxFileSizeBytes) {
      return NextResponse.json(
        {
          ok: false,
          step: "validation",
          message: "파일 크기는 20MB 이하만 등록할 수 있습니다.",
          bucketName: documentsBucketName,
          fileName: title,
          filePath,
          fileType,
          fileSize
        },
        { status: 413 }
      );
    }

    const row = {
      title,
      file_path: filePath,
      file_type: fileType,
      file_size: fileSize,
      status: "uploaded",
      created_at: new Date().toISOString()
    };

    const { data, error } = await (supabase as any)
      .from("documents")
      .insert(row)
      .select("id,title,file_path,file_type,file_size,status,created_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          step: "documents-register",
          message: error.message,
          bucketName: documentsBucketName,
          fileName: title,
          filePath,
          fileType,
          fileSize,
          storagePath: filePath,
          registerErrorJson: stringifyDebugValue(error)
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      step: "documents-register-complete",
      bucketName: documentsBucketName,
      fileName: title,
      filePath,
      fileType,
      fileSize,
      storagePath: filePath,
      document: data
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        step: "request",
        message: "문서 등록 요청을 처리하지 못했습니다.",
        networkError: getErrorDetail(error),
        registerErrorJson: stringifyDebugValue(error)
      },
      { status: 500 }
    );
  }
}
