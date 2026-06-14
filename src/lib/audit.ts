// Audit logging helper. Every sensitive create/update/delete must call logAudit().
// Writes into `enterprise_audit_logs` via the SECURITY DEFINER RPC so the row
// always captures the acting user id + email from auth.uid().
import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create" | "update" | "delete" | "approve" | "reject"
  | "login" | "logout" | "export" | "print" | "dispense"
  | "refund" | "discharge" | "admit" | "prescribe";

export async function logAudit(opts: {
  action: AuditAction | string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  try {
    const sb = supabase as any;
    await sb.rpc("log_audit_event", {
      _action: opts.action,
      _entity: opts.entity,
      _entity_id: opts.entityId ?? null,
      _before: opts.before ?? null,
      _after: opts.after ?? null,
    });
  } catch (e) {
    // Audit must never break the user flow; surface in console for ops review.
    // eslint-disable-next-line no-console
    console.warn("[audit] log failed", e);
  }
}
