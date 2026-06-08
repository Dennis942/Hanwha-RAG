import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseDiagnostics = {
  url: supabaseUrl ?? "",
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  anonKeyPreview: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 12)}...` : ""
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export type SupabaseDocument = {
  id: string;
  title: string;
  file_path: string;
  file_type: string;
  file_size?: number | null;
  project_id?: string | null;
  project_name?: string | null;
  category?: string | null;
  document_type?: string | null;
  tags?: string[] | null;
  description?: string | null;
  status: string;
  error_message?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type SupabaseProject = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  category?: string | null;
  tags?: string[] | null;
  objective?: string | null;
  owner?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  memo?: string | null;
  decisions?: Array<{ date?: string; text?: string }> | null;
  timeline?: Array<{ date?: string; text?: string }> | null;
  archived?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ChatLog = {
  id: string;
  question: string;
  answer: string;
  sources: unknown[];
  filters?: Record<string, unknown> | null;
  project_id?: string | null;
  project_name?: string | null;
  created_at: string;
};
