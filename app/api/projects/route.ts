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

function toProjectRow(body: any) {
  return {
    name: String(body.name ?? "").trim(),
    description: String(body.description ?? "").trim() || null,
    status: String(body.status ?? "진행").trim() || "진행",
    category: String(body.category ?? "").trim() || null,
    tags: parseTags(body.tags),
    objective: String(body.objective ?? "").trim() || null,
    owner: String(body.owner ?? "").trim() || null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    memo: String(body.memo ?? "").trim() || null,
    decisions: Array.isArray(body.decisions) ? body.decisions : [],
    timeline: Array.isArray(body.timeline) ? body.timeline : [],
    updated_at: new Date().toISOString()
  };
}

export async function GET() {
  const supabase = getServerSupabaseClient();

  if (!supabase) {
    return apiError("Supabase 서버 환경변수가 설정되지 않았습니다.", {
      status: 500,
      code: "missing_supabase_server_key",
      step: "configuration"
    });
  }

  const { data, error } = await (supabase as any)
    .from("projects")
    .select("*")
    .eq("archived", false)
    .order("updated_at", { ascending: false });

  if (error) {
    return apiError(error.message, {
      status: 500,
      code: "projects_load_failed",
      step: "projects-list",
      details: error
    });
  }

  return apiOk({ projects: data ?? [] });
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

  const body = await request.json().catch(() => ({}));
  const row = toProjectRow(body);

  if (!row.name) {
    return apiError("프로젝트명을 입력해주세요.", {
      status: 400,
      code: "project_name_required",
      step: "validation"
    });
  }

  const { data, error } = await (supabase as any)
    .from("projects")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    return apiError(error.message, {
      status: 500,
      code: "project_create_failed",
      step: "project-create",
      details: error
    });
  }

  return apiOk({ project: data as unknown });
}
