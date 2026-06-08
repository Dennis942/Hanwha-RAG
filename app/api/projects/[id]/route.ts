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

function toProjectPatch(body: any) {
  return {
    description: body.description ?? null,
    status: body.status ?? "진행",
    category: body.category ?? null,
    tags: parseTags(body.tags),
    objective: body.objective ?? null,
    owner: body.owner ?? null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    memo: body.memo ?? null,
    decisions: Array.isArray(body.decisions) ? body.decisions : [],
    timeline: Array.isArray(body.timeline) ? body.timeline : [],
    updated_at: new Date().toISOString()
  };
}

export async function GET(_request: Request, context: any) {
  const supabase = getSupabaseClient();
  const params = await context?.params;
  const id = params?.id;

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data, error } = await (supabase as any)
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, project: data });
}

export async function PATCH(request: Request, context: any) {
  const supabase = getSupabaseClient();
  const params = await context?.params;
  const id = params?.id;

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
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
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, project: data });
}
