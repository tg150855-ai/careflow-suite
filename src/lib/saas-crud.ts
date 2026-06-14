// Generic CRUD helpers. Every mutation is recorded in `enterprise_audit_logs`
// via log_audit_event so we maintain a tamper-evident audit trail of who
// changed what and when (RLS still enforces server-side authorization).
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

export async function listRows<T = any>(
  table: string,
  opts?: { order?: string; ascending?: boolean; limit?: number },
): Promise<T[]> {
  const sb = supabase as any;
  let q = sb.from(table).select("*");
  if (opts?.order) q = q.order(opts.order, { ascending: opts.ascending ?? false });
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function insertRow(table: string, row: Record<string, any>) {
  const sb = supabase as any;
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) throw error;
  await logAudit({ action: "create", entity: table, entityId: data?.id, after: data });
  return data;
}

export async function updateRow(table: string, id: string, patch: Record<string, any>) {
  const sb = supabase as any;
  const { data: before } = await sb.from(table).select("*").eq("id", id).maybeSingle();
  const { data, error } = await sb.from(table).update(patch).eq("id", id).select().single();
  if (error) throw error;
  await logAudit({ action: "update", entity: table, entityId: id, before, after: data });
  return data;
}

export async function deleteRow(table: string, id: string) {
  const sb = supabase as any;
  const { data: before } = await sb.from(table).select("*").eq("id", id).maybeSingle();
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) throw error;
  await logAudit({ action: "delete", entity: table, entityId: id, before });
}
