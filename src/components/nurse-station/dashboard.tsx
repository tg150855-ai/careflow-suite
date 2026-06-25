import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeartPulse, Pill, AlertCircle, ClipboardList, Activity, Stethoscope, Users, FileText } from "lucide-react";
import { differenceInMinutes, format } from "date-fns";
import { NS_QK, loadActiveAdmissions } from "./shared";

export function NSDashboard({ onTab }: { onTab: (t: string) => void }) {
  const { data: admissions = [] } = useQuery({ queryKey: NS_QK.admissions, queryFn: loadActiveAdmissions });
  const ids = admissions.map((a: any) => a.id);

  const { data: due = [] } = useQuery({
    queryKey: ["ns-dash-due", ids.length],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("medication_administration")
      .select("id, admission_id, medicine_name, scheduled_at, status")
      .in("admission_id", ids).eq("status", "scheduled").order("scheduled_at")).data ?? [],
    refetchInterval: 60000,
  });

  const { data: settings } = useQuery({
    queryKey: NS_QK.settings,
    queryFn: async () => (await (supabase as any).from("nurse_station_settings").select("*").maybeSingle()).data,
  });

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ["ns-dash-orders"],
    enabled: ids.length > 0,
    queryFn: async () => (await (supabase as any).from("doctor_orders")
      .select("id, status, priority, order_text, admission_id")
      .in("admission_id", ids).neq("status", "completed")).data ?? [],
    refetchInterval: 60000,
  });

  const { data: latestVitals = [] } = useQuery({
    queryKey: ["ns-dash-vitals", ids.length],
    enabled: ids.length > 0,
    queryFn: async () => (await supabase.from("vitals")
      .select("admission_id, recorded_at, systolic, diastolic, pulse, temperature, oxygen, respiratory_rate, sugar")
      .in("admission_id", ids).order("recorded_at", { ascending: false }).limit(500)).data ?? [],
    refetchInterval: 60000,
  });

  const { data: handover } = useQuery({
    queryKey: ["ns-dash-handover"],
    queryFn: async () => (await (supabase as any).from("shift_handovers").select("id, shift, notes, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle()).data,
  });

  const icuCount = admissions.filter((a: any) => (a.wards?.type ?? "").toLowerCase().includes("icu") || (a.wards?.name ?? "").toLowerCase().includes("icu")).length;
  const overdueMeds = due.filter((d: any) => new Date(d.scheduled_at) < new Date()).length;
  const upcomingMeds = due.length;
  const patientsNeedingMeds = new Set(due.map((d: any) => d.admission_id)).size;

  const freqH = Number(settings?.vitals_frequency_hours ?? 4);
  const latestByAdm: Record<string, any> = {};
  latestVitals.forEach((v: any) => { if (!latestByAdm[v.admission_id]) latestByAdm[v.admission_id] = v; });
  const pendingVitals = admissions.filter((a: any) => {
    const v = latestByAdm[a.id];
    if (!v) return true;
    return (Date.now() - new Date(v.recorded_at).getTime()) / 36e5 > freqH;
  }).length;

  // Critical alerts from latest vitals
  const critAlerts: { admission_id: string; reason: string }[] = [];
  if (settings) {
    Object.values(latestByAdm).forEach((v: any) => {
      if (v.oxygen != null && v.oxygen < Number(settings.critical_spo2)) critAlerts.push({ admission_id: v.admission_id, reason: `SpO₂ ${v.oxygen}%` });
      if (v.pulse != null && (v.pulse < Number(settings.critical_pulse_low) || v.pulse > Number(settings.critical_pulse_high))) critAlerts.push({ admission_id: v.admission_id, reason: `Pulse ${v.pulse}` });
      if (v.systolic != null && (v.systolic < Number(settings.critical_systolic_low) || v.systolic > Number(settings.critical_systolic_high))) critAlerts.push({ admission_id: v.admission_id, reason: `BP ${v.systolic}/${v.diastolic}` });
    });
  }

  const cards = [
    { label: "Admitted patients", value: admissions.length, icon: HeartPulse, tone: "bg-primary/10 text-primary", tab: "board" },
    { label: "ICU patients", value: icuCount, icon: Activity, tone: "bg-rose-100 text-rose-700", tab: "board" },
    { label: "Need medication", value: patientsNeedingMeds, icon: Pill, tone: "bg-amber-100 text-amber-700", tab: "mar" },
    { label: "Pending vitals", value: pendingVitals, icon: Stethoscope, tone: "bg-blue-100 text-blue-700", tab: "vitals" },
    { label: "Pending orders", value: pendingOrders.length, icon: ClipboardList, tone: "bg-purple-100 text-purple-700", tab: "orders" },
    { label: "Critical alerts", value: critAlerts.length, icon: AlertCircle, tone: "bg-red-100 text-red-700", tab: "vitals" },
    { label: "Overdue meds", value: overdueMeds, icon: AlertCircle, tone: "bg-orange-100 text-orange-700", tab: "mar" },
    { label: "Upcoming meds", value: upcomingMeds, icon: Pill, tone: "bg-teal-100 text-teal-700", tab: "mar" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="cursor-pointer hover:shadow-md transition" onClick={() => onTab(c.tab)}>
            <CardContent className="p-4">
              <div className={`size-9 rounded-xl flex items-center justify-center mb-2 ${c.tone}`}><c.icon className="size-4" /></div>
              <div className="text-2xl font-semibold tabular-nums">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="font-semibold flex items-center gap-2 mb-3"><AlertCircle className="size-4 text-rose-600" /> Critical alerts</div>
            {critAlerts.length === 0 ? <div className="text-sm text-muted-foreground">No alerts.</div> : (
              <div className="space-y-2">
                {critAlerts.slice(0, 8).map((a, i) => {
                  const adm = admissions.find((x: any) => x.id === a.admission_id);
                  return <div key={i} className="flex justify-between gap-2 text-sm">
                    <span className="truncate">{adm?.patients?.full_name ?? "—"}</span>
                    <Badge variant="destructive" className="shrink-0">{a.reason}</Badge>
                  </div>;
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="font-semibold flex items-center gap-2 mb-3"><FileText className="size-4" /> Latest shift handover</div>
            {!handover ? <div className="text-sm text-muted-foreground">No handover recorded.</div> : (
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><Badge>{handover.shift}</Badge><span className="text-xs text-muted-foreground">{format(new Date(handover.created_at), "dd MMM HH:mm")}</span></div>
                <div className="text-sm whitespace-pre-wrap line-clamp-6">{handover.notes || "—"}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="font-semibold flex items-center gap-2 mb-3"><Users className="size-4" /> Quick actions</div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => onTab("vitals")}>Record Vitals</Button>
              <Button size="sm" variant="outline" onClick={() => onTab("notes")}>Add Note</Button>
              <Button size="sm" variant="outline" onClick={() => onTab("mar")}>Give Medication</Button>
              <Button size="sm" variant="outline" onClick={() => onTab("orders")}>View Orders</Button>
              <Button size="sm" variant="outline" onClick={() => onTab("handover")}>Handover</Button>
              <Button size="sm" variant="outline" onClick={() => onTab("reports")}>Reports</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="font-semibold flex items-center gap-2 mb-3"><Pill className="size-4" /> Next due medications</div>
          {due.length === 0 ? <div className="text-sm text-muted-foreground">Nothing due.</div> : (
            <div className="space-y-1">
              {due.slice(0, 8).map((d: any) => {
                const adm = admissions.find((x: any) => x.id === d.admission_id);
                const mins = differenceInMinutes(new Date(d.scheduled_at), new Date());
                const overdue = mins < 0;
                return <div key={d.id} className={`flex justify-between items-center text-sm py-1.5 px-2 rounded ${overdue ? "bg-rose-50" : ""}`}>
                  <span className="truncate"><b>{adm?.patients?.full_name ?? "—"}</b> · {d.medicine_name}</span>
                  <span className={`text-xs ${overdue ? "text-rose-600 font-semibold" : "text-muted-foreground"}`}>{format(new Date(d.scheduled_at), "dd HH:mm")}</span>
                </div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
