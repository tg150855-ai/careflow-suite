import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Receipt, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { format, startOfDay, startOfMonth, subMonths } from "date-fns";
import { inr } from "@/lib/format";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/billing/")({ component: BillingDashboard });

function BillingDashboard() {
  const { data } = useQuery({
    queryKey: ["billing-dashboard"],
    queryFn: async () => {
      const today = startOfDay(new Date()).toISOString();
      const monthAgo = subMonths(startOfMonth(new Date()), 5).toISOString();
      const [todayBills, pending, paidToday, all, recent] = await Promise.all([
        supabase.from("bills").select("total, paid, pending, status").gte("created_at", today),
        supabase.from("bills").select("id, total, pending", { count: "exact" }).gt("pending", 0),
        supabase.from("bills").select("total", { count: "exact" }).eq("status", "paid").gte("created_at", today),
        supabase.from("bills").select("created_at, total").gte("created_at", monthAgo),
        supabase.from("bills").select("id, bill_no, total, paid, pending, status, created_at, patients(full_name, uhid)").order("created_at", { ascending: false }).limit(10),
      ]);
      const todayRevenue = (todayBills.data ?? []).reduce((s, b: any) => s + Number(b.paid), 0);
      const pendingTotal = (pending.data ?? []).reduce((s, b: any) => s + Number(b.pending), 0);
      // monthly buckets
      const buckets: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const k = format(subMonths(new Date(), i), "MMM");
        buckets[k] = 0;
      }
      (all.data ?? []).forEach((b: any) => {
        const k = format(new Date(b.created_at), "MMM");
        if (k in buckets) buckets[k] += Number(b.total);
      });
      return {
        todayRevenue,
        pendingCount: pending.count ?? 0,
        pendingTotal,
        paidTodayCount: paidToday.count ?? 0,
        chart: Object.entries(buckets).map(([m, v]) => ({ m, v })),
        recent: recent.data ?? [],
      };
    },
  });

  const cards = [
    { label: "Today's revenue", value: inr(data?.todayRevenue ?? 0), icon: TrendingUp, tone: "primary" },
    { label: "Paid bills (today)", value: data?.paidTodayCount ?? 0, icon: CheckCircle2, tone: "accent" },
    { label: "Pending payments", value: data?.pendingCount ?? 0, icon: Clock, tone: "warning" },
    { label: "Outstanding", value: inr(data?.pendingTotal ?? 0), icon: Receipt, tone: "primary" },
  ];
  const max = Math.max(1, ...(data?.chart ?? []).map((c) => c.v));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
          <p className="text-muted-foreground mt-1">Invoices, payments and revenue overview</p>
        </div>
        <Button asChild size="lg"><Link to="/billing/new"><Plus className="size-4 mr-2" />New bill</Link></Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-6">
              <div className={`size-11 rounded-2xl flex items-center justify-center mb-4 bg-${c.tone}/10 text-${c.tone}`}
                style={{ background: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
                <c.icon className="size-5" />
              </div>
              <div className="text-2xl font-semibold tracking-tight">{c.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold mb-5">Monthly revenue</h2>
          <div className="flex items-end gap-4 h-48">
            {(data?.chart ?? []).map((c) => (
              <div key={c.m} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs tabular-nums text-muted-foreground">{inr(c.v).replace(".00", "")}</div>
                <div className="w-full bg-primary/15 rounded-t-lg relative overflow-hidden" style={{ height: `${(c.v / max) * 100}%`, minHeight: 4 }}>
                  <div className="absolute inset-x-0 bottom-0 bg-primary rounded-t-lg" style={{ height: "100%" }} />
                </div>
                <div className="text-xs text-muted-foreground">{c.m}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Recent bills</h2>
          <div className="divide-y -my-2">
            {(data?.recent ?? []).map((b: any) => (
              <Link key={b.id} to="/billing/$id" params={{ id: b.id }} className="flex items-center justify-between py-3 hover:bg-surface-muted -mx-2 px-2 rounded-lg">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{b.patients?.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{b.bill_no}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-medium tabular-nums">{inr(b.total)}</div>
                  <Badge variant={b.status === "paid" ? "secondary" : "outline"} className="text-[10px] capitalize mt-0.5">{b.status}</Badge>
                </div>
              </Link>
            ))}
            {(data?.recent ?? []).length === 0 && <div className="py-8 text-sm text-muted-foreground text-center">No bills yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
