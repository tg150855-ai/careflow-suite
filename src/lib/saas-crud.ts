// Generic CRUD helpers for Phase 9 SaaS tables.
import { supabase } from "@/integrations/supabase/client";

export async function listRows<T = any>(table: string, opts?: { order?: string; ascending?: boolean; limit?: number }): Promise<T[]> {
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
  return data;
}

export async function updateRow(table: string, id: string, patch: Record<string, any>) {
  const sb = supabase as any;
  const { data, error } = await sb.from(table).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table: string, id: string) {
  const sb = supabase as any;
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) throw error;
}
