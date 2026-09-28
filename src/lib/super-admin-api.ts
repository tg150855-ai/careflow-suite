import { supabase } from "@/integrations/supabase/client";

/** Calls the privileged super-admin edge function. Throws on error. */
export async function superAdminOps<T = any>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("super-admin-ops", { body: payload });
  if (error) {
    let msg = error.message;
    if ("context" in error && error.context) {
      try {
        const body = await (error.context as Response).json();
        if (body?.error) {
          if (typeof body.error === "string") {
            msg = body.error;
          } else if (typeof body.error === "object") {
            const fieldErrors = (body.error as any).fieldErrors || body.error;
            const firstKey = Object.keys(fieldErrors)[0];
            const val = fieldErrors[firstKey];
            msg = `${firstKey}: ${Array.isArray(val) ? val.join(", ") : val}`;
          }
        }
      } catch {}
    }
    const message = (data as { error?: string } | null)?.error ?? msg;
    throw new Error(typeof message === "string" ? message : "Operation failed");
  }
  if (data && typeof data === "object" && "error" in (data as object)) {
    const e = (data as { error: unknown }).error;
    throw new Error(typeof e === "string" ? e : JSON.stringify(e));
  }
  return data as T;
}
