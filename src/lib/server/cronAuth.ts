// Server-only: check the "Authorization: Bearer <CRON_SECRET>" header Vercel Cron sends.
import { timingSafeEqual } from "node:crypto";
import { getEnv } from "./supabaseAdmin";

/** True only when CRON_SECRET is set and the header matches it exactly. */
export function cronAuthorised(header: string | null): boolean {
  const secret = getEnv("CRON_SECRET");
  if (!secret) return false;
  const given = Buffer.from(header ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
