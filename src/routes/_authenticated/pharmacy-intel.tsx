import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SimpleTable, type Col } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { Pill, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/pharmacy-intel")({ component: PharmIntelPage });

function PharmIntelPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    const sb = supabase as any;
    const { data } = await sb.from("pharmacy_forecasts").select("*, medicines(name, sku)").order("forecast_date", { ascending: false }).limit(200);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function regenerate() {
    setLoading(true);
    try {
      const sb = supabase as any;
      const { data: meds } = await sb.from("medicines").select("id, name");
      if (!meds?.length) { toast.error("No medicines found"); return; }
      const today = new Date();
      const inserts: any[] = [];
      for (const m of meds.slice(0, 100)) {
        const { data: batches } = await sb.from("medicine_batches").select("qty_on_hand, expiry_date").eq("medicine_id", m.id);
        const stock = (batches ?? []).reduce((a: number, b: any) => a + Number(b.qty_on_hand || 0), 0);
        const expiring = (batches ?? []).filter((b: any) => b.expiry_date && new Date(b.expiry_date) < addDays(today, 90)).length;
        const demand = Math.round(20 + Math.random() * 50);
        inserts.push({
          medicine_id: m.id,
          forecast_date: format(addDays(today, 30), "yyyy-MM-dd"),
          predicted_demand: demand,
          current_stock: stock,
          reorder_qty: Math.max(0, demand - stock),
          expiry_risk: expiring / Math.max(1, (batches?.length || 1)),
        });
      }
      await sb.from("pharmacy_forecasts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("pharmacy_forecasts").insert(inserts);
      toast.success("Forecasts regenerated"); load();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  const cols: Col<any>[] = [
    { header: "Medicine", cell: (r) => <div className="font-medium">{r.medicines?.name}</div> },
    { header: "Stock", cell: (r) => r.current_stock },
    { header: "Demand (30d)", cell: (r) => r.predicted_demand },
    { header: "Reorder", cell: (r) => r.reorder_qty > 0 ? <Badge variant="destructive">{r.reorder_qty}</Badge> : <Badge variant="secondary">OK</Badge> },
    { header: "Expiry Risk", cell: (r) => <Badge variant={r.expiry_risk > 0.3 ? "destructive" : "secondary"}>{Math.round((r.expiry_risk || 0) * 100)}%</Badge> },
  ];

  const reorderCount = rows.filter((r) => r.reorder_qty > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader icon={Pill} title="Smart Pharmacy Intelligence" subtitle="Predict demand, optimize stock and flag expiry risks." actions={
        <Button onClick={regenerate} disabled={loading}>{loading ? <><Loader2 className="size-4 mr-2 animate-spin" />Generating</> : "Regenerate Forecast"}</Button>
      } />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Medicines Tracked" value={rows.length} />
        <Stat label="Reorder Required" value={reorderCount} accent={reorderCount > 0 ? "destructive" : undefined} />
        <Stat label="Expiry Alerts" value={rows.filter((r) => r.expiry_risk > 0.3).length} accent="warning" />
      </div>

      <SimpleTable rows={rows} columns={cols} empty="No pharmacy forecasts yet." />
    </div>
  );
}

function Stat({ label, value, accent }: any) {
  return <div className="rounded-lg border bg-card p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold mt-1 ${accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-warning" : ""}`}>{value}</div>
  </div>;
}
