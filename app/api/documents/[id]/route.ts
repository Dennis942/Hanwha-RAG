import { apiError, apiOk, getServerSupabaseClient } from "@/lib/api-response";

export const runtime = "nodejs";

function parseTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function PATCH(request: Request, context: any) {
  const supabase = getServerSupabaseClient();
  const params = await context?.params;
  const id = params?.id;

  if (!supabase) {
    return apiError("Supabase 서버 환경변수가 설정되지 않았습니다.", {
      status: 500,
      code: "missing_supabase_server_key",
      step: "configuration"
    });
  }

  if (!id) {
    return apiError("문서 ID가 필요합니다.", {
      status: 400,
      code: "document_id_required",
      step: "validation"
    });
  }

  const body = await request.json().catch(() => ({}));
  const projectId = body.project_id || null;
  let projectName = body.project_name || null;

  if (projectId && !projectName) {
    const { data: project } = await (supabase as any)
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();
    projectName = project?.name ?? null;
  }

  const patch = {
    project_id: projectId,
    project_name: projectName,
    category: body.category || null,
    document_type: body.document_type || null,
    tags: parseTags(body.tags),
    description: body.description || null,
    status: "uploaded",
    error_message: null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await (supabase as any)
    .from("documents")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return apiError(error.message, {
      status: 500,
      code: "document_update_failed",
      step: "document-update",
      details: error
    });
  }

  return apiOk({ document: data as unknown, message: "분류 변경으로 재인덱싱이 필요합니다." });
}

export async function DELETE(_request: Request, context: any) {
  const supabase = getServerSupabaseClient();
  const params = await context?.params;
  const id = params?.id;

  if (!supabase) {
    return apiError("Supabase 서버 환경변수가 설정되지 않았습니다.", {
      status: 500,
      code: "missing_supabase_server_key",
      step: "configuration"
    });
  }

  if (!id) {
    return apiError("문서 ID가 필요합니다.", {
      status: 400,
      code: "document_id_required",
      step: "validation"
    });
  }

  const { data: document, error: loadError } = await (supabase as any)
    .from("documents")
    .select("id,file_path")
    .eq("id", id)
    .single();

  if (loadError || !document) {
    return apiError(loadError?.message ?? "삭제할 문서를 찾지 못했습니다.", {
      status: 404,
      code: "document_not_found",
      step: "document-delete-load",
      details: loadError
    });
  }

  const { error: chunkError } = await (supabase as any)
    .from("document_chunks")
    .delete()
    .eq("document_id", id);

  if (chunkError) {
    return apiError(chunkError.message, {
      status: 500,
      code: "document_chunks_delete_failed",
      step: "document-delete-chunks",
      details: chunkError
    });
  }

  if (document.file_path) {
    const { error: storageError } = await (supabase as any).storage
      .from("documents")
      .remove([document.file_path]);

    if (storageError) {
      return apiError(storageError.message, {
        status: 500,
        code: "document_storage_delete_failed",
        step: "document-delete-storage",
        details: storageError
      });
    }
  }

  const { error: deleteError } = await (supabase as any)
    .from("documents")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return apiError(deleteError.message, {
      status: 500,
      code: "document_delete_failed",
      step: "document-delete-row",
      details: deleteError
    });
  }

  return apiOk({ message: "문서와 인덱싱 데이터가 삭제되었습니다." });
}
