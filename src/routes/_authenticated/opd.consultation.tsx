import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Stethoscope, Play, Pause, RotateCcw, Save, Printer, Plus, Trash2,
  Clock, CheckCircle2, User, ExternalLink, Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/opd/consultation")({ component: ConsultationPage });

type RxItem = { medicine_name: string; dosage: string; food_instruction: string; duration_days: string };
const EMPTY_ITEM: RxItem = { medicine_name: "", dosage: "", food_instruction: "After food", duration_days: "5" };

function startOfDayIso() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
function endOfDayIso() { const d = new Date(); d.setHours(23,59,59,999); return d.toISOString(); }

function ConsultationPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: async () => (await supabase.from("doctors").select("id, name, specialization").order("name")).data ?? [],
  });

  const { data: queue = [], refetch: refetchQueue } = useQuery({
    queryKey: ["opd-consult-queue", doctorFilter],
    queryFn: async () => {
      let q = supabase.from("appointments")
        .select("id, scheduled_at, status, token_no, patient_id, doctor_id, patients(id, full_name, uhid, gender, dob, allergies, chronic_diseases, blood_group), doctors(name, specialization)")
        .gte("scheduled_at", startOfDayIso())
        .lte("scheduled_at", endOfDayIso())
        .in("status", ["waiting", "checked_in", "booked"])
        .order("scheduled_at");
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      return (await q).data ?? [];
    },
    refetchInterval: 15000,
  });

  const { data: completed = [] } = useQuery({
    queryKey: ["opd-today-completed", doctorFilter],
    queryFn: async () => {
      let q = supabase.from("opd_visits")
        .select("id, diagnosis, chief_complaints, created_at, patient_id, doctor_id, patients(full_name, uhid), doctors(name)")
        .gte("created_at", startOfDayIso())
        .order("created_at", { ascending: false })
        .limit(25);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      return (await q).data ?? [];
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return queue;
    return queue.filter((a: any) =>
      a.patients?.full_name?.toLowerCase().includes(s) ||
      a.patients?.uhid?.toLowerCase().includes(s));
  }, [queue, search]);

  const selected = useMemo(() => filtered.find((a: any) => a.id === selectedId) ?? queue.find((a: any) => a.id === selectedId), [filtered, queue, selectedId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center"><Stethoscope className="size-4 text-primary" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Doctor consultation</h1>
            <p className="text-xs text-muted-foreground">Live OPD queue · timer-based workflow</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="All doctors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient" className="h-9 pl-8 w-[200px]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Queue */}
        <Card className="p-4 xl:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Waiting queue</h2>
            <Badge variant="secondary" className="rounded-full">{filtered.length}</Badge>
          </div>
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Queue is empty.</p>
          ) : (
            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
              {filtered.map((a: any) => {
                const active = a.id === selectedId;
                return (
                  <button key={a.id} onClick={() => setSelectedId(a.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm truncate">{a.patients?.full_name}</div>
                      {a.token_no != null && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">#{a.token_no}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground font-mono truncate">{a.patients?.uhid}</span>
                      <span className="text-[11px] text-muted-foreground">{format(new Date(a.scheduled_at), "HH:mm")}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{a.doctors?.name} · <span className="capitalize">{a.status?.replace("_"," ")}</span></div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Consultation workspace */}
        <div className="xl:col-span-6">
          {selected ? (
            <ConsultationWorkspace key={selected.id} appt={selected} userId={user?.id} onSaved={() => {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: ["opd-consult-queue"] });
              qc.invalidateQueries({ queryKey: ["opd-today-completed"] });
              refetchQueue();
            }} />
          ) : (
            <Card className="p-10 text-center">
              <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <User className="size-5 text-muted-foreground" />
              </div>
              <h2 className="text-base font-semibold">Select a patient to start</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Pick a patient from the queue. A consultation timer starts automatically when you begin.
              </p>
            </Card>
          )}
        </div>

        {/* Today's completed */}
        <Card className="p-4 xl:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Saved today</h2>
            <Badge variant="secondary" className="rounded-full">{completed.length}</Badge>
          </div>
          {completed.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">No completed consultations yet.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {completed.map((v: any) => (
                <div key={v.id} className="rounded-lg border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate">{v.patients?.full_name}</div>
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">{v.patients?.uhid}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{v.diagnosis || v.chief_complaints || "Consultation saved"}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{v.doctors?.name} · {format(new Date(v.created_at), "HH:mm")}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ConsultationWorkspace({ appt, userId, onSaved }: { appt: any; userId?: string; onSaved: () => void }) {
  const p = appt.patients;
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());
  const accumRef = useRef<number>(0);
  const [chief, setChief] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [findings, setFindings] = useState("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [vitals, setVitals] = useState({ bp: "", pulse: "", temp: "", spo2: "", weight: "" });
  const [items, setItems] = useState<RxItem[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  // Auto-mark checked_in when opened
  useEffect(() => {
    if (appt.status !== "checked_in" && appt.status !== "completed") {
      supabase.from("appointments").update({ status: "checked_in" }).eq("id", appt.id);
    }
  }, [appt.id]); // eslint-disable-line

  // Timer
  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const t = setInterval(() => {
      setElapsed(accumRef.current + Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => {
      accumRef.current += Math.floor((Date.now() - startRef.current) / 1000);
      clearInterval(t);
    };
  }, [running]);

  function fmtTime(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }
  function resetTimer() { accumRef.current = 0; startRef.current = Date.now(); setElapsed(0); }
  function updateItem(i: number, k: keyof RxItem, v: string) {
    setItems((arr) => arr.map((it, x) => x === i ? { ...it, [k]: v } : it));
  }

  async function save(opts: { print?: boolean } = {}) {
    setSaving(true);
    try {
      const durationMin = Math.max(1, Math.round(elapsed / 60));
      const notesWithDuration = `${notes}${notes ? "\n\n" : ""}[Consultation duration: ${durationMin} min]`;
      const { data: visit, error: e1 } = await supabase.from("opd_visits").insert({
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        appointment_id: appt.id,
        chief_complaints: chief || null,
        diagnosis: diagnosis || null,
        clinical_findings: findings || null,
        notes: notesWithDuration,
        follow_up_date: followUp || null,
        vitals,
        created_by: userId,
      }).select("id").single();
      if (e1) throw e1;

      const { data: rx, error: e2 } = await supabase.from("prescriptions").insert({ opd_visit_id: visit.id }).select("id").single();
      if (e2) throw e2;

      const valid = items.filter((it) => it.medicine_name.trim());
      if (valid.length) {
        const { error: e3 } = await supabase.from("prescription_items").insert(valid.map((it, idx) => ({
          prescription_id: rx.id,
          medicine_name: it.medicine_name,
          dosage: it.dosage || null,
          food_instruction: it.food_instruction || null,
          duration_days: it.duration_days ? Number(it.duration_days) : null,
          position: idx,
        })));
        if (e3) throw e3;
      }

      await supabase.from("appointments").update({ status: "completed" }).eq("id", appt.id);
      toast.success("Consultation saved");
      if (opts.print) window.open(`/prescriptions/${rx.id}/print`, "_blank");
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const age = p?.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / 31557600000) : null;

  return (
    <Card className="p-4 space-y-4">
      {/* Patient header + timer */}
      <div className="flex flex-wrap items-start gap-3 pb-3 border-b">
        <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
          {p?.full_name?.split(" ").map((n: string) => n[0]).slice(0,2).join("")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold truncate">{p?.full_name}</h2>
            <span className="text-xs text-muted-foreground font-mono">{p?.uhid}</span>
            {age != null && <Badge variant="secondary" className="rounded-full text-[10px]">{age}y · {p?.gender}</Badge>}
            {p?.blood_group && <Badge variant="outline" className="rounded-full text-[10px]">{p.blood_group}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {appt.doctors?.name} · token {appt.token_no ?? "—"} · scheduled {format(new Date(appt.scheduled_at), "HH:mm")}
          </div>
          {(p?.allergies || p?.chronic_diseases) && (
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {p.allergies && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">Allergy: {p.allergies}</span>}
              {p.chronic_diseases && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Chronic: {p.chronic_diseases}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-xl border px-3 py-2 bg-muted/40">
          <Clock className="size-4 text-primary" />
          <span className="font-mono text-lg tabular-nums tracking-tight">{fmtTime(elapsed)}</span>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => setRunning((r) => !r)} title={running ? "Pause" : "Resume"}>
            {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={resetTimer} title="Reset">
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Vitals */}
      <div>
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Vitals</Label>
        <div className="grid grid-cols-5 gap-2 mt-1.5">
          <VitalInput label="BP" value={vitals.bp} onChange={(v) => setVitals({ ...vitals, bp: v })} placeholder="120/80" />
          <VitalInput label="Pulse" value={vitals.pulse} onChange={(v) => setVitals({ ...vitals, pulse: v })} placeholder="72" />
          <VitalInput label="Temp" value={vitals.temp} onChange={(v) => setVitals({ ...vitals, temp: v })} placeholder="98.6" />
          <VitalInput label="SpO₂" value={vitals.spo2} onChange={(v) => setVitals({ ...vitals, spo2: v })} placeholder="98" />
          <VitalInput label="Wt" value={vitals.weight} onChange={(v) => setVitals({ ...vitals, weight: v })} placeholder="kg" />
        </div>
      </div>

      {/* Clinical fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FieldArea label="Chief complaints" value={chief} onChange={setChief} rows={2} />
        <FieldArea label="Clinical findings" value={findings} onChange={setFindings} rows={2} />
        <FieldArea label="Diagnosis" value={diagnosis} onChange={setDiagnosis} rows={2} />
        <FieldArea label="Notes / advice" value={notes} onChange={setNotes} rows={2} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up date</Label>
          <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>

      {/* Rx */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Prescription</Label>
          <Button size="sm" variant="ghost" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}><Plus className="size-3.5 mr-1" />Add medicine</Button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border p-2.5 grid grid-cols-12 gap-2 items-center">
              <Input value={it.medicine_name} onChange={(e) => updateItem(i, "medicine_name", e.target.value)} placeholder="Medicine name" className="h-9 text-sm col-span-5" />
              <Input value={it.dosage} onChange={(e) => updateItem(i, "dosage", e.target.value)} placeholder="1-0-1" className="h-9 text-sm col-span-2" />
              <Input value={it.food_instruction} onChange={(e) => updateItem(i, "food_instruction", e.target.value)} placeholder="After food" className="h-9 text-sm col-span-3" />
              <Input value={it.duration_days} onChange={(e) => updateItem(i, "duration_days", e.target.value)} placeholder="Days" type="number" className="h-9 text-sm col-span-1" />
              <Button variant="ghost" size="icon" className="size-9 col-span-1 justify-self-end" onClick={() => setItems(items.filter((_, x) => x !== i))}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t">
        <Button asChild variant="ghost" size="sm">
          <Link to="/opd/$appointmentId" params={{ appointmentId: appt.id }}>
            <ExternalLink className="size-3.5 mr-1.5" />Open full screen
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => save({ print: true })} disabled={saving}>
            <Printer className="size-4 mr-2" />Save & print
          </Button>
          <Button onClick={() => save()} disabled={saving}>
            <Save className="size-4 mr-2" />Save consultation
          </Button>
        </div>
      </div>
    </Card>
  );
}

function VitalInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 text-sm" />
    </div>
  );
}
function FieldArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="resize-none" />
    </div>
  );
}
