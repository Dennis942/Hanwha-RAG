import { apiError, apiOk, getErrorDetail, getServerSupabaseClient, stringifyDebugValue } from "@/lib/api-response";

const documentsBucketName = "documents";
const allowedDocumentTypes = ["PDF", "TXT", "DOCX"] as const;
const maxFileSizeBytes = 20 * 1024 * 1024;

export const runtime = "nodejs";

type RegisterBody = {
  title?: string;
  file_path?: string;
  file_type?: string;
  file_size?: number;
  project_id?: string | null;
  project_name?: string | null;
  category?: string | null;
  document_type?: string | null;
  tags?: string[] | string | null;
  description?: string | null;
};

function normalizeFileType(fileType: string) {
  return fileType.trim().toUpperCase();
}

function isAllowedFileType(fileType: string): fileType is (typeof allowedDocumentTypes)[number] {
  return allowedDocumentTypes.includes(fileType as (typeof allowedDocumentTypes)[number]);
}

function isSafeStoragePath(filePath: string, fileType: string) {
  return new RegExp(`^uploads/[0-9a-f-]{36}\\.${fileType.toLowerCase()}$`, "i").test(filePath);
}

function parseTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return apiError("SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.", {
      status: 500,
      code: "missing_supabase_server_key",
      step: "configuration"
    });
  }

  try {
    const body = (await request.json()) as RegisterBody;
    const title = String(body.title ?? "").trim();
    const filePath = String(body.file_path ?? "").trim();
    const fileType = normalizeFileType(String(body.file_type ?? ""));
    const fileSize = Number(body.file_size ?? 0);
    const projectId = body.project_id ? String(body.project_id) : null;
    let projectName = body.project_name ? String(body.project_name) : null;

    if (!title || !filePath || !isAllowedFileType(fileType) || !isSafeStoragePath(filePath, fileType)) {
      return apiError("문서 등록 요청의 파일 정보가 올바르지 않습니다.", {
        status: 400,
        code: "invalid_document_payload",
        step: "validation",
        bucketName: documentsBucketName,
        fileName: title,
        filePath,
        fileType,
        fileSize
      });
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxFileSizeBytes) {
      return apiError("파일 크기는 20MB 이하만 등록할 수 있습니다.", {
        status: 413,
        code: "file_too_large",
        step: "validation",
        bucketName: documentsBucketName,
        fileName: title,
        filePath,
        fileType,
        fileSize
      });
    }

    if (projectId && !projectName) {
      const { data: project } = await (supabase as any)
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .maybeSingle();
      projectName = project?.name ?? null;
    }

    const row = {
      title,
      file_path: filePath,
      file_type: fileType,
      file_size: fileSize,
      project_id: projectId,
      project_name: projectName,
      category: body.category || null,
      document_type: body.document_type || null,
      tags: parseTags(body.tags),
      description: body.description || null,
      status: "uploaded",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await (supabase as any)
      .from("documents")
      .insert(row)
      .select("id,title,file_path,file_type,file_size,project_id,project_name,category,document_type,tags,description,status,created_at")
      .single();

    if (error) {
      return apiError(error.message, {
        status: 502,
        code: "documents_register_failed",
        step: "documents-register",
        details: error,
        bucketName: documentsBucketName,
        fileName: title,
        filePath,
        fileType,
        fileSize,
        storagePath: filePath,
        registerErrorJson: stringifyDebugValue(error)
      });
    }

    return apiOk({
      step: "documents-register-complete",
      bucketName: documentsBucketName,
      fileName: title,
      filePath,
      fileType,
      fileSize,
      storagePath: filePath,
      document: data as unknown
    });
  } catch (error) {
    return apiError("문서 등록 요청을 처리하지 못했습니다.", {
      status: 500,
      code: "documents_register_request_failed",
      step: "request",
      details: getErrorDetail(error),
      networkError: getErrorDetail(error),
      registerErrorJson: stringifyDebugValue(error)
    });
  }
}
