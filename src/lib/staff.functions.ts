import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLES = [
  "admin", "super_admin", "doctor", "receptionist", "nurse",
  "pharmacist", "lab_tech", "accountant", "surgeon",
  "insurance_officer", "ot_coordinator", "ambulance_driver",
  "hr_manager", "finance_manager", "dept_head",
  "procurement_officer", "patient",
] as const;

async function ensureAdmin(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
  ]);
  if (!isAdmin && !isSuper) throw new Error("Forbidden: admin role required");
}

async function audit(admin: any, actorId: string, actorEmail: string | null, action: string, entity: string, entityId: string | null, before: any, after: any) {
  await admin.from("enterprise_audit_logs").insert({
    user_id: actorId,
    user_email: actorEmail,
    action,
    entity,
    entity_id: entityId,
    before,
    after,
  });
}

const createStaffSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(ROLES),
  department: z.string().min(1),
  designation: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  dob: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  joining_date: z.string().optional().nullable(),
  reporting_manager: z.string().optional().nullable(),
});

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createStaffSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create auth user
    const { data: created, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (authErr || !created.user) throw new Error(authErr?.message ?? "Auth user creation failed");
    const newId = created.user.id;

    // 2. Upsert profile (handle_new_user trigger may already insert)
    await supabaseAdmin.from("profiles").upsert({
      id: newId,
      full_name: data.full_name,
      email: data.email,
      phone: data.mobile,
      password_changed: false,
      login_disabled: false,
    });

    // 3. Assign role (remove any auto-assigned admin row first if first user heuristic fired)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    // 4. Create employee row
    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: newId,
        full_name: data.full_name,
        email: data.email,
        phone: data.mobile,
        department: data.department,
        designation: data.designation ?? null,
        gender: data.gender ?? null,
        dob: data.dob || null,
        address: data.address ?? null,
        joining_date: data.joining_date || null,
        status: "active",
      })
      .select("id, employee_no")
      .single();
    if (empErr) throw new Error(empErr.message);

    await audit(supabaseAdmin, userId, (claims as any)?.email ?? null, "create", "staff", newId, null, {
      full_name: data.full_name, email: data.email, role: data.role, department: data.department, employee_no: emp.employee_no,
    });

    return { user_id: newId, employee_id: emp.id, employee_no: emp.employee_no };
  });

const resetPwSchema = z.object({ user_id: z.string().uuid(), new_password: z.string().min(8) });
export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => resetPwSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.new_password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ password_changed: false }).eq("id", data.user_id);
    await audit(supabaseAdmin, userId, (claims as any)?.email ?? null, "reset_password", "staff", data.user_id, null, { forced_change: true });
    return { ok: true };
  });

const toggleLoginSchema = z.object({ user_id: z.string().uuid(), disabled: z.boolean() });
export const toggleStaffLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => toggleLoginSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ login_disabled: data.disabled }).eq("id", data.user_id);
    await supabaseAdmin.from("employees").update({ status: data.disabled ? "disabled" : "active" }).eq("user_id", data.user_id);
    await audit(supabaseAdmin, userId, (claims as any)?.email ?? null, data.disabled ? "disable_login" : "enable_login", "staff", data.user_id, null, { disabled: data.disabled });
    return { ok: true };
  });

const changeRoleSchema = z.object({ user_id: z.string().uuid(), role: z.enum(ROLES) });
export const changeStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => changeRoleSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, userId, (claims as any)?.email ?? null, "role_changed", "staff", data.user_id, before ?? null, { role: data.role });
    return { ok: true };
  });
