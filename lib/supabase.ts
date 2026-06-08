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
  status: string;
  error_message?: string | null;
  created_at: string;
};
