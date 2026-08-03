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
 * The live RLS predicates for a table + command, read straight from the
 * catalog. Permissive policies are OR-ed, exactly as Postgres evaluates them.
 * `cmd` may be 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'; 'ALL' policies are
 * always included.
 */
export function policyExpr(
  table: string,
  cmd: "SELECT" | "INSERT" | "UPDATE" | "DELETE",
): { expr: string; roles: string[] } {
  const rows = sql(
    `SELECT coalesce(qual, with_check, 'true') || '|' || array_to_string(roles, ',')
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = '${table}'
       AND cmd IN ('${cmd}', 'ALL') AND permissive = 'PERMISSIVE'`,
  );
  const quals: string[] = [];
  const roles = new Set<string>();
  for (const row of rows) {
    const i = row.lastIndexOf("|");
    quals.push(row.slice(0, i));
    row
      .slice(i + 1)
      .split(",")
      .forEach((r) => roles.add(r));
  }
  return { expr: quals.map((q) => `(${q})`).join(" OR ") || "false", roles: [...roles] };
}

/**
 * Evaluate a policy predicate as if `uid` were the signed-in user.
 * `auth.uid()` is substituted with the literal id (the sandbox role cannot read
 * the auth schema); every other part of the predicate — has_role(), is_staff(),
 * column comparisons — runs for real against live data.
 *
 * `fromClause` supplies a synthetic row when the predicate references columns.
 */
export function evalPolicy(expr: string, uid: string, fromClause = ""): boolean {
  const bound = expr.replace(/auth\.uid\(\)/g, `'${uid}'::uuid`);
  const rows = sql(`SELECT coalesce((${bound}), false) ${fromClause}`);
  return rows[0] === "t";
}

/** First user id holding `role`, or null when no such user exists yet. */
export function userWithRole(role: string): string | null {
  const rows = sql(`SELECT user_id::text FROM public.user_roles WHERE role = '${role}' LIMIT 1`);
  return rows[0] ?? null;
}

/** A uuid that belongs to no user — stands in for an unrelated signed-in account. */
export const STRANGER_UID = "00000000-0000-4000-8000-000000000abc";
