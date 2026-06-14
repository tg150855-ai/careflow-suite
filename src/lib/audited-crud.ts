// Permission-checked CRUD with automatic audit logging.
// Every mutating operation:
//   1. verifies the current user's role allows the action (client-side gate)
//   2. performs the DB call (RLS enforces server-side)
//   3. records a row in `enterprise_audit_logs` with before/after values
//
// RLS remains the authoritative server-side check; this layer adds an
// early-fail UX and a tamper-evident audit trail.
import { supabase } from "@/integrations/supabase/client";
import { can, type Action, type Module } from "@/lib/permissions";
import type { AppRole } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";

class PermissionError extends Error {
  constructor(module: Module, action: Action) {
    super(`Permission denied: ${action} on ${module}`);
    this.name = "PermissionError";
  }
}

function assertCan(roles: AppRole[], module: Module, action: Action) {
  if (!can(roles, module, action)) throw new PermissionError(module, action);
}

export async function auditedInsert(opts: {
  roles: AppRole[];
  module: Module;
  table: string;
  entity: string;
  values: Record<string, any>;
}) {
  assertCan(opts.roles, opts.module, "create");
  const sb = supabase as any;
  const { data, error } = await sb.from(opts.table).insert(opts.values).select().single();
  if (error) throw error;
  await logAudit({ action: "create", entity: opts.entity, entityId: data?.id, after: data });
  return data;
}

export async function auditedUpdate(opts: {
  roles: AppRole[];
  module: Module;
  table: string;
  entity: string;
  id: string;
  patch: Record<string, any>;
}) {
  assertCan(opts.roles, opts.module, "edit");
  const sb = supabase as any;
  const { data: before } = await sb.from(opts.table).select("*").eq("id", opts.id).maybeSingle();
  const { data: after, error } = await sb
    .from(opts.table).update(opts.patch).eq("id", opts.id).select().single();
  if (error) throw error;
  await logAudit({ action: "update", entity: opts.entity, entityId: opts.id, before, after });
  return after;
}

export async function auditedDelete(opts: {
  roles: AppRole[];
  module: Module;
  table: string;
  entity: string;
  id: string;
}) {
  assertCan(opts.roles, opts.module, "delete");
  const sb = supabase as any;
  const { data: before } = await sb.from(opts.table).select("*").eq("id", opts.id).maybeSingle();
  const { error } = await sb.from(opts.table).delete().eq("id", opts.id);
  if (error) throw error;
  await logAudit({ action: "delete", entity: opts.entity, entityId: opts.id, before });
}

export { PermissionError };
