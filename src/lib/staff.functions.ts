// Client-side wrappers around the `staff-admin` Supabase Edge Function.
// Signature is intentionally `({ data }) => ...` so existing call sites
// (which used `useServerFn` + `fn({ data })`) keep working unchanged.
import { supabase } from "@/integrations/supabase/client";

async function invoke(action: string, data: unknown) {
  const { data: res, error } = await supabase.functions.invoke("staff-admin", {
    body: { action, data },
  });
  if (error) {
    // Edge function returned non-2xx — try to surface its JSON `error` field.
    const ctx = (error as any)?.context;
    let msg = error.message || "Request failed";
    try {
      const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      if (body?.error) msg = body.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res && typeof res === "object" && "error" in res && (res as any).error) {
    throw new Error((res as any).error);
  }
  return res as any;
}

export const createStaff = ({ data }: { data: any }) => invoke("createStaff", data);
export const resetStaffPassword = ({ data }: { data: any }) => invoke("resetStaffPassword", data);
export const toggleStaffLogin = ({ data }: { data: any }) => invoke("toggleStaffLogin", data);
export const changeStaffRole = ({ data }: { data: any }) => invoke("changeStaffRole", data);
