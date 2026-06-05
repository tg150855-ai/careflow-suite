// Public Mobile API — executive KPIs. Returns aggregated hospital metrics for the executive mobile dashboard.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mobile/exec/kpis")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const today = new Date().toISOString().split("T")[0];
        const [bills, adm, opd, beds, surg, pending] = await Promise.all([
          supabaseAdmin.from("bills").select("net_amount").gte("created_at", today),
          supabaseAdmin.from("admissions").select("id").eq("status", "active"),
          supabaseAdmin.from("appointments").select("id").gte("scheduled_at", today + "T00:00:00").lte("scheduled_at", today + "T23:59:59"),
          supabaseAdmin.from("beds").select("status"),
          supabaseAdmin.from("surgeries").select("id").eq("status", "scheduled"),
          supabaseAdmin.from("bills").select("net_amount, paid_amount").neq("status", "paid"),
        ]);
        const bedRows = (beds.data ?? []) as any[];
        const occupied = bedRows.filter((b) => b.status === "occupied").length;
        const pendingTotal = ((pending.data ?? []) as any[]).reduce(
          (a, b) => a + (Number(b.net_amount || 0) - Number(b.paid_amount || 0)), 0,
        );
        return Response.json({
          revenue_today: ((bills.data ?? []) as any[]).reduce((a, b) => a + Number(b.net_amount || 0), 0),
          admissions_active: (adm.data ?? []).length,
          opd_today: (opd.data ?? []).length,
          beds_occupied: occupied,
          beds_total: bedRows.length,
          occupancy_pct: bedRows.length ? Math.round((occupied / bedRows.length) * 100) : 0,
          surgeries_scheduled: (surg.data ?? []).length,
          pending_bills_amount: pendingTotal,
          generated_at: new Date().toISOString(),
        });
      },
    },
  },
});
