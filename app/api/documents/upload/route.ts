import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const documentsBucketName = "documents";
const allowedDocumentExtensions = ["pdf", "txt", "docx"] as const;

export const runtime = "nodejs";

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

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
  const supabasePublicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServerKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseApiKey = supabaseServerKey ?? supabasePublicKey;

  if (!supabaseUrl || !supabaseApiKey) {
    return {
      client: null,
      diagnostics: {
        hasUrl: Boolean(supabaseUrl),
        hasPublicKey: Boolean(supabasePublicKey),
        hasServerKey: Boolean(supabaseServerKey),
        keyMode: "missing"
      }
    };
  }

  return {
    client: createClient(supabaseUrl, supabaseApiKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }),
    diagnostics: {
      hasUrl: true,
      hasPublicKey: Boolean(supabasePublicKey),
      hasServerKey: Boolean(supabaseServerKey),
      keyMode: supabaseServerKey ? "server" : "public"
    }
  };
}

export async function POST(request: Request) {
  const { client: supabase, diagnostics } = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        step: "configuration",
        message: "Supabase 환경변수가 설정되지 않았습니다.",
        diagnostics
      },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const filePath = String(formData.get("filePath") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          step: "validation",
          message: "업로드할 파일이 없습니다."
        },
        { status: 400 }
      );
    }

    const fileType = getFileExtension(file.name);

    if (!allowedDocumentExtensions.includes(fileType as (typeof allowedDocumentExtensions)[number])) {
      return NextResponse.json(
        {
          ok: false,
          step: "validation",
          message: "PDF, TXT, DOCX 파일만 업로드할 수 있습니다.",
          fileType
        },
        { status: 400 }
      );
    }

    if (!filePath.startsWith("uploads/")) {
      return NextResponse.json(
        {
          ok: false,
          step: "validation",
          message: "Storage file path는 uploads/로 시작해야 합니다.",
          filePath
        },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let storagePath = "";

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(documentsBucketName)
        .upload(filePath, fileBuffer, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false
        });

      if (uploadError) {
        return NextResponse.json(
          {
            ok: false,
            step: "storage-upload",
            message: uploadError.message,
            bucketName: documentsBucketName,
            filePath,
            uploadErrorJson: stringifyDebugValue(uploadError)
          },
          { status: 502 }
        );
      }

      storagePath = uploadData.path;
    } catch (uploadException) {
      return NextResponse.json(
        {
          ok: false,
          step: "storage-upload",
          message: "Storage upload 중 네트워크 오류가 발생했습니다.",
          bucketName: documentsBucketName,
          filePath,
          networkError: getErrorDetail(uploadException),
          uploadErrorJson: stringifyDebugValue(uploadException)
        },
        { status: 502 }
      );
    }

    try {
      const { error: insertError } = await supabase.from("documents").insert({
        title: file.name,
        file_path: storagePath,
        file_type: fileType,
        status: "uploaded",
        created_at: new Date().toISOString()
      });

      if (insertError) {
        return NextResponse.json(
          {
            ok: false,
            step: "documents-insert",
            message: insertError.message,
            bucketName: documentsBucketName,
            filePath,
            storagePath,
            insertErrorJson: stringifyDebugValue(insertError)
          },
          { status: 502 }
        );
      }
    } catch (insertException) {
      return NextResponse.json(
        {
          ok: false,
          step: "documents-insert",
          message: "documents insert 중 네트워크 오류가 발생했습니다.",
          bucketName: documentsBucketName,
          filePath,
          storagePath,
          networkError: getErrorDetail(insertException),
          insertErrorJson: stringifyDebugValue(insertException)
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      bucketName: documentsBucketName,
      filePath,
      storagePath,
      document: {
        title: file.name,
        file_path: storagePath,
        file_type: fileType,
        status: "uploaded"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        step: "request",
        message: "업로드 요청을 처리하지 못했습니다.",
        networkError: getErrorDetail(error),
        uploadErrorJson: stringifyDebugValue(error)
      },
      { status: 500 }
    );
  }
}
