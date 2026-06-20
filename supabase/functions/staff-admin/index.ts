// Staff admin operations — requires service role; verifies caller is admin/super_admin
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROLES = [
  "admin", "super_admin", "doctor", "receptionist", "nurse",
  "pharmacist", "lab_tech", "accountant", "surgeon",
  "insurance_officer", "ot_coordinator", "ambulance_driver",
  "hr_manager", "finance_manager", "dept_head",
  "procurement_officer", "patient",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.slice(7);

    // Verify caller identity using their token
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userRes.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userRes.user.id;
    const callerEmail = userRes.user.email ?? null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Require admin or super_admin
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      admin.rpc("has_role", { _user_id: callerId, _role: "admin" }),
      admin.rpc("has_role", { _user_id: callerId, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isSuper) return json({ error: "Forbidden: admin role required" }, 403);

    const body = await req.json();
    const action = body?.action as string;
    const data = body?.data ?? {};

    async function audit(act: string, entity: string, entityId: string | null, before: unknown, after: unknown) {
      await admin.from("enterprise_audit_logs").insert({
        user_id: callerId, user_email: callerEmail, action: act, entity, entity_id: entityId, before, after,
      });
    }

    if (action === "createStaff") {
      const { full_name, email, password, role, department, designation, mobile, gender, dob, address, joining_date } = data;
      if (!full_name || !email || !password || !role || !department) return json({ error: "Missing required fields" }, 400);
      if (!ROLES.includes(role)) return json({ error: "Invalid role" }, 400);

      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (authErr || !created.user) return json({ error: authErr?.message ?? "Auth user creation failed" }, 400);
      const newId = created.user.id;

      await admin.from("profiles").upsert({
        id: newId, full_name, email, phone: mobile, password_changed: false, login_disabled: false,
      });

      await admin.from("user_roles").delete().eq("user_id", newId);
      const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newId, role });
      if (roleErr) return json({ error: roleErr.message }, 400);

      const { data: emp, error: empErr } = await admin.from("employees").insert({
        user_id: newId, full_name, email, phone: mobile, department,
        designation: designation ?? null, gender: gender ?? null, dob: dob || null,
        address: address ?? null, joining_date: joining_date || null, status: "active",
      }).select("id, employee_no").single();
      if (empErr) return json({ error: empErr.message }, 400);

      await audit("create", "staff", newId, null, { full_name, email, role, department, employee_no: emp.employee_no });
      return json({ user_id: newId, employee_id: emp.id, employee_no: emp.employee_no });
    }

    if (action === "resetStaffPassword") {
      const { user_id, new_password } = data;
      if (!user_id || !new_password || new_password.length < 8) return json({ error: "Invalid input" }, 400);
      const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ password_changed: false }).eq("id", user_id);
      await audit("reset_password", "staff", user_id, null, { forced_change: true });
      return json({ ok: true });
    }

    if (action === "toggleStaffLogin") {
      const { user_id, disabled } = data;
      if (!user_id || typeof disabled !== "boolean") return json({ error: "Invalid input" }, 400);
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: disabled ? "876000h" : "none",
      } as unknown as Record<string, unknown>);
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ login_disabled: disabled }).eq("id", user_id);
      await admin.from("employees").update({ status: disabled ? "disabled" : "active" }).eq("user_id", user_id);
      await audit(disabled ? "disable_login" : "enable_login", "staff", user_id, null, { disabled });
      return json({ ok: true });
    }

    if (action === "changeStaffRole") {
      const { user_id, role } = data;
      if (!user_id || !ROLES.includes(role)) return json({ error: "Invalid input" }, 400);
      const { data: before } = await admin.from("user_roles").select("role").eq("user_id", user_id);
      await admin.from("user_roles").delete().eq("user_id", user_id);
      const { error } = await admin.from("user_roles").insert({ user_id, role });
      if (error) return json({ error: error.message }, 400);
      await audit("role_changed", "staff", user_id, before ?? null, { role });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? "Server error" }, 500);
  }
});
