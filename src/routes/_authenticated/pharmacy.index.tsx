import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pill, AlertTriangle, Clock, XCircle, Plus, Package } from "lucide-react";
import { motion } from "framer-motion";
import { inr } from "@/lib/format";
import { addDays, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/pharmacy/")({ component: PharmacyDashboard });

function PharmacyDashboard() {
  const { data } = useQuery({
    queryKey: ["pharm-dashboard"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in30 = addDays(new Date(), 30).toISOString().slice(0, 10);
      const [meds, batches, salesToday, recentSales] = await Promise.all([
        supabase.from("medicines").select("id, minimum_stock"),
        supabase.from("medicine_batches").select("id, medicine_id, quantity, expiry_date, medicines(name)"),
        supabase.from("pharmacy_sales").select("total").gte("created_at", new Date().setHours(0,0,0,0) as any),
        supabase.from("pharmacy_sales").select("id, invoice_no, total, created_at, patients(full_name)").order("created_at", { ascending: false }).limit(8),
      ]);
      // aggregate stock per medicine
      const stockByMed: Record<string, number> = {};
      (batches.data ?? []).forEach((b: any) => { stockByMed[b.medicine_id] = (stockByMed[b.medicine_id] ?? 0) + b.quantity; });
      const minByMed: Record<string, number> = {};
      (meds.data ?? []).forEach((m: any) => { minByMed[m.id] = m.minimum_stock; });
      const lowStock = (meds.data ?? []).filter((m: any) => (stockByMed[m.id] ?? 0) > 0 && (stockByMed[m.id] ?? 0) <= m.minimum_stock).length;
      const outOfStock = (meds.data ?? []).filter((m: any) => (stockByMed[m.id] ?? 0) === 0).length;
      const expiring = (batches.data ?? []).filter((b: any) => b.expiry_date <= in30 && b.expiry_date >= today && b.quantity > 0);
      const todayRevenue = (salesToday.data ?? []).reduce((s, r: any) => s + Number(r.total), 0);
      return {
        totalMeds: (meds.data ?? []).length,
        lowStock, outOfStock,
        expiringCount: expiring.length,
        expiring: expiring.slice(0, 6),
        todayRevenue,
        recentSales: recentSales.data ?? [],
      };
    },
  });

  const cards = [
    { label: "Total medicines", value: data?.totalMeds ?? 0, icon: Pill },
    { label: "Low stock", value: data?.lowStock ?? 0, icon: AlertTriangle, tone: "warning" },
    { label: "Expiring (30d)", value: data?.expiringCount ?? 0, icon: Clock, tone: "warning" },
    { label: "Out of stock", value: data?.outOfStock ?? 0, icon: XCircle, tone: "destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h1 className="text-3xl font-semibold tracking-tight">Pharmacy</h1><p className="text-muted-foreground mt-1">Inventory and over-the-counter sales</p></div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/pharmacy/medicines"><Package className="size-4 mr-2" />Medicines</Link></Button>
          <Button asChild><Link to="/pharmacy/sales/new"><Plus className="size-4 mr-2" />New sale</Link></Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Recent sales</h2><div className="text-sm text-muted-foreground">Today: <span className="font-semibold text-foreground">{inr(data?.todayRevenue ?? 0)}</span></div></div>
          <div className="divide-y">
            {(data?.recentSales ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div className="min-w-0"><div className="text-sm font-medium truncate">{s.patients?.full_name ?? "Walk-in"}</div><div className="text-xs text-muted-foreground font-mono">{s.invoice_no} · {format(new Date(s.created_at), "dd MMM HH:mm")}</div></div>
                <div className="text-sm font-medium tabular-nums">{inr(s.total)}</div>
              </div>
            ))}
            {(data?.recentSales ?? []).length === 0 && <div className="py-8 text-sm text-muted-foreground text-center">No sales yet.</div>}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Expiring soon</h2>
          <div className="space-y-2">
            {(data?.expiring ?? []).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between p-2.5 rounded-lg bg-warning/10">
                <div className="min-w-0"><div className="text-sm font-medium truncate">{b.medicines?.name}</div><div className="text-xs text-muted-foreground">Qty {b.quantity}</div></div>
                <Badge variant="outline" className="text-[10px]">{format(new Date(b.expiry_date), "dd MMM yyyy")}</Badge>
              </div>
            ))}
            {(data?.expiring ?? []).length === 0 && <div className="text-sm text-muted-foreground text-center py-6">All batches are fresh.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
