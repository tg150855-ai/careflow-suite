import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill, AlertTriangle, Clock, XCircle, Plus, Package } from "lucide-react";
import { motion } from "framer-motion";
import { inr } from "@/lib/format";
import { addDays, format } from "date-fns";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pharmacy/")({ component: PharmacyDashboard });

function PharmacyDashboard() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data } = useQuery({
    queryKey: ["pharm-dashboard"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in30 = addDays(new Date(), 30).toISOString().slice(0, 10);
      const [meds, batches, salesToday, recentSales] = await Promise.all([
        supabase.from("medicines").select("id, minimum_stock"),
        supabase.from("medicine_batches").select("id, medicine_id, quantity, expiry_date, medicines(name)"),
        supabase.from("pharmacy_sales").select("total").gte("created_at", new Date().setHours(0, 0, 0, 0) as any),
        supabase.from("pharmacy_sales").select("id, invoice_no, total, created_at, patients(full_name, uhid, mobile)").order("created_at", { ascending: false }).limit(200),
      ]);
      const stockByMed: Record<string, number> = {};
      (batches.data ?? []).forEach((b: any) => { stockByMed[b.medicine_id] = (stockByMed[b.medicine_id] ?? 0) + b.quantity; });
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

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromT = from ? new Date(from).getTime() : null;
    const toT = to ? new Date(to).getTime() + 86_400_000 - 1 : null;
    return (data?.recentSales ?? []).filter((s: any) => {
      const t = new Date(s.created_at).getTime();
      if (fromT && t < fromT) return false;
      if (toT && t > toT) return false;
      if (!q) return true;
      const hay = `${s.invoice_no ?? ""} ${s.patients?.full_name ?? ""} ${s.patients?.uhid ?? ""} ${s.patients?.mobile ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data?.recentSales, search, from, to]);

  const cards = [
    { label: "Total medicines", value: data?.totalMeds ?? 0, icon: Pill },
    { label: "Low stock", value: data?.lowStock ?? 0, icon: AlertTriangle },
    { label: "Expiring (30d)", value: data?.expiringCount ?? 0, icon: Clock },
    { label: "Out of stock", value: data?.outOfStock ?? 0, icon: XCircle },
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
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="font-semibold">Recent sales</h2>
            <div className="text-sm text-muted-foreground">Today: <span className="font-semibold text-foreground">{inr(data?.todayRevenue ?? 0)}</span></div>
          </div>
          <div className="flex flex-wrap gap-2 items-end mb-3">
            <div className="min-w-[200px] flex-1">
              <Label className="text-xs">Search</Label>
              <SearchBox value={search} onChange={setSearch} placeholder="Invoice, patient, UHID, mobile" />
            </div>
            <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" /></div>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFrom(""); setTo(""); }}>Reset</Button>
          </div>
          <div className="divide-y">
            {filteredSales.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{s.patients?.full_name ?? "Walk-in"}</div><div className="text-xs text-muted-foreground font-mono">{s.invoice_no} · {format(new Date(s.created_at), "dd MMM HH:mm")}</div></div>
                <div className="text-sm font-medium tabular-nums">{inr(s.total)}</div>
                <RecordActions
                  onPrint={() => {
                    const w = window.open("", "_blank"); if (!w) return;
                    w.document.write(`<html><head><title>${s.invoice_no}</title><style>body{font-family:system-ui;padding:24px;max-width:520px;margin:auto}h1{font-size:16px}p{font-size:13px;color:#555}</style></head><body><h1>Pharmacy Invoice ${s.invoice_no}</h1><p>Patient: ${s.patients?.full_name ?? "Walk-in"}</p><p>Date: ${format(new Date(s.created_at), "dd MMM yyyy HH:mm")}</p><p>Total: ${inr(Number(s.total))}</p><script>window.print()</script></body></html>`); w.document.close();
                  }}
                  onWhatsApp={() => {
                    const msg = `Pharmacy Invoice ${s.invoice_no}\nPatient: ${s.patients?.full_name ?? "Walk-in"}\nTotal: ${inr(Number(s.total))}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                  onDelete={async () => {
                    const { error } = await supabase.from("pharmacy_sales").delete().eq("id", s.id);
                    if (error) return toast.error(error.message);
                    toast.success("Sale deleted");
                    qc.invalidateQueries({ queryKey: ["pharm-dashboard"] });
                  }}
                  deleteLabel={`sale ${s.invoice_no}`}
                />
              </div>
            ))}
            {filteredSales.length === 0 && <div className="py-8 text-sm text-muted-foreground text-center">No sales match filters.</div>}
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
