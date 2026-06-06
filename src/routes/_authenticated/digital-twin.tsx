import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, BedDouble, Scissors, Siren, HeartPulse, Stethoscope, Pill } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/digital-twin")({ component: TwinPage });

function TwinPage() {
  const [s, setS] = useState<any>({ beds: { total: 0, occ: 0 }, icu: 0, ot: 0, opd: 0, er: 0, pharm: 0 });

  async function load() {
    const sb = supabase as any;
    const today = new Date().toISOString().split("T")[0];
    const [beds, icu, ot, opd, er, pharm] = await Promise.all([
      sb.from("beds").select("status"),
      sb.from("icu_monitoring").select("id").gte("recorded_at", today),
      sb.from("surgeries").select("id").eq("status", "scheduled"),
      sb.from("appointments").select("id").gte("scheduled_at", today + "T00:00:00"),
      sb.from("emergency_cases").select("id").gte("created_at", today),
      sb.from("pharmacy_sales").select("id").gte("created_at", today),
    ]);
    const bedRows = beds.data ?? [];
    setS({
      beds: { total: bedRows.length, occ: bedRows.filter((b: any) => b.status === "occupied").length },
      icu: (icu.data ?? []).length, ot: (ot.data ?? []).length,
      opd: (opd.data ?? []).length, er: (er.data ?? []).length, pharm: (pharm.data ?? []).length,
    });
  }
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  const Zone = ({ icon: Icon, name, value, sub, color = "primary" }: any) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className={`size-12 rounded-xl bg-${color}/10 text-${color} flex items-center justify-center`}><Icon className="size-6" /></div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{name}</div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{sub}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const occPct = s.beds.total ? Math.round((s.beds.occ / s.beds.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader icon={Building2} title="Digital Twin Hospital" subtitle="Live visual model of hospital zones, occupancy and patient flow." />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Zone icon={BedDouble} name="Wards" value={`${s.beds.occ}/${s.beds.total}`} sub={`${occPct}% occupied`} />
        <Zone icon={HeartPulse} name="ICU" value={s.icu} sub="Live monitored patients" />
        <Zone icon={Scissors} name="OT / Surgery" value={s.ot} sub="Scheduled today" />
        <Zone icon={Stethoscope} name="OPD" value={s.opd} sub="Appointments today" />
        <Zone icon={Siren} name="Emergency" value={s.er} sub="Cases today" />
        <Zone icon={Pill} name="Pharmacy" value={s.pharm} sub="Sales today" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm font-semibold mb-3">Bed Occupancy Heatmap</div>
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: Math.max(s.beds.total, 30) }).map((_, i) => {
              const occupied = i < s.beds.occ;
              return <div key={i} className={`aspect-square rounded ${occupied ? "bg-destructive" : "bg-success/40"}`} title={`Bed ${i + 1}`} />;
            })}
          </div>
          <div className="flex gap-4 text-xs mt-3 text-muted-foreground">
            <div className="flex items-center gap-1"><div className="size-3 rounded bg-success/40" /> Available</div>
            <div className="flex items-center gap-1"><div className="size-3 rounded bg-destructive" /> Occupied</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
