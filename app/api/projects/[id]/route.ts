import { apiError, apiOk, getServerSupabaseClient } from "@/lib/api-response";

export const runtime = "nodejs";
const defaultOwner = "미지정";

function parseTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function toProjectPatch(body: any) {
  return {
    description: body.description ?? null,
    status: body.status ?? "진행",
    category: body.category ?? null,
    tags: parseTags(body.tags),
    objective: body.objective ?? null,
    owner: String(body.owner ?? "").trim() || defaultOwner,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    memo: body.memo ?? null,
    decisions: Array.isArray(body.decisions) ? body.decisions : [],
    timeline: Array.isArray(body.timeline) ? body.timeline : [],
    updated_at: new Date().toISOString()
  };
}

export async function GET(_request: Request, context: any) {
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
    return apiError("프로젝트 ID가 필요합니다.", {
      status: 400,
      code: "project_id_required",
      step: "validation"
    });
  }

  const { data, error } = await (supabase as any)
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return apiError(error.message, {
      status: 500,
      code: "project_load_failed",
      step: "project-detail",
      details: error
    });
  }

  return apiOk({ project: data as unknown });
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
    return apiError("프로젝트 ID가 필요합니다.", {
      status: 400,
      code: "project_id_required",
      step: "validation"
    });
  }

  const body = await request.json().catch(() => ({}));
  const patch = toProjectPatch(body);

  const { data, error } = await (supabase as any)
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return apiError(error.message, {
      status: 500,
      code: "project_update_failed",
      step: "project-update",
      details: error
    });
  }

  return apiOk({ project: data as unknown });
}
