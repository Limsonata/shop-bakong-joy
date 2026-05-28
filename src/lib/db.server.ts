// Neon serverless SQL client (HTTP-based, works on Cloudflare Workers).
// Server-only — never import from client code.
import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | undefined;

export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}