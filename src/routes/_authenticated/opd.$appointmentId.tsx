import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Save, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/opd/$appointmentId")({ component: Consultation });

interface RxItem { medicine_name: string; dosage: string; timing: string; food_instruction: string; duration_days: string; }
const EMPTY_ITEM: RxItem = { medicine_name: "", dosage: "", timing: "", food_instruction: "After food", duration_days: "5" };

function Consultation() {
  const { appointmentId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: appt } = useQuery({
    queryKey: ["appt", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments")
        .select("id, scheduled_at, status, token_no, patient_id, doctor_id, patients(*), doctors(name, specialization)")
        .eq("id", appointmentId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["patient-history", appt?.patient_id],
    queryFn: async () => {
      const { data } = await supabase.from("opd_visits").select("id, diagnosis, created_at, doctors(name)").eq("patient_id", appt!.patient_id).order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
    enabled: !!appt?.patient_id,
  });

  // form state
  const [chief, setChief] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [findings, setFindings] = useState("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [vitals, setVitals] = useState({ bp: "", pulse: "", temp: "", spo2: "", weight: "" });
  const [items, setItems] = useState<RxItem[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef(Date.now());

  const { data: existingVisit } = useQuery({
    queryKey: ["opd-consult-existing-visit", appointmentId],
    enabled: !!appt?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("opd_visits")
        .select("id, chief_complaints, diagnosis, clinical_findings, notes, follow_up_date, vitals, prescriptions(id, prescription_items(id, medicine_name, dosage, timing, food_instruction, duration_days, position))")
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    if (!appt?.id || (appt as any).status === "in_consultation" || (appt as any).status === "completed") return;
    supabase.from("appointments").update({ status: "in_consultation" as any }).eq("id", appt.id);
    qc.invalidateQueries({ queryKey: ["opd-consult-queue"] });
  }, [appt?.id]); // eslint-disable-line

  useEffect(() => {
    if (!existingVisit) return;
    setChief(existingVisit.chief_complaints ?? "");
    setDiagnosis(existingVisit.diagnosis ?? "");
    setFindings(existingVisit.clinical_findings ?? "");
    setNotes((existingVisit.notes ?? "").replace(/\n?\[Consultation duration: .*? min\]$/m, ""));
    setFollowUp(existingVisit.follow_up_date ?? "");
    setVitals({ bp: "", pulse: "", temp: "", spo2: "", weight: "", ...(existingVisit.vitals ?? {}) });
    const rxItems = existingVisit.prescriptions?.[0]?.prescription_items ?? [];
    if (rxItems.length) {
      setItems(rxItems.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)).map((it: any) => ({
        medicine_name: it.medicine_name ?? "",
        dosage: it.dosage ?? "",
        timing: it.timing ?? "",
        food_instruction: it.food_instruction ?? "After food",
        duration_days: it.duration_days ? String(it.duration_days) : "",
      })));
    }
  }, [existingVisit]);

  async function save(opts: { print?: boolean } = {}) {
    if (!appt) return;
    setSaving(true);
    try {
      const durationMin = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60000));
      const visitPayload = {
        patient_id: appt.patient_id,
        doctor_id: appt.doctor_id,
        appointment_id: appt.id,
        chief_complaints: chief || null,
        diagnosis: diagnosis || null,
        clinical_findings: findings || null,
        notes: `${notes}${notes ? "\n\n" : ""}[Consultation duration: ${durationMin} min]`,
        follow_up_date: followUp || null,
        vitals,
        created_by: user?.id,
      };

      let visitId = existingVisit?.id as string | undefined;
      if (!visitId) {
        const { data: currentVisit, error: currentVisitError } = await supabase
          .from("opd_visits")
          .select("id")
          .eq("appointment_id", appt.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (currentVisitError) throw currentVisitError;
        visitId = currentVisit?.id;
      }
      if (visitId) {
        const { error } = await supabase.from("opd_visits").update(visitPayload).eq("id", visitId);
        if (error) throw error;
      } else {
        const { data: visit, error } = await supabase.from("opd_visits").insert(visitPayload).select("id").single();
        if (error) throw error;
        visitId = visit.id;
      }

      let { data: rx, error: e2 } = await supabase.from("prescriptions").select("id").eq("opd_visit_id", visitId).maybeSingle();
      if (e2) throw e2;
      if (!rx) {
        const created = await supabase.from("prescriptions").insert({ opd_visit_id: visitId }).select("id").single();
        if (created.error) throw created.error;
        rx = created.data;
      }

      const validItems = items.filter((i) => i.medicine_name.trim());
      await supabase.from("prescription_items").delete().eq("prescription_id", rx.id);
      if (validItems.length) {
        const { error: e3 } = await supabase.from("prescription_items").insert(validItems.map((it, idx) => ({
          prescription_id: rx.id,
          medicine_name: it.medicine_name,
          dosage: it.dosage,
          timing: it.timing,
          food_instruction: it.food_instruction,
          duration_days: it.duration_days ? Number(it.duration_days) : null,
          position: idx,
        })));
        if (e3) throw e3;
      }

      const { error: apptError } = await supabase.from("appointments").update({ status: "completed" as any }).eq("id", appt.id);
      if (apptError) throw apptError;
      qc.invalidateQueries();
      toast.success("Consultation saved");

      if (opts.print) {
        window.open(`/prescriptions/${rx.id}/print`, "_blank");
      } else {
        navigate({ to: "/opd" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!appt) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/opd"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">{(appt as any).patients?.full_name} <span className="text-sm text-muted-foreground font-mono ml-1">{(appt as any).patients?.uhid}</span></h1>
          <p className="text-xs text-muted-foreground">{(appt as any).doctors?.name} · token {(appt as any).token_no ?? "—"} · {format(new Date(appt.scheduled_at), "dd MMM yyyy HH:mm")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: history */}
        <Card className="p-5 xl:col-span-3">
          <h2 className="font-semibold mb-3 text-sm">Patient timeline</h2>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No previous visits.</p>
          ) : (
            <div className="space-y-3">
              {history.map((v: any) => (
                <div key={v.id} className="text-xs border-l-2 border-primary/30 pl-3 py-1">
                  <div className="text-muted-foreground">{format(new Date(v.created_at), "dd MMM yyyy")}</div>
                  <div className="font-medium">{v.diagnosis || "Consultation"}</div>
                  <div className="text-muted-foreground">{v.doctors?.name}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-4 border-t space-y-1.5 text-xs">
            <div><span className="text-muted-foreground">Allergies:</span> {(appt as any).patients?.allergies || "—"}</div>
            <div><span className="text-muted-foreground">Chronic:</span> {(appt as any).patients?.chronic_diseases || "—"}</div>
            <div><span className="text-muted-foreground">Blood:</span> {(appt as any).patients?.blood_group || "—"}</div>
          </div>
        </Card>

        {/* Center: consultation */}
        <Card className="p-5 xl:col-span-5 space-y-4">
          <h2 className="font-semibold text-sm">Consultation</h2>

          <div className="grid grid-cols-5 gap-2">
            <VitalInput label="BP" value={vitals.bp} onChange={(v) => setVitals({ ...vitals, bp: v })} placeholder="120/80" />
            <VitalInput label="Pulse" value={vitals.pulse} onChange={(v) => setVitals({ ...vitals, pulse: v })} placeholder="72" />
            <VitalInput label="Temp" value={vitals.temp} onChange={(v) => setVitals({ ...vitals, temp: v })} placeholder="98.6" />
            <VitalInput label="SpO₂" value={vitals.spo2} onChange={(v) => setVitals({ ...vitals, spo2: v })} placeholder="98" />
            <VitalInput label="Wt" value={vitals.weight} onChange={(v) => setVitals({ ...vitals, weight: v })} placeholder="kg" />
          </div>

          <div className="space-y-3">
            <FieldArea label="Chief complaints" value={chief} onChange={setChief} rows={2} />
            <FieldArea label="Clinical findings" value={findings} onChange={setFindings} rows={2} />
            <FieldArea label="Diagnosis" value={diagnosis} onChange={setDiagnosis} rows={2} />
            <FieldArea label="Notes / advice" value={notes} onChange={setNotes} rows={2} />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up date</Label>
              <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
        </Card>

        {/* Right: prescription */}
        <Card className="p-5 xl:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Prescription</h2>
            <Button size="sm" variant="ghost" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}><Plus className="size-3.5 mr-1" />Add</Button>
          </div>
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border p-3 space-y-2 bg-surface-muted/40">
                <div className="flex gap-2">
                  <Input value={it.medicine_name} onChange={(e) => updateItem(i, "medicine_name", e.target.value)} placeholder="Medicine name" className="h-9 text-sm" />
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setItems(items.filter((_, x) => x !== i))}><Trash2 className="size-3.5" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={it.dosage} onChange={(e) => updateItem(i, "dosage", e.target.value)} placeholder="1-0-1" className="h-9 text-sm" />
                  <Input value={it.duration_days} onChange={(e) => updateItem(i, "duration_days", e.target.value)} placeholder="Days" className="h-9 text-sm" type="number" />
                </div>
                <Input value={it.food_instruction} onChange={(e) => updateItem(i, "food_instruction", e.target.value)} placeholder="After food" className="h-9 text-sm" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-background/95 backdrop-blur border-t flex items-center justify-end gap-2">
        <Button variant="ghost" asChild><Link to="/opd">Cancel</Link></Button>
        <Button variant="outline" onClick={() => save({ print: true })} disabled={saving}><Printer className="size-4 mr-2" />Save & print</Button>
        <Button onClick={() => save()} disabled={saving} size="lg"><Save className="size-4 mr-2" />Save consultation</Button>
      </div>
    </div>
  );

  function updateItem(i: number, k: keyof RxItem, v: string) {
    setItems(items.map((it, x) => x === i ? { ...it, [k]: v } : it));
  }
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
