import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, BedDouble, Users, IndianRupee, Stethoscope, Scissors, AlertCircle } from "lucide-react";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/command-center")({ component: CmdPage });

function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className="border-l-4" style={{ borderLeftColor: `hsl(var(--${accent ?? "primary"}))` }}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </div>
          <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="size-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function CmdPage() {
  const [s, setS] = useState({ revenue: 0, admissions: 0, opdQueue: 0, bedsOcc: 0, bedsTotal: 0, surgeries: 0, alerts: [] as any[] });

  async function load() {
    const today = new Date().toISOString().split("T")[0];
    const sb = supabase as any;
    const [bills, adm, opd, beds, surg, emrg] = await Promise.all([
      sb.from("bills").select("total").gte("created_at", today),
      sb.from("admissions").select("id").is("discharged_at", null),
      sb.from("appointments").select("id").gte("scheduled_at", today + "T00:00:00").lte("scheduled_at", today + "T23:59:59"),
      sb.from("beds").select("status"),
      sb.from("surgeries").select("id").eq("status", "scheduled"),
      sb.from("emergency_cases").select("id, chief_complaint, triage").in("triage", ["red", "orange"]).order("created_at", { ascending: false }).limit(5),
    ]);
    const bedRows = (beds.data ?? []) as any[];
    setS({
      revenue: ((bills.data ?? []) as any[]).reduce((a, b) => a + Number(b.total || 0), 0),
      admissions: (adm.data ?? []).length,
      opdQueue: (opd.data ?? []).length,
      bedsOcc: bedRows.filter((b) => b.status === "occupied").length,
      bedsTotal: bedRows.length,
      surgeries: (surg.data ?? []).length,
      alerts: emrg.data ?? [],
    });
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Activity className="size-6 text-primary" /> Executive Command Center</h1>
        <p className="text-sm text-muted-foreground">Live operations across the hospital. Auto-refreshes every 15s.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Stat icon={IndianRupee} label="Today's Revenue" value={inr(s.revenue)} accent="success" />
        <Stat icon={BedDouble} label="Active Admissions" value={s.admissions} />
        <Stat icon={Users} label="OPD Queue" value={s.opdQueue} />
        <Stat icon={BedDouble} label="Bed Occupancy" value={`${s.bedsOcc}/${s.bedsTotal}`} accent="warning" />
        <Stat icon={Scissors} label="Scheduled Surgeries" value={s.surgeries} />
        <Stat icon={Stethoscope} label="Live Status" value="OK" accent="success" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertCircle className="size-5 text-destructive" /> Critical Alerts</CardTitle></CardHeader>
        <CardContent>
          {s.alerts.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">No critical alerts</div>
          ) : (
            <div className="space-y-2">
              {s.alerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div>
                    <div className="font-medium">{a.chief_complaint || "Emergency case"}</div>
                  </div>
                  <Badge variant="destructive" className="uppercase">{a.triage}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
