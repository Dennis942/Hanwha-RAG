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
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data, error } = await (supabase as any)
    .from("projects")
    .select("*")
    .eq("archived", false)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, projects: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const row = toProjectRow(body);

  if (!row.name) {
    return NextResponse.json({ ok: false, message: "프로젝트명을 입력해주세요." }, { status: 400 });
  }

  const { data, error } = await (supabase as any)
    .from("projects")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, project: data });
}
