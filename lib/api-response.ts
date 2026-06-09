import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ApiErrorOptions = {
  status?: number;
  code?: string;
  step?: string;
  details?: unknown;
} & Record<string, unknown>;

export function stringifyDebugValue(value: unknown) {
  try {
    return JSON.stringify(value, Object.getOwnPropertyNames(value), 2);
  } catch {
    return String(value);
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return stringifyDebugValue(error);
}

export function getErrorDetail(error: unknown) {
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

export function apiError(message: string, options: ApiErrorOptions = {}) {
  const { status = 500, code = "internal_error", step, details, ...extra } = options;

  return NextResponse.json(
    {
      ok: false,
      message,
      step,
      error: {
        code,
        message,
        step,
        details
      },
      ...extra
    },
    { status }
  );
}

export function apiOk(body: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status });
}

export function getServerSupabaseClient() {
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

