import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPatientBillingSummary } from "@/lib/billing-aggregator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, LogOut, Plus, Trash2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

type MedRow = {
  id: string;
  medicine_name: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
};

const CONDITIONS = ["Stable", "Improved", "Referred", "Against Medical Advice (LAMA)", "Expired"];

export function DischargeDialog({ admission }: { admission: any }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const id = admission.id;

  const [dischargeAt, setDischargeAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [condition, setCondition] = useState("Stable");
  const [primaryDx, setPrimaryDx] = useState("");
  const [secondaryDx, setSecondaryDx] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpInstr, setFollowUpInstr] = useState("");
  const [doctorNotes, setDoctorNotes] = useState("");
  const [meds, setMeds] = useState<MedRow[]>([]);
  const hydrated = useRef(false);

  const { data: existing } = useQuery({
    queryKey: ["discharge-existing", id],
    enabled: open,
    queryFn: async () => {
      const { data: ds } = await supabase.from("discharge_summaries").select("*").eq("admission_id", id).maybeSingle();
      if (!ds) return null;
      const { data: dm } = await supabase.from("discharge_medications").select("*").eq("discharge_id", ds.id).order("position");
      return { ds, meds: dm ?? [] };
    },
  });

  const { data: billing, refetch: refetchBilling } = useQuery({
    queryKey: ["discharge-billing", admission.patient_id],
    enabled: open,
    queryFn: () => getPatientBillingSummary(admission.patient_id),
  });

  const totals = billing?.totals ?? { total: 0, paid: 0, pending: 0, discount: 0 };
  const cleared = totals.pending <= 0.01;

  // hydrate from existing
  useEffect(() => {
    if (!open) { hydrated.current = false; return; }
    if (!existing || hydrated.current) return;
    hydrated.current = true;
    const ds: any = existing.ds;
    if (ds.discharge_date) setDischargeAt(format(new Date(ds.discharge_date), "yyyy-MM-dd'T'HH:mm"));
    setCondition(ds.condition_at_discharge ?? "Stable");
    setPrimaryDx(ds.final_diagnosis ?? "");
    setSecondaryDx(ds.procedures_performed ?? "");
    setFollowUpDate(ds.follow_up_date ?? "");
    setFollowUpInstr(ds.follow_up_instructions ?? "");
    setDoctorNotes(ds.advice ?? "");
    setMeds((existing.meds ?? []).map((m: any) => {
      // legacy rows encoded route/freq in instructions as "route · freq — instr"
      const raw = m.instructions ?? "";
      const mm = raw.match(/^([^·]*)·\s*([^—]+?)\s*(?:—\s*(.*))?$/);
      return {
        id: m.id,
        medicine_name: m.medicine_name,
        dose: m.dosage ?? "",
        route: mm?.[1]?.trim() ?? "",
        frequency: mm?.[2]?.trim() ?? "",
        duration: m.duration ?? "",
        instructions: mm ? (mm[3] ?? "") : raw,
      };
    }));
  }, [open, existing]);

  const autofill = async () => {
    try {
      const [rounds, surgeries, mar] = await Promise.all([
        supabase.from("doctor_rounds").select("progress_notes, updated_diagnosis, follow_up_orders").eq("admission_id", id),
        supabase.from("surgeries").select("procedure_name").eq("patient_id", admission.patient_id),
        supabase.from("medication_administration").select("medicine_name, dosage, route").eq("admission_id", id).eq("status", "administered"),
      ]);
      const dx = (rounds.data ?? []).map((r: any) => r.updated_diagnosis).filter(Boolean).join("\n");
      if (dx && !primaryDx) setPrimaryDx(dx);
      const proc = (surgeries.data ?? []).map((s: any) => s.procedure_name).filter(Boolean).join(", ");
      if (proc && !secondaryDx) setSecondaryDx(proc);
      const fu = (rounds.data ?? []).map((r: any) => r.follow_up_orders).filter(Boolean).join("\n");
      if (fu && !followUpInstr) setFollowUpInstr(fu);
      if (meds.length === 0) {
        const seen = new Set<string>();
        const rows: MedRow[] = [];
        (mar.data ?? []).forEach((m: any) => {
          const k = m.medicine_name?.toLowerCase(); if (!k || seen.has(k)) return; seen.add(k);
          rows.push({ id: crypto.randomUUID(), medicine_name: m.medicine_name, dose: m.dosage ?? "", route: m.route ?? "", frequency: "", duration: "", instructions: "" });
        });
        if (rows.length) setMeds(rows);
      }
      toast.success("Auto-filled from records");
    } catch (e: any) { toast.error(e.message); }
  };

  const buildPayload = () => ({
    admission_id: id,
    discharge_date: new Date(dischargeAt).toISOString(),
    condition_at_discharge: condition || null,
    final_diagnosis: primaryDx || null,
    procedures_performed: secondaryDx || null,
    hospital_course: doctorNotes || null,
    follow_up_date: followUpDate || null,
    follow_up_instructions: followUpInstr || null,
    advice: doctorNotes || null,
    created_by: user?.id ?? null,
  });

  const persist = async () => {
    const payload = buildPayload();
    let dsId: string;
    if (existing?.ds?.id) {
      const { error } = await supabase.from("discharge_summaries").update(payload).eq("id", existing.ds.id);
      if (error) throw error;
      dsId = existing.ds.id;
      await supabase.from("discharge_medications").delete().eq("discharge_id", dsId);
    } else {
      const { data, error } = await supabase.from("discharge_summaries").insert(payload).select("id").single();
      if (error) throw error;
      dsId = data.id;
    }
    if (meds.length) {
      const rows = meds.filter((m) => m.medicine_name.trim()).map((m, idx) => ({
        discharge_id: dsId,
        medicine_name: m.medicine_name.trim(),
        dosage: m.dose || null,
        duration: m.duration || null,
        instructions: [m.route, m.frequency].filter(Boolean).join(" · ") + (m.instructions ? ` — ${m.instructions}` : "") || null,
        position: idx,
      }));
      if (rows.length) {
        const { error } = await supabase.from("discharge_medications").insert(rows);
        if (error) throw error;
      }
    }
    return dsId;
  };

  const saveDraft = useMutation({
    mutationFn: persist,
    onSuccess: () => { toast.success("Draft saved"); qc.invalidateQueries({ queryKey: ["discharge-existing", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmDischarge = useMutation({
    mutationFn: async () => {
      if (!cleared) throw new Error(`Pending bills ₹${totals.pending.toLocaleString("en-IN")} must be cleared before discharge`);
      const dsId = await persist();
      const { error } = await supabase.from("admissions").update({
        status: "discharged",
        discharged_at: new Date(dischargeAt).toISOString(),
      }).eq("id", id);
      if (error) throw error;
      if (admission.bed_id) {
        await supabase.from("beds").update({ status: "available" }).eq("id", admission.bed_id);
      }
      return dsId;
    },
    onSuccess: (dsId) => {
      toast.success("Patient discharged");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admission", id] });
      window.open(`/discharge/${dsId}/print`, "_blank");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMed = () => setMeds([...meds, { id: crypto.randomUUID(), medicine_name: "", dose: "", route: "", frequency: "", duration: "", instructions: "" }]);
  const updateMed = (rid: string, patch: Partial<MedRow>) => setMeds(meds.map((m) => m.id === rid ? { ...m, ...patch } : m));
  const removeMed = (rid: string) => setMeds(meds.filter((m) => m.id !== rid));

  const summaryFields = useMemo(() => ([
    ["Name", admission.patients?.full_name ?? "—"],
    ["UHID", admission.patients?.uhid ?? "—"],
    ["Admission No.", admission.admission_no ?? "—"],
    ["Admitted on", admission.admitted_at ? format(new Date(admission.admitted_at), "dd MMM yyyy, p") : "—"],
    ["Treating Doctor", admission.doctors?.name ? `Dr. ${admission.doctors.name}` : "—"],
    ["Ward / Bed", `${admission.wards?.name ?? "—"} · Bed ${admission.beds?.bed_number ?? "—"}`],
  ] as [string, string][]), [admission]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) refetchBilling(); }}>
      <DialogTrigger asChild>
        <Button variant="default"><LogOut className="size-4 mr-2" />Discharge</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Discharge — {admission.patients?.full_name ?? "—"}</DialogTitle>
        </DialogHeader>

        {/* Patient summary */}
        <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
          {summaryFields.map(([k, v]) => (
            <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="font-medium">{v || "—"}</span></div>
          ))}
        </div>

        {/* Bill verification */}
        <div className={`rounded-lg border p-3 text-sm flex items-start gap-3 ${cleared ? "border-emerald-300 bg-emerald-50/60" : "border-amber-300 bg-amber-50/60"}`}>
          {cleared ? <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />}
          <div className="flex-1">
            <div className="font-medium">
              Total ₹{totals.total.toLocaleString("en-IN")} · Paid ₹{totals.paid.toLocaleString("en-IN")} · Pending ₹{totals.pending.toLocaleString("en-IN")}
            </div>
            <div className={`text-xs mt-0.5 ${cleared ? "text-emerald-700" : "text-amber-700"}`}>
              {cleared ? "✅ All bills cleared" : `⚠️ Bills pending: ₹${totals.pending.toLocaleString("en-IN")}. Please clear before discharge.`}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={autofill}><Sparkles className="size-4 mr-1.5" />Auto-fill</Button>
        </div>

        {/* Discharge details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Discharge Date & Time</Label>
            <Input type="datetime-local" value={dischargeAt} onChange={(e) => setDischargeAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Discharge Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2"><Label>Primary Diagnosis</Label><Textarea rows={2} value={primaryDx} onChange={(e) => setPrimaryDx(e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Secondary Diagnosis <span className="text-muted-foreground">(optional)</span></Label><Textarea rows={2} value={secondaryDx} onChange={(e) => setSecondaryDx(e.target.value)} /></div>
          <div className="space-y-1"><Label>Follow-up date</Label><Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Follow-up instructions</Label><Textarea rows={2} value={followUpInstr} onChange={(e) => setFollowUpInstr(e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Doctor's notes</Label><Textarea rows={3} value={doctorNotes} onChange={(e) => setDoctorNotes(e.target.value)} /></div>
        </div>

        {/* Discharge prescription */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Discharge Prescription</Label>
            <Button variant="outline" size="sm" onClick={addMed}><Plus className="size-3.5 mr-1" />Add medicine row</Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left p-2 font-medium">Medicine</th>
                  <th className="text-left p-2 font-medium">Dose</th>
                  <th className="text-left p-2 font-medium">Route</th>
                  <th className="text-left p-2 font-medium">Frequency</th>
                  <th className="text-left p-2 font-medium">Duration</th>
                  <th className="text-left p-2 font-medium">Instructions</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {meds.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground p-4">No medicines added</td></tr>}
                {meds.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-1"><Input className="h-8" value={m.medicine_name} onChange={(e) => updateMed(m.id, { medicine_name: e.target.value })} /></td>
                    <td className="p-1"><Input className="h-8" value={m.dose} onChange={(e) => updateMed(m.id, { dose: e.target.value })} /></td>
                    <td className="p-1"><Input className="h-8" value={m.route} onChange={(e) => updateMed(m.id, { route: e.target.value })} placeholder="PO/IV" /></td>
                    <td className="p-1"><Input className="h-8" value={m.frequency} onChange={(e) => updateMed(m.id, { frequency: e.target.value })} placeholder="BD/TDS" /></td>
                    <td className="p-1"><Input className="h-8" value={m.duration} onChange={(e) => updateMed(m.id, { duration: e.target.value })} /></td>
                    <td className="p-1"><Input className="h-8" value={m.instructions} onChange={(e) => updateMed(m.id, { instructions: e.target.value })} /></td>
                    <td className="p-1 text-center"><Button size="icon" variant="ghost" onClick={() => removeMed(m.id)}><Trash2 className="size-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="outline" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
            {saveDraft.isPending ? "Saving…" : "Save Draft"}
          </Button>
          <Button onClick={() => confirmDischarge.mutate()} disabled={confirmDischarge.isPending || !cleared}>
            <LogOut className="size-4 mr-2" />
            {confirmDischarge.isPending ? "Discharging…" : "Confirm Discharge + Generate Summary"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
