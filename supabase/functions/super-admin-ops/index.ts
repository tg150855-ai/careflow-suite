import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const HospitalFields = z.object({
  hospital_name: z.string().min(2).max(200),
  owner_name: z.string().max(200).optional().nullable(),
  email: z.string().email(),
  phone: z.string().max(30).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(120).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  subscription_plan: z.string().max(100).optional().nullable(),
  max_users: z.number().int().min(1).max(10000).optional(),
  max_devices: z.number().int().min(1).max(10000).optional(),
  expiry_date: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  enabled_modules: z.array(z.string()).optional(),
  status: z.enum(["pending", "approved", "suspended", "rejected"]).optional(),
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("create_hospital"), hospital: HospitalFields, admin_password: z.string().min(6).max(100).optional() }),
  z.object({ action: z.literal("update_hospital"), hospital_id: z.string().uuid(), hospital: HospitalFields.partial() }),
  z.object({ action: z.literal("set_status"), hospital_id: z.string().uuid(), status: z.enum(["pending", "approved", "suspended", "rejected"]), reason: z.string().max(500).optional().nullable() }),
  z.object({ action: z.literal("set_modules"), hospital_id: z.string().uuid(), modules: z.array(z.string()) }),
  z.object({ action: z.literal("delete_hospital"), hospital_id: z.string().uuid(), delete_users: z.boolean().optional() }),
  z.object({ action: z.literal("create_user"), hospital_id: z.string().uuid(), email: z.string().email(), password: z.string().min(6).max(100), full_name: z.string().max(200), role: z.string().max(40) }),
  z.object({ action: z.literal("set_user_password"), user_id: z.string().uuid(), password: z.string().min(6).max(100) }),
  z.object({ action: z.literal("delete_user"), user_id: z.string().uuid() }),
  z.object({ action: z.literal("set_user_role"), user_id: z.string().uuid(), role: z.string().max(40) }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // --- authenticate caller and require super_admin ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: "Unauthorized" }, 401);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "Forbidden — super admin only" }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const body = parsed.data;

  try {
    switch (body.action) {
      case "list": {
        const [{ data: hospitals, error: hErr }, { data: profiles }, { data: roles }] = await Promise.all([
          admin.from("hospitals").select("*").order("created_at", { ascending: false }),
          admin.from("profiles").select("id, full_name, email, phone, hospital_id, login_disabled, created_at"),
          admin.from("user_roles").select("user_id, role"),
        ]);
        if (hErr) return json({ error: hErr.message }, 400);
        const roleMap: Record<string, string[]> = {};
        for (const r of roles ?? []) (roleMap[r.user_id] ??= []).push(r.role as string);
        const users = (profiles ?? []).map((p) => ({ ...p, roles: roleMap[p.id] ?? [] }));
        return json({ hospitals: hospitals ?? [], users });
      }

      case "create_hospital": {
        const h = body.hospital;
        const { data: hospital, error } = await admin
          .from("hospitals")
          .insert({ ...h, status: h.status ?? "approved", created_by: userData.user.id })
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);

        if (body.admin_password) {
          const { data: created, error: uErr } = await admin.auth.admin.createUser({
            email: h.email,
            password: body.admin_password,
            email_confirm: true,
            user_metadata: { full_name: h.owner_name ?? h.hospital_name },
          });
          if (uErr) return json({ hospital, warning: uErr.message });
          const uid = created.user!.id;
          await admin.from("profiles").upsert({ id: uid, full_name: h.owner_name ?? h.hospital_name, email: h.email, hospital_id: hospital.id });
          await admin.from("user_roles").upsert({ user_id: uid, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
        }
        return json({ hospital });
      }

      case "update_hospital": {
        const { data, error } = await admin
          .from("hospitals")
          .update(body.hospital)
          .eq("id", body.hospital_id)
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ hospital: data });
      }

      case "set_status": {
        const { data, error } = await admin
          .from("hospitals")
          .update({ status: body.status, status_reason: body.reason ?? null })
          .eq("id", body.hospital_id)
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ hospital: data });
      }

      case "set_modules": {
        const { data, error } = await admin
          .from("hospitals")
          .update({ enabled_modules: body.modules })
          .eq("id", body.hospital_id)
          .select("*")
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ hospital: data });
      }

      case "delete_hospital": {
        const { data: members } = await admin.from("profiles").select("id").eq("hospital_id", body.hospital_id);
        if (body.delete_users) {
          for (const m of members ?? []) {
            if (m.id === userData.user.id) continue;
            await admin.auth.admin.deleteUser(m.id).catch(() => {});
          }
        } else {
          await admin.from("profiles").update({ hospital_id: null }).eq("hospital_id", body.hospital_id);
        }
        const { error } = await admin.from("hospitals").delete().eq("id", body.hospital_id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "create_user": {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
          user_metadata: { full_name: body.full_name },
        });
        if (error) return json({ error: error.message }, 400);
        const uid = created.user!.id;
        await admin.from("profiles").upsert({ id: uid, full_name: body.full_name, email: body.email, hospital_id: body.hospital_id });
        await admin.from("user_roles").upsert({ user_id: uid, role: body.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
        return json({ ok: true, user_id: uid });
      }

      case "set_user_password": {
        const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "delete_user": {
        if (body.user_id === userData.user.id) return json({ error: "You cannot delete your own account" }, 400);
        const { error } = await admin.auth.admin.deleteUser(body.user_id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "set_user_role": {
        await admin.from("user_roles").delete().eq("user_id", body.user_id);
        const { error } = await admin.from("user_roles").insert({ user_id: body.user_id, role: body.role });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Operation failed" }, 500);
  }
});
