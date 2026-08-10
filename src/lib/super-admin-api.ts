import { supabase } from "@/integrations/supabase/client";

/** Calls the privileged super-admin edge function. Throws on error. */
export async function superAdminOps<T = any>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("super-admin-ops", { body: payload });
  if (error) {
    const message = (data as { error?: string } | null)?.error ?? error.message;
    throw new Error(typeof message === "string" ? message : "Operation failed");
  }
  if (data && typeof data === "object" && "error" in (data as object)) {
    const e = (data as { error: unknown }).error;
    throw new Error(typeof e === "string" ? e : JSON.stringify(e));
  }
  return data as T;
}
