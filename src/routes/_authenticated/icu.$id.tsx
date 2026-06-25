import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  Plus,
  Printer,
  Activity,
  Wind,
  Stethoscope,
  HeartPulse,
  Pill,
  FlaskConical,
  ScanLine,
  ClipboardList,
  Receipt,
  FileText,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { VoiceDictate } from "@/components/voice-dictate";
import { ICU_STATUS, ICU_STATUS_STYLES, pushICUChargeToBill } from "@/components/icu/shared";

export const Route = createFileRoute("/_authenticated/icu/$id")({ component: ICUWorkspace });

function ICUWorkspace() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard");

  const { data: adm, refetch } = useQuery({
    queryKey: ["icu-adm", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("admissions")
        .select(
          "id, admission_no, admitted_at, status, icu_status, initial_diagnosis, reason, patient_id, doctor_id, ward_id, bed_id, patients(id, full_name, uhid, mobile, dob, gender, photo_url), doctors(id, name), beds(id, bed_number, charge_per_day), wards(id, name, type)"
        )
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["icu-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("icu_settings").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`icu-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vitals", filter: `admission_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["icu-vitals", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  if (!adm) return <div className="p-6 text-sm text-muted-foreground">Loading admission…</div>;

  const days = adm.admitted_at ? differenceInDays(new Date(), new Date(adm.admitted_at)) + 1 : 0;

  const setStatus = async (s: string) => {
    const { error } = await supabase.from("admissions").update({ icu_status: s as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Status: ${s}`);
    refetch();
    qc.invalidateQueries({ queryKey: ["icu-admissions"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/icu">
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Link>
          </Button>
          <Avatar className="size-12">
            <AvatarImage src={adm.patients?.photo_url ?? undefined} />
            <AvatarFallback>{adm.patients?.full_name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-lg font-semibold">{adm.patients?.full_name}</div>
            <div className="text-xs text-muted-foreground">
              {adm.patients?.uhid} · {adm.patients?.dob ? (new Date().getFullYear() - new Date(adm.patients.dob).getFullYear()) : "—"}y · {adm.patients?.gender ?? "—"} · {adm.admission_no} · Day {days} · {adm.beds?.bed_number} ({adm.wards?.name})
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={adm.icu_status ?? "stable"} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ICU_STATUS.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className={`capitalize ${ICU_STATUS_STYLES[adm.icu_status ?? "stable"]}`}>
            {adm.icu_status ?? "stable"}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link to="/ipd/$id" params={{ id }}>
              Full IPD profile
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard"><Activity className="size-3.5 mr-1.5" />Dashboard</TabsTrigger>
          <TabsTrigger value="doctor"><Stethoscope className="size-3.5 mr-1.5" />Doctor notes</TabsTrigger>
          <TabsTrigger value="nursing"><FileText className="size-3.5 mr-1.5" />Nursing notes</TabsTrigger>
          <TabsTrigger value="vitals"><HeartPulse className="size-3.5 mr-1.5" />Vitals</TabsTrigger>
          <TabsTrigger value="meds"><Pill className="size-3.5 mr-1.5" />Medications</TabsTrigger>
          <TabsTrigger value="labs"><FlaskConical className="size-3.5 mr-1.5" />Labs</TabsTrigger>
          <TabsTrigger value="rad"><ScanLine className="size-3.5 mr-1.5" />Radiology</TabsTrigger>
          <TabsTrigger value="vent"><Wind className="size-3.5 mr-1.5" />Ventilator</TabsTrigger>
          <TabsTrigger value="proc"><ClipboardList className="size-3.5 mr-1.5" />Procedures</TabsTrigger>
          <TabsTrigger value="bill"><Receipt className="size-3.5 mr-1.5" />Billing</TabsTrigger>
          <TabsTrigger value="transfer"><ArrowRightLeft className="size-3.5 mr-1.5" />Transfer</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab adm={adm} settings={settings} /></TabsContent>
        <TabsContent value="doctor"><DoctorNotesTab adm={adm} /></TabsContent>
        <TabsContent value="nursing"><NursingNotesTab adm={adm} /></TabsContent>
        <TabsContent value="vitals"><VitalsTab adm={adm} settings={settings} /></TabsContent>
        <TabsContent value="meds"><MedsTab adm={adm} /></TabsContent>
        <TabsContent value="labs"><LabsTab adm={adm} /></TabsContent>
        <TabsContent value="rad"><RadTab adm={adm} /></TabsContent>
        <TabsContent value="vent"><VentilatorTab adm={adm} settings={settings} /></TabsContent>
        <TabsContent value="proc"><ProceduresTab adm={adm} /></TabsContent>
        <TabsContent value="bill"><BillingTab adm={adm} settings={settings} /></TabsContent>
        <TabsContent value="transfer"><TransferTab adm={adm} onDone={refetch} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- DASHBOARD TAB -------------------- */
function DashboardTab({ adm, settings }: any) {
  const { data: latestVitals } = useQuery({
    queryKey: ["icu-latest-vitals", adm.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vitals")
        .select("*")
        .eq("admission_id", adm.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const alerts = useMemo(() => {
    if (!latestVitals || !settings) return [] as string[];
    const a: string[] = [];
    if (latestVitals.oxygen && latestVitals.oxygen < settings.alert_spo2_min) a.push(`Low SpO₂ ${latestVitals.oxygen}%`);
    if (latestVitals.pulse && (latestVitals.pulse < settings.alert_hr_min || latestVitals.pulse > settings.alert_hr_max)) a.push(`HR ${latestVitals.pulse}`);
    if (latestVitals.systolic && latestVitals.systolic > settings.alert_bp_sys_max) a.push(`BP ${latestVitals.systolic}/${latestVitals.diastolic}`);
    if (latestVitals.temperature && latestVitals.temperature > settings.alert_temp_max) a.push(`Temp ${latestVitals.temperature}°C`);
    if (latestVitals.respiratory_rate && latestVitals.respiratory_rate > settings.alert_rr_max) a.push(`RR ${latestVitals.respiratory_rate}`);
    if (latestVitals.gcs_score && latestVitals.gcs_score < settings.alert_gcs_min) a.push(`GCS ${latestVitals.gcs_score}`);
    return a;
  }, [latestVitals, settings]);

  const v: any = latestVitals ?? {};
  const cards = [
    ["HR", v.pulse, "bpm"],
    ["BP", v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : "—", "mmHg"],
    ["SpO₂", v.oxygen, "%"],
    ["Temp", v.temperature, "°C"],
    ["RR", v.respiratory_rate, "/min"],
    ["Sugar", v.sugar, "mg/dl"],
    ["CVP", v.cvp, "cmH₂O"],
    ["GCS", v.gcs_score, "/15"],
  ];

  return (
    <div className="space-y-4 mt-4">
      {alerts.length > 0 && (
        <Card className="p-4 border-destructive/30 bg-destructive/5">
          <div className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" /> Critical
          </div>
          <div className="text-sm text-destructive mt-1">{alerts.join(" · ")}</div>
        </Card>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {cards.map(([l, val, unit]) => (
          <Card key={String(l)} className="p-3">
            <div className="text-[10px] uppercase text-muted-foreground">{l}</div>
            <div className="text-xl font-semibold tabular-nums mt-1">
              {val ?? "—"} <span className="text-[10px] text-muted-foreground">{unit}</span>
            </div>
          </Card>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        Last recorded: {latestVitals?.recorded_at ? format(new Date(latestVitals.recorded_at), "dd MMM HH:mm") : "—"}
      </div>
    </div>
  );
}

/* -------------------- DOCTOR NOTES -------------------- */
function DoctorNotesTab({ adm }: any) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const { data: notes = [] } = useQuery({
    queryKey: ["icu-dn", adm.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("icu_doctor_notes")
        .select("*")
        .eq("admission_id", adm.id)
        .order("recorded_at", { ascending: false });
      return data ?? [];
    },
  });
  const save = async () => {
    if (!note.trim()) return toast.error("Note required");
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await (supabase as any).from("icu_doctor_notes").insert({
      admission_id: adm.id,
      patient_id: adm.patient_id,
      doctor_id: adm.doctor_id,
      doctor_name: doctorName || adm.doctors?.name,
      note,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    setNote("");
    toast.success("Note added");
    qc.invalidateQueries({ queryKey: ["icu-dn", adm.id] });
  };
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Doctor</Label>
            <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder={adm.doctors?.name ?? "Doctor name"} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Clinical note</Label>
            <VoiceDictate onTranscript={(t) => setNote((p) => (p ? p + " " + t : t))} />
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
        </div>
        <Button onClick={save}>
          <Save className="size-4 mr-2" />
          Save note
        </Button>
      </Card>
      <NotesList items={notes} fields={["doctor_name", "recorded_at", "note"]} title="Doctor notes" />
    </div>
  );
}

/* -------------------- NURSING NOTES (reuses public.nursing_notes) -------------------- */
function NursingNotesTab({ adm }: any) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const { data: notes = [] } = useQuery({
    queryKey: ["icu-nn", adm.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("nursing_notes")
        .select("*")
        .eq("admission_id", adm.id)
        .order("created_at", { ascending: false });
      return (data ?? []).map((n: any) => ({ ...n, recorded_at: n.created_at }));
    },
  });
  const save = async () => {
    if (!note.trim()) return toast.error("Note required");
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("nursing_notes").insert({
      admission_id: adm.id,
      note,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    setNote("");
    toast.success("Note added");
    qc.invalidateQueries({ queryKey: ["icu-nn", adm.id] });
  };
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label>Nursing note</Label>
          <VoiceDictate onTranscript={(t) => setNote((p) => (p ? p + " " + t : t))} />
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
        <Button onClick={save}>
          <Save className="size-4 mr-2" />
          Save note
        </Button>
      </Card>
      <NotesList items={notes} fields={["recorded_at", "note"]} title="Nursing notes" />
    </div>
  );
}

function NotesList({ items, fields, title }: any) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="font-semibold">{title}</div>
        <Badge variant="secondary">{items.length}</Badge>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => window.print()}>
          <Printer className="size-3.5 mr-1.5" />
          Print
        </Button>
      </div>
      <div className="divide-y rounded border">
        {items.map((n: any) => (
          <div key={n.id} className="p-3 text-sm">
            <div className="text-xs text-muted-foreground">
              {fields.includes("doctor_name") && <span className="font-medium text-foreground">{n.doctor_name ?? "—"}</span>}
              {fields.includes("doctor_name") && " · "}
              {n.recorded_at ? format(new Date(n.recorded_at), "dd MMM yy HH:mm") : ""}
            </div>
            <div className="mt-1 whitespace-pre-wrap">{n.note}</div>
          </div>
        ))}
        {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No notes yet.</div>}
      </div>
    </Card>
  );
}

/* -------------------- VITALS (reuses public.vitals) -------------------- */
function VitalsTab({ adm, settings }: any) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>({});
  const { data: vitals = [] } = useQuery({
    queryKey: ["icu-vitals", adm.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vitals")
        .select("*")
        .eq("admission_id", adm.id)
        .order("recorded_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });
  const save = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    const payload: any = {
      admission_id: adm.id,
      patient_id: adm.patient_id,
      recorded_by: user?.id,
      systolic: f.systolic ? Number(f.systolic) : null,
      diastolic: f.diastolic ? Number(f.diastolic) : null,
      pulse: f.pulse ? Number(f.pulse) : null,
      temperature: f.temperature ? Number(f.temperature) : null,
      oxygen: f.oxygen ? Number(f.oxygen) : null,
      respiratory_rate: f.respiratory_rate ? Number(f.respiratory_rate) : null,
      sugar: f.sugar ? Number(f.sugar) : null,
      cvp: f.cvp ? Number(f.cvp) : null,
      gcs_score: f.gcs_score ? Number(f.gcs_score) : null,
      notes: f.notes || null,
    };
    const { error } = await supabase.from("vitals").insert(payload);
    if (error) return toast.error(error.message);

    // Auto-create alerts if thresholds breached
    if (settings) {
      const alerts: any[] = [];
      const push = (m: string, sev = "high") =>
        alerts.push({ patient_id: adm.patient_id, alert_type: "vital", severity: sev, message: m });
      if (payload.oxygen && payload.oxygen < settings.alert_spo2_min) push(`SpO₂ ${payload.oxygen}%`);
      if (payload.pulse && (payload.pulse < settings.alert_hr_min || payload.pulse > settings.alert_hr_max))
        push(`HR ${payload.pulse}`);
      if (payload.systolic && payload.systolic > settings.alert_bp_sys_max)
        push(`BP ${payload.systolic}/${payload.diastolic}`);
      if (payload.temperature && payload.temperature > settings.alert_temp_max) push(`Temp ${payload.temperature}°C`);
      if (payload.respiratory_rate && payload.respiratory_rate > settings.alert_rr_max) push(`RR ${payload.respiratory_rate}`);
      if (payload.gcs_score && payload.gcs_score < settings.alert_gcs_min) push(`GCS ${payload.gcs_score}`, "critical");
      if (alerts.length) await (supabase as any).from("icu_alerts").insert(alerts);
    }

    toast.success("Vitals recorded");
    setF({});
    qc.invalidateQueries({ queryKey: ["icu-vitals", adm.id] });
    qc.invalidateQueries({ queryKey: ["icu-latest-vitals", adm.id] });
  };

  const trend = [...vitals].reverse().map((v) => ({
    t: v.recorded_at ? format(new Date(v.recorded_at), "HH:mm") : "",
    systolic: v.systolic,
    pulse: v.pulse,
    oxygen: v.oxygen,
  }));

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 space-y-3">
        <div className="font-semibold text-sm">Record vitals</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["systolic", "BP Sys"],
            ["diastolic", "BP Dia"],
            ["pulse", "Pulse"],
            ["oxygen", "SpO₂"],
            ["temperature", "Temp °C"],
            ["respiratory_rate", "RR"],
            ["sugar", "Sugar"],
            ["cvp", "CVP"],
            ["gcs_score", "GCS"],
          ].map(([k, l]) => (
            <div key={k}>
              <Label className="text-xs">{l}</Label>
              <Input type="number" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <Button onClick={save}>
          <Save className="size-4 mr-2" />
          Record
        </Button>
      </Card>

      {trend.length > 1 && (
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2">Trends</div>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="systolic" stroke="hsl(var(--primary))" dot={false} />
                <Line type="monotone" dataKey="pulse" stroke="hsl(var(--destructive))" dot={false} />
                <Line type="monotone" dataKey="oxygen" stroke="#16a34a" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-0">
        <div className="rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2">When</th>
                <th>BP</th>
                <th>HR</th>
                <th>SpO₂</th>
                <th>Temp</th>
                <th>RR</th>
                <th>Sugar</th>
                <th>CVP</th>
                <th>GCS</th>
              </tr>
            </thead>
            <tbody>
              {vitals.map((v: any) => (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2">{v.recorded_at ? format(new Date(v.recorded_at), "dd MMM HH:mm") : ""}</td>
                  <td className="text-center">{v.systolic ? `${v.systolic}/${v.diastolic ?? "—"}` : "—"}</td>
                  <td className="text-center">{v.pulse ?? "—"}</td>
                  <td className="text-center">{v.oxygen ?? "—"}</td>
                  <td className="text-center">{v.temperature ?? "—"}</td>
                  <td className="text-center">{v.respiratory_rate ?? "—"}</td>
                  <td className="text-center">{v.sugar ?? "—"}</td>
                  <td className="text-center">{v.cvp ?? "—"}</td>
                  <td className="text-center">{v.gcs_score ?? "—"}</td>
                </tr>
              ))}
              {vitals.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    No vitals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------------------- MEDICATIONS (reuses medication_administration) -------------------- */
function MedsTab({ adm }: any) {
  const { data: meds = [] } = useQuery({
    queryKey: ["icu-meds", adm.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("medication_administration")
        .select("*")
        .eq("admission_id", adm.id)
        .order("scheduled_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="font-semibold">Medication administration</div>
        <Badge variant="secondary">{meds.length}</Badge>
        <Button asChild size="sm" variant="ghost" className="ml-auto">
          <Link to="/ipd/$id" params={{ id: adm.id }}>
            Add via IPD →
          </Link>
        </Button>
      </div>
      <div className="rounded border divide-y text-sm">
        {meds.map((m: any) => (
          <div key={m.id} className="grid grid-cols-4 px-3 py-2 gap-2">
            <div>{m.scheduled_at ? format(new Date(m.scheduled_at), "dd MMM HH:mm") : ""}</div>
            <div className="font-medium">{m.medicine_name}</div>
            <div>{m.dosage}</div>
            <div className="capitalize text-right">{m.status}</div>
          </div>
        ))}
        {meds.length === 0 && <div className="p-6 text-center text-muted-foreground">No medications scheduled.</div>}
      </div>
    </Card>
  );
}

/* -------------------- LABS / RADIOLOGY -------------------- */
function LabsTab({ adm }: any) {
  const { data: labs = [] } = useQuery({
    queryKey: ["icu-labs", adm.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("lab_orders")
        .select("*")
        .eq("admission_id", adm.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return <OrderList rows={labs} type="lab" />;
}
function RadTab({ adm }: any) {
  const { data: rad = [] } = useQuery({
    queryKey: ["icu-rad", adm.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("radiology_orders")
        .select("*")
        .eq("admission_id", adm.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return <OrderList rows={rad} type="rad" />;
}
function OrderList({ rows, type }: any) {
  return (
    <Card className="p-4 mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="font-semibold capitalize">{type === "lab" ? "Lab orders" : "Radiology orders"}</div>
        <Badge variant="secondary">{rows.length}</Badge>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => window.print()}>
          <Printer className="size-3.5 mr-1.5" />
          Print
        </Button>
        <Button
          size="sm"
          variant="outline"
          asChild
        >
          <a href={`https://wa.me/?text=${encodeURIComponent(`${rows.length} ${type} orders`)}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </Button>
      </div>
      <div className="rounded border divide-y text-sm">
        {rows.map((r: any) => (
          <div key={r.id} className="px-3 py-2 grid grid-cols-4 gap-2">
            <div>{r.created_at ? format(new Date(r.created_at), "dd MMM HH:mm") : ""}</div>
            <div className="font-medium">{r.investigation ?? r.modality ?? r.notes ?? "—"}</div>
            <div className="capitalize">{r.status}</div>
            <div className="text-right">₹{Number(r.amount ?? r.total_amount ?? 0).toLocaleString()}</div>
          </div>
        ))}
        {rows.length === 0 && <div className="p-6 text-center text-muted-foreground">No orders.</div>}
      </div>
    </Card>
  );
}

/* -------------------- VENTILATOR -------------------- */
function VentilatorTab({ adm, settings }: any) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ vent_type: "Invasive", mode: "AC", fio2: "", peep: "", resp_rate: "", tidal_volume: "", notes: "" });
  const { data: rows = [] } = useQuery({
    queryKey: ["icu-vent", adm.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("icu_ventilator_records")
        .select("*")
        .eq("admission_id", adm.id)
        .order("start_date", { ascending: false });
      return data ?? [];
    },
  });
  const save = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    const charge = Number(settings?.ventilator_charge_per_day ?? 0);
    const { error } = await (supabase as any).from("icu_ventilator_records").insert({
      admission_id: adm.id,
      patient_id: adm.patient_id,
      vent_type: f.vent_type,
      mode: f.mode,
      fio2: f.fio2 ? Number(f.fio2) : null,
      peep: f.peep ? Number(f.peep) : null,
      resp_rate: f.resp_rate ? Number(f.resp_rate) : null,
      tidal_volume: f.tidal_volume ? Number(f.tidal_volume) : null,
      notes: f.notes || null,
      charge_per_day: charge,
      status: "active",
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    // mark patient on ventilator
    await supabase.from("admissions").update({ icu_status: "ventilator" }).eq("id", adm.id);
    toast.success("Ventilator started");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["icu-vent", adm.id] });
    qc.invalidateQueries({ queryKey: ["icu-adm", adm.id] });
  };
  const stop = async (id: string) => {
    await (supabase as any).from("icu_ventilator_records").update({ status: "stopped", end_date: new Date().toISOString() }).eq("id", id);
    toast.success("Ventilator stopped");
    qc.invalidateQueries({ queryKey: ["icu-vent", adm.id] });
  };
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <div className="font-semibold">Ventilator history</div>
          <Badge variant="secondary">{rows.length}</Badge>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="ml-auto">
                <Plus className="size-3.5 mr-1.5" />
                Start ventilator
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start ventilator</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={f.vent_type} onValueChange={(v) => setF({ ...f, vent_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Invasive", "Non-invasive", "BiPAP", "CPAP", "HFNC"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mode</Label>
                  <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["AC", "SIMV", "PSV", "PRVC", "APRV", "CMV"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>FiO₂ %</Label><Input type="number" value={f.fio2} onChange={(e) => setF({ ...f, fio2: e.target.value })} /></div>
                <div><Label>PEEP</Label><Input type="number" value={f.peep} onChange={(e) => setF({ ...f, peep: e.target.value })} /></div>
                <div><Label>Resp rate</Label><Input type="number" value={f.resp_rate} onChange={(e) => setF({ ...f, resp_rate: e.target.value })} /></div>
                <div><Label>Tidal volume</Label><Input type="number" value={f.tidal_volume} onChange={(e) => setF({ ...f, tidal_volume: e.target.value })} /></div>
              </div>
              <Textarea placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
              <DialogFooter><Button onClick={save}>Start</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="rounded border divide-y mt-3 text-sm">
          {rows.map((r: any) => (
            <div key={r.id} className="px-3 py-2 grid grid-cols-7 gap-2 items-center">
              <div>{r.start_date ? format(new Date(r.start_date), "dd MMM HH:mm") : ""}</div>
              <div className="font-medium">{r.vent_type}</div>
              <div>{r.mode}</div>
              <div>FiO₂ {r.fio2 ?? "—"}%</div>
              <div>PEEP {r.peep ?? "—"}</div>
              <div className="capitalize">{r.status}</div>
              <div className="text-right">
                {r.status === "active" ? (
                  <Button size="sm" variant="outline" onClick={() => stop(r.id)}>Stop</Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{r.end_date ? format(new Date(r.end_date), "dd MMM HH:mm") : ""}</span>
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="p-6 text-center text-muted-foreground">No ventilator records.</div>}
        </div>
      </Card>
    </div>
  );
}

/* -------------------- PROCEDURES -------------------- */
function ProceduresTab({ adm }: any) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>({ procedure_type: "Intubation", notes: "", charges: "" });
  const { data: rows = [] } = useQuery({
    queryKey: ["icu-proc", adm.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("icu_procedures")
        .select("*")
        .eq("admission_id", adm.id)
        .order("performed_at", { ascending: false });
      return data ?? [];
    },
  });
  const save = async () => {
    if (!f.procedure_type) return;
    const user = (await supabase.auth.getUser()).data.user;
    const charges = Number(f.charges) || 0;
    const { error } = await (supabase as any).from("icu_procedures").insert({
      admission_id: adm.id,
      patient_id: adm.patient_id,
      doctor_id: adm.doctor_id,
      procedure_type: f.procedure_type,
      notes: f.notes || null,
      charges,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    if (charges > 0) {
      try {
        await pushICUChargeToBill({
          admission_id: adm.id,
          patient_id: adm.patient_id,
          category: "ICU Procedure",
          description: f.procedure_type,
          amount: charges,
        });
      } catch (e: any) {
        toast.error("Billing sync: " + e.message);
      }
    }
    setF({ procedure_type: "Intubation", notes: "", charges: "" });
    toast.success("Procedure recorded");
    qc.invalidateQueries({ queryKey: ["icu-proc", adm.id] });
  };
  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Procedure</Label>
            <Select value={f.procedure_type} onValueChange={(v) => setF({ ...f, procedure_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Intubation", "Extubation", "Central Line", "Arterial Line", "Dialysis", "Tracheostomy", "Bronchoscopy", "Chest Tube", "Other"].map((x) => (
                  <SelectItem key={x} value={x}>{x}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Charges (₹)</Label>
            <Input type="number" value={f.charges} onChange={(e) => setF({ ...f, charges: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
        </div>
        <Button onClick={save}><Save className="size-4 mr-2" />Record</Button>
      </Card>
      <Card className="p-0">
        <div className="rounded border divide-y text-sm">
          {rows.map((r: any) => (
            <div key={r.id} className="px-3 py-2 grid grid-cols-4 gap-2">
              <div>{r.performed_at ? format(new Date(r.performed_at), "dd MMM HH:mm") : ""}</div>
              <div className="font-medium">{r.procedure_type}</div>
              <div className="truncate">{r.notes ?? "—"}</div>
              <div className="text-right">₹{Number(r.charges ?? 0).toLocaleString()}</div>
            </div>
          ))}
          {rows.length === 0 && <div className="p-6 text-center text-muted-foreground">No procedures recorded.</div>}
        </div>
      </Card>
    </div>
  );
}

/* -------------------- BILLING -------------------- */
function BillingTab({ adm, settings }: any) {
  const qc = useQueryClient();
  const { data: bills = [] } = useQuery({
    queryKey: ["icu-bills", adm.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bills")
        .select("*, bill_items(*)")
        .eq("admission_id", adm.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const aggregate = async () => {
    const days = adm.admitted_at ? Math.max(differenceInDays(new Date(), new Date(adm.admitted_at)) + 1, 1) : 1;
    const bedCharge = Number(adm.beds?.charge_per_day ?? settings?.bed_charge_per_day ?? 0) * days;
    const nursing = Number(settings?.nursing_charge_per_day ?? 0) * days;

    const [vents, procs, labs, rads] = await Promise.all([
      (supabase as any).from("icu_ventilator_records").select("start_date, end_date, charge_per_day, status").eq("admission_id", adm.id),
      (supabase as any).from("icu_procedures").select("charges, procedure_type").eq("admission_id", adm.id),
      (supabase as any).from("lab_orders").select("total_amount").eq("admission_id", adm.id),
      (supabase as any).from("radiology_orders").select("amount").eq("admission_id", adm.id),
    ]);

    const ventTotal = (vents.data ?? []).reduce((s: number, v: any) => {
      const end = v.end_date ? new Date(v.end_date) : new Date();
      const start = new Date(v.start_date);
      const d = Math.max(differenceInDays(end, start) + 1, 1);
      return s + d * Number(v.charge_per_day ?? 0);
    }, 0);
    const procTotal = (procs.data ?? []).reduce((s: number, p: any) => s + Number(p.charges ?? 0), 0);
    const labTotal = (labs.data ?? []).reduce((s: number, l: any) => s + Number(l.total_amount ?? 0), 0);
    const radTotal = (rads.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

    const items = [
      { category: "ICU Bed", description: `${adm.beds?.bed_number ?? "ICU"} × ${days} day(s)`, quantity: days, unit_price: Number(adm.beds?.charge_per_day ?? settings?.bed_charge_per_day ?? 0), amount: bedCharge },
      { category: "Nursing", description: `Nursing care × ${days} day(s)`, quantity: days, unit_price: Number(settings?.nursing_charge_per_day ?? 0), amount: nursing },
      ventTotal > 0 && { category: "Ventilator", description: "Ventilator support", quantity: 1, unit_price: ventTotal, amount: ventTotal },
      procTotal > 0 && { category: "ICU Procedure", description: `${(procs.data ?? []).length} procedure(s)`, quantity: 1, unit_price: procTotal, amount: procTotal },
      labTotal > 0 && { category: "Lab", description: `${(labs.data ?? []).length} lab order(s)`, quantity: 1, unit_price: labTotal, amount: labTotal },
      radTotal > 0 && { category: "Radiology", description: `${(rads.data ?? []).length} radiology order(s)`, quantity: 1, unit_price: radTotal, amount: radTotal },
    ].filter(Boolean) as any[];

    const subtotal = items.reduce((s, i) => s + i.amount, 0);

    // Find or create draft bill for this admission
    let { data: bill } = await (supabase as any)
      .from("bills")
      .select("*")
      .eq("admission_id", adm.id)
      .in("status", ["draft", "partial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const user = (await supabase.auth.getUser()).data.user;
    if (!bill) {
      const { data: created, error } = await (supabase as any)
        .from("bills")
        .insert({ patient_id: adm.patient_id, admission_id: adm.id, subtotal, total: subtotal, paid: 0, pending: subtotal, status: "draft", created_by: user?.id })
        .select()
        .single();
      if (error) return toast.error(error.message);
      bill = created;
    } else {
      // Replace ICU-aggregated line items by clearing existing draft items and re-inserting (idempotent)
      await (supabase as any).from("bill_items").delete().eq("bill_id", bill.id);
      const paid = Number(bill.paid ?? 0);
      await (supabase as any)
        .from("bills")
        .update({ subtotal, total: subtotal, pending: Math.max(subtotal - paid, 0) })
        .eq("id", bill.id);
    }
    await (supabase as any).from("bill_items").insert(items.map((it, idx) => ({ ...it, bill_id: bill!.id, position: idx + 1 })));

    toast.success("ICU bill aggregated");
    qc.invalidateQueries({ queryKey: ["icu-bills", adm.id] });
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <div className="font-semibold">ICU billing</div>
          <Button size="sm" className="ml-auto" onClick={aggregate}>
            <Receipt className="size-3.5 mr-1.5" />
            Re-aggregate charges
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/billing">Open billing module →</Link>
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Aggregates ICU bed, ventilator, nursing, procedures, labs and radiology into the patient's active draft IPD bill. Re-run after new charges.
        </div>
      </Card>

      {bills.map((b: any) => (
        <Card key={b.id} className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="font-mono text-sm">{b.bill_no ?? b.id.slice(0, 8)}</div>
            <Badge variant="outline" className="capitalize">{b.status}</Badge>
            <div className="ml-auto text-sm">
              Total <span className="font-semibold">₹{Number(b.total ?? 0).toLocaleString()}</span> · Paid ₹{Number(b.paid ?? 0).toLocaleString()} · Pending ₹{Number(b.pending ?? 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded border divide-y text-sm">
            {(b.bill_items ?? []).map((it: any) => (
              <div key={it.id} className="px-3 py-1.5 grid grid-cols-5 gap-2">
                <div className="capitalize">{it.category}</div>
                <div className="col-span-2 truncate">{it.description}</div>
                <div className="text-right">{it.quantity} × ₹{Number(it.unit_price).toLocaleString()}</div>
                <div className="text-right font-medium">₹{Number(it.amount).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
      ))}
      {bills.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">No bills yet — click “Re-aggregate charges”.</Card>}
    </div>
  );
}

/* -------------------- TRANSFER (back to ward) -------------------- */
function TransferTab({ adm, onDone }: any) {
  const [bedId, setBedId] = useState("");
  const [reason, setReason] = useState("");
  const { data: wardBeds = [] } = useQuery({
    queryKey: ["icu-transfer-out-beds"],
    queryFn: async () => {
      const { data: wards } = await supabase.from("wards").select("id, name, type").neq("type", "icu");
      const ids = (wards ?? []).map((w: any) => w.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("beds")
        .select("id, bed_number, status, ward_id, wards(name)")
        .in("ward_id", ids)
        .eq("status", "available")
        .order("bed_number");
      return data ?? [];
    },
  });
  const submit = async () => {
    if (!bedId) return toast.error("Select a ward bed");
    const bed = wardBeds.find((b: any) => b.id === bedId);
    if (!bed) return;
    const user = (await supabase.auth.getUser()).data.user;
    await supabase.from("admissions").update({ ward_id: bed.ward_id, bed_id: bed.id, icu_status: "improving" }).eq("id", adm.id);
    if (adm.bed_id) await supabase.from("beds").update({ status: "available" }).eq("id", adm.bed_id);
    await supabase.from("beds").update({ status: "occupied" }).eq("id", bed.id);
    await (supabase as any).from("bed_transfers").insert({
      admission_id: adm.id,
      from_ward_id: adm.ward_id,
      to_ward_id: bed.ward_id,
      from_bed_id: adm.bed_id,
      to_bed_id: bed.id,
      reason: reason || "ICU → Ward",
      created_by: user?.id,
    });
    toast.success("Transferred back to ward");
    setBedId("");
    setReason("");
    onDone();
  };
  return (
    <Card className="p-4 mt-4 space-y-3 max-w-2xl">
      <div className="font-semibold">Transfer back to ward</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Ward bed</Label>
          <Select value={bedId} onValueChange={setBedId}>
            <SelectTrigger><SelectValue placeholder="Select bed" /></SelectTrigger>
            <SelectContent>
              {wardBeds.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.wards?.name} · {b.bed_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <Button onClick={submit}>
        <ArrowRightLeft className="size-4 mr-2" />
        Transfer
      </Button>
    </Card>
  );
}
