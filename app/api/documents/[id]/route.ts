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
  const supabase = getSupabaseClient();
  const params = await context?.params;
  const id = params?.id;

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
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
    updated_at: new Date().toISOString()
  };

  const { data, error } = await (supabase as any)
    .from("documents")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document: data, message: "분류 변경으로 재인덱싱이 필요합니다." });
}
