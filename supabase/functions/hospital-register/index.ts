import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  hospital_name: z.string().min(2).max(200),
  owner_name: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  phone: z.string().max(30).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(120).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email: b.email,
      password: b.password,
      email_confirm: true,
      user_metadata: { full_name: b.owner_name },
    });
    if (userErr) return json({ error: userErr.message }, 400);
    const userId = created.user!.id;

    const { data: hospital, error: hErr } = await admin
      .from("hospitals")
      .insert({
        hospital_name: b.hospital_name,
        owner_name: b.owner_name,
        email: b.email,
        phone: b.phone ?? null,
        city: b.city ?? null,
        state: b.state ?? null,
        address: b.address ?? null,
        status: "pending",
        enabled_modules: [],
        created_by: userId,
      })
      .select("id")
      .single();
    if (hErr) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: hErr.message }, 400);
    }

    await admin.from("profiles").upsert({
      id: userId,
      full_name: b.owner_name,
      email: b.email,
      hospital_id: hospital.id,
    });
    await admin.from("user_roles").upsert(
      { user_id: userId, role: "admin" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

    return json({ ok: true, hospital_id: hospital.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Registration failed" }, 500);
  }
});
