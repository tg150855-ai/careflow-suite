// Public mobile API — executive KPIs (aggregated hospital metrics).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const today = new Date().toISOString().split("T")[0];
  const [bills, adm, opd, beds, surg, pending] = await Promise.all([
    admin.from("bills").select("net_amount").gte("created_at", today),
    admin.from("admissions").select("id").eq("status", "active"),
    admin.from("appointments").select("id").gte("scheduled_at", today + "T00:00:00").lte("scheduled_at", today + "T23:59:59"),
    admin.from("beds").select("status"),
    admin.from("surgeries").select("id").eq("status", "scheduled"),
    admin.from("bills").select("net_amount, paid_amount").neq("status", "paid"),
  ]);
  const bedRows = (beds.data ?? []) as any[];
  const occupied = bedRows.filter((b) => b.status === "occupied").length;
  const pendingTotal = ((pending.data ?? []) as any[]).reduce(
    (a, b) => a + (Number(b.net_amount || 0) - Number(b.paid_amount || 0)), 0,
  );
  return new Response(JSON.stringify({
    revenue_today: ((bills.data ?? []) as any[]).reduce((a, b) => a + Number(b.net_amount || 0), 0),
    admissions_active: (adm.data ?? []).length,
    opd_today: (opd.data ?? []).length,
    beds_occupied: occupied,
    beds_total: bedRows.length,
    occupancy_pct: bedRows.length ? Math.round((occupied / bedRows.length) * 100) : 0,
    surgeries_scheduled: (surg.data ?? []).length,
    pending_bills_amount: pendingTotal,
    generated_at: new Date().toISOString(),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
