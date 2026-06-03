import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { HeartPulse, AlertTriangle, Plus, Activity } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/icu")({ component: ICUPage });

function ICUPage() {
  const [monitoring, setMonitoring] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  const load = () => {
    supabase.from("icu_monitoring" as any).select("*, patients(full_name, uhid)")
      .order("recorded_at", { ascending: false }).limit(100)
      .then(({ data }) => setMonitoring(data ?? []));
    supabase.from("icu_alerts" as any).select("*, patients(full_name)")
      .eq("resolved", false).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setAlerts(data ?? []));
  };

  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
    const ch = supabase.channel("icu").on("postgres_changes", { event: "*", schema: "public", table: "icu_monitoring" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const latestByPatient = new Map<string, any>();
  for (const m of monitoring) if (!latestByPatient.has(m.patient_id)) latestByPatient.set(m.patient_id, m);
  const critical = [...latestByPatient.values()].filter((m) => (m.spo2 && m.spo2 < 92) || (m.bp_sys && m.bp_sys > 180) || (m.heart_rate && (m.heart_rate < 50 || m.heart_rate > 120)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><HeartPulse className="size-6 text-primary" /> ICU & Critical Care</h1>
          <p className="text-sm text-muted-foreground">Real-time monitoring, vitals tracking and critical alerts.</p>
        </div>
        <NewVitalsDialog patients={patients} onCreated={load} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Active Patients" value={latestByPatient.size} />
        <Stat label="On Ventilator" value={[...latestByPatient.values()].filter((m) => m.on_ventilator).length} />
        <Stat label="Critical" value={critical.length} accent="destructive" />
        <Stat label="Open Alerts" value={alerts.length} accent="warning" />
      </div>

      {alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 space-y-2">
            <div className="font-semibold text-sm flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /> Critical Alerts</div>
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <Badge variant="destructive" className="capitalize">{a.severity}</Badge>
                <span className="font-medium">{a.patients?.full_name}</span>
                <span className="text-muted-foreground">{a.message}</span>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={async () => { await supabase.from("icu_alerts" as any).update({ resolved: true }).eq("id", a.id); load(); }}>Resolve</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 divide-y">
          {[...latestByPatient.values()].map((m) => (
            <div key={m.id} className="p-4 grid grid-cols-2 md:grid-cols-7 gap-3 items-center">
              <div className="md:col-span-2">
                <div className="font-medium">{m.patients?.full_name}</div>
                <div className="text-xs text-muted-foreground">{m.patients?.uhid} · {format(new Date(m.recorded_at), "dd MMM HH:mm")}</div>
              </div>
              <Vital label="HR" value={m.heart_rate} unit="bpm" warn={m.heart_rate < 50 || m.heart_rate > 120} />
              <Vital label="BP" value={m.bp_sys && m.bp_dia ? `${m.bp_sys}/${m.bp_dia}` : "—"} unit="mmHg" warn={m.bp_sys > 180} />
              <Vital label="SpO₂" value={m.spo2} unit="%" warn={m.spo2 < 92} />
              <Vital label="Temp" value={m.temperature} unit="°C" warn={m.temperature > 38.5} />
              <Vital label="RR" value={m.resp_rate} unit="/min" warn={m.resp_rate > 25} />
            </div>
          ))}
          {latestByPatient.size === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No monitoring records yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: any) {
  return <Card><CardContent className="pt-5">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold tabular-nums mt-1 ${accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-warning" : ""}`}>{value}</div>
  </CardContent></Card>;
}

function Vital({ label, value, unit, warn }: any) {
  return (
    <div className={`p-2 rounded-lg ${warn ? "bg-destructive/10" : "bg-surface-muted"}`}>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${warn ? "text-destructive" : ""}`}>{value ?? "—"} <span className="text-[10px] text-muted-foreground">{unit}</span></div>
    </div>
  );
}

function NewVitalsDialog({ patients, onCreated }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patient_id: "", heart_rate: "", bp_sys: "", bp_dia: "", spo2: "", temperature: "", resp_rate: "", on_ventilator: false, notes: "" });
  const submit = async () => {
    if (!f.patient_id) return toast.error("Patient required");
    const payload: any = {
      patient_id: f.patient_id,
      heart_rate: f.heart_rate ? Number(f.heart_rate) : null,
      bp_sys: f.bp_sys ? Number(f.bp_sys) : null, bp_dia: f.bp_dia ? Number(f.bp_dia) : null,
      spo2: f.spo2 ? Number(f.spo2) : null, temperature: f.temperature ? Number(f.temperature) : null,
      resp_rate: f.resp_rate ? Number(f.resp_rate) : null, on_ventilator: f.on_ventilator, notes: f.notes || null,
    };
    const { error } = await supabase.from("icu_monitoring" as any).insert(payload);
    if (error) return toast.error(error.message);

    const alerts: any[] = [];
    if (payload.spo2 && payload.spo2 < 92) alerts.push({ patient_id: f.patient_id, alert_type: "low_spo2", severity: "high", message: `SpO₂ ${payload.spo2}%` });
    if (payload.bp_sys && payload.bp_sys > 180) alerts.push({ patient_id: f.patient_id, alert_type: "high_bp", severity: "high", message: `BP ${payload.bp_sys}/${payload.bp_dia}` });
    if (payload.heart_rate && (payload.heart_rate < 50 || payload.heart_rate > 120)) alerts.push({ patient_id: f.patient_id, alert_type: "cardiac_risk", severity: "high", message: `HR ${payload.heart_rate}` });
    if (alerts.length) await supabase.from("icu_alerts" as any).insert(alerts);

    toast.success("Vitals recorded"); setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Record Vitals</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record ICU Vitals</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>HR</Label><Input type="number" value={f.heart_rate} onChange={(e) => setF({ ...f, heart_rate: e.target.value })} /></div>
            <div><Label>BP Sys</Label><Input type="number" value={f.bp_sys} onChange={(e) => setF({ ...f, bp_sys: e.target.value })} /></div>
            <div><Label>BP Dia</Label><Input type="number" value={f.bp_dia} onChange={(e) => setF({ ...f, bp_dia: e.target.value })} /></div>
            <div><Label>SpO₂</Label><Input type="number" value={f.spo2} onChange={(e) => setF({ ...f, spo2: e.target.value })} /></div>
            <div><Label>Temp °C</Label><Input type="number" step="0.1" value={f.temperature} onChange={(e) => setF({ ...f, temperature: e.target.value })} /></div>
            <div><Label>Resp Rate</Label><Input type="number" value={f.resp_rate} onChange={(e) => setF({ ...f, resp_rate: e.target.value })} /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={f.on_ventilator} onCheckedChange={(v) => setF({ ...f, on_ventilator: v })} /><Label>On Ventilator</Label></div>
        </div>
        <DialogFooter><Button onClick={submit}><Activity className="size-4 mr-2" />Record</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
