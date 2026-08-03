import { execFileSync } from "node:child_process";

/** True when the sandbox has managed database credentials available. */
export const hasDb = Boolean(process.env.PGHOST);

/** Run SQL through psql and return the raw tuple-only lines. */
export function sql(query: string): string[] {
  const out = execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1", "-c", query], {
    encoding: "utf8",
  });
  return out.split("\n").filter((l) => l.length > 0);
}

/**
 * Execute `query` inside a rolled-back transaction while impersonating the
 * `authenticated` PostgREST role with the given auth.uid(). This exercises the
 * real RLS policies exactly as the app's client would hit them.
 *
 * `setup` runs BEFORE the role switch (as the owner) so fixtures can be seeded.
 * Everything is rolled back, so the database is never mutated.
 */
export function asUser(uid: string, query: string, setup = ""): string[] {
  const claims = JSON.stringify({ sub: uid, role: "authenticated" }).replace(/'/g, "''");
  const script = [
    "BEGIN;",
    setup,
    "SET LOCAL ROLE authenticated;",
    `SELECT set_config('request.jwt.claims', '${claims}', true);`,
    query,
    "ROLLBACK;",
  ]
    .filter(Boolean)
    .join("\n");

  const out = execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    input: script,
  });
  // set_config echoes a row before our query output; drop everything up to it.
  const lines = out.split("\n").filter((l) => l.length > 0);
  const idx = lines.findIndex((l) => l.startsWith("{"));
  return idx >= 0 ? lines.slice(idx + 1) : lines;
}

/** First user id holding `role`, or null when no such user exists yet. */
export function userWithRole(role: string): string | null {
  const rows = sql(`SELECT user_id::text FROM public.user_roles WHERE role = '${role}' LIMIT 1`);
  return rows[0] ?? null;
}

/** A uuid that belongs to no user — stands in for an unrelated signed-in account. */
export const STRANGER_UID = "00000000-0000-4000-8000-000000000abc";
