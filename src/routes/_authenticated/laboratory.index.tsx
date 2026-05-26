import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FlaskConical, Clock, CheckCircle2, TrendingUp, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/laboratory/")({ component: LabDashboard });

const STATUS_TONE: Record<string, string> = {
  ordered: "outline", sample_collected: "secondary", in_progress: "secondary", completed: "default", cancelled: "destructive",
};

function LabDashboard() {
  const { data } = useQuery({
    queryKey: ["lab-dashboard"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [pending, completed, revenue, orders] = await Promise.all([
        supabase.from("lab_orders").select("id", { count: "exact" }).in("status", ["ordered", "sample_collected", "in_progress"]),
        supabase.from("lab_orders").select("id", { count: "exact" }).eq("status", "completed"),
        supabase.from("lab_orders").select("total_amount").gte("created_at", today.toISOString()),
        supabase.from("lab_orders").select("id, order_no, status, total_amount, created_at, patients(full_name, uhid), doctors(name), lab_results(id)").order("created_at", { ascending: false }).limit(15),
      ]);
      return {
        pending: pending.count ?? 0,
        completed: completed.count ?? 0,
        revenue: (revenue.data ?? []).reduce((s, r: any) => s + Number(r.total_amount), 0),
        orders: orders.data ?? [],
      };
    },
  });

  const cards = [
    { label: "Pending tests", value: data?.pending ?? 0, icon: Clock },
    { label: "Completed", value: data?.completed ?? 0, icon: CheckCircle2 },
    { label: "Reports uploaded", value: (data?.orders ?? []).filter((o: any) => o.lab_results?.length).length, icon: FileText },
    { label: "Today's revenue", value: inr(data?.revenue ?? 0), icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-3xl font-semibold tracking-tight">Laboratory</h1><p className="text-muted-foreground mt-1">Test orders, samples and reports</p></div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/laboratory/tests"><FlaskConical className="size-4 mr-2" />Tests catalog</Link></Button>
          <Button asChild><Link to="/laboratory/new"><Plus className="size-4 mr-2" />New order</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-6">
              <div className="size-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: "color-mix(in oklch, var(--primary) 10%, transparent)", color: "var(--primary)" }}><c.icon className="size-5" /></div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums">{c.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Recent orders</h2>
        <div className="divide-y">
          {(data?.orders ?? []).map((o: any) => (
            <Link key={o.id} to="/laboratory/$id" params={{ id: o.id }} className="flex items-center justify-between py-3 hover:bg-surface-muted -mx-3 px-3 rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">{(o.patients?.full_name ?? "?").slice(0,2).toUpperCase()}</div>
                <div className="min-w-0"><div className="text-sm font-medium truncate">{o.patients?.full_name}</div><div className="text-xs text-muted-foreground truncate">{o.order_no} · {o.patients?.uhid} · {o.doctors?.name ?? "—"}</div></div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm tabular-nums">{inr(o.total_amount)}</div>
                <div className="flex items-center gap-2 justify-end mt-0.5">
                  <span className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd MMM")}</span>
                  <Badge variant={(STATUS_TONE[o.status] as any) ?? "outline"} className="text-[10px] capitalize">{o.status.replace("_"," ")}</Badge>
                </div>
              </div>
            </Link>
          ))}
          {(data?.orders ?? []).length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No lab orders yet.</div>}
        </div>
      </Card>
    </div>
  );
}
