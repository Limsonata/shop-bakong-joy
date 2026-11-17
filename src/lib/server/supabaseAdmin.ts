// Server-only Supabase helpers. Only import from server function handlers,
// server route handlers or other modules in src/lib/server.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function getSupabaseUrl(): string {
  const value = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  if (!value) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  return value;
}

export function createServiceClient(): SupabaseClient {
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Today's date in Phnom Penh (the server runs in UTC). */
export function shopToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Phnom_Penh" }).format(new Date());
}
