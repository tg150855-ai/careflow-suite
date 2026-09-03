import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, Sparkles, Share2, Download, AlertTriangle, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getPatientBillingSummary } from "@/lib/billing-aggregator";
import { DictateTextarea, MicButton } from "@/components/dictate-textarea";
import { archiveDischargeDocument } from "@/lib/discharge-doc";
import { DischargeTemplateSelector, DischargeTemplateApplyPayload } from "@/components/ipd/discharge-template-selector";

export const Route = createFileRoute("/_authenticated/ipd/$id/discharge")({ component: DischargeForm });

type Med = { id: string; medicine_name: string; dosage: string; duration: string; instructions: string };


function DischargeForm() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: adm } = useQuery({
    queryKey: ["adm-discharge", id],
    queryFn: async () => (await supabase.from("admissions").select("*, patients(*), doctors(name)").eq("id", id).single()).data,
  });
  const { data: bills = [] } = useQuery({
    queryKey: ["adm-bills", id, adm?.patient_id],
    enabled: !!adm,
    queryFn: async () => (await supabase.from("bills").select("id, bill_no, total, paid, pending, status").eq("patient_id", adm!.patient_id)).data ?? [],
  });
  const { data: billingSummary } = useQuery({
    queryKey: ["billing-summary-discharge", adm?.patient_id],
    enabled: !!adm?.patient_id,
    queryFn: () => getPatientBillingSummary(adm!.patient_id),
    refetchOnWindowFocus: true,
  });

  // Load existing discharge summary (edit mode)
  const { data: existing, isFetched: existingFetched } = useQuery({
    queryKey: ["discharge-existing", id],
    queryFn: async () => {
      const { data: ds } = await supabase.from("discharge_summaries").select("*").eq("admission_id", id).maybeSingle();
      if (!ds) return null;
      const { data: meds } = await supabase.from("discharge_medications").select("*").eq("discharge_id", ds.id).order("position");
      return { ds, meds: meds ?? [] };
    },
  });

  const [finalDx, setFinalDx] = useState("");
  const [procedures, setProcedures] = useState("");
  const [course, setCourse] = useState("");
  const [condition, setCondition] = useState("Stable");
  const [advice, setAdvice] = useState("");
  const [followUpInstr, setFollowUpInstr] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [meds, setMeds] = useState<Med[]>([]);
  const hydratedRef = useRef(false);

  const pendingTotal = bills.reduce((s: number, b: any) => s + Number(b.pending), 0);

  // Hydrate from existing discharge summary
  useEffect(() => {
    if (!existing || hydratedRef.current) return;
    hydratedRef.current = true;
    const ds: any = existing.ds;
    setFinalDx(ds.final_diagnosis ?? "");
    setProcedures(ds.procedures_performed ?? "");
    setCourse(ds.hospital_course ?? "");
    setCondition(ds.condition_at_discharge ?? "Stable");
    setAdvice(ds.advice ?? "");
    setFollowUpInstr(ds.follow_up_instructions ?? "");
    setFollowUpDate(ds.follow_up_date ?? "");
    setMeds((existing.meds ?? []).map((m: any) => ({
      id: m.id, medicine_name: m.medicine_name, dosage: m.dosage ?? "", duration: m.duration ?? "", instructions: m.instructions ?? "",
    })));
  }, [existing]);

  const autofill = useMutation({
    mutationFn: async () => {
      if (!adm) throw new Error("Loading…");
      const [rounds, surgeries, labs, prescriptions, radiology, nursing, vitals] = await Promise.all([
        supabase.from("doctor_rounds").select("progress_notes, updated_diagnosis, follow_up_orders, clinical_findings, rounded_at").eq("admission_id", id).order("rounded_at"),
        supabase.from("surgeries").select("procedure_name, performed_at, notes").eq("patient_id", adm.patient_id).order("performed_at"),
        supabase.from("lab_orders").select("order_no, lab_results(test_name, result_value, unit, flag)").or(`admission_id.eq.${id},patient_id.eq.${adm.patient_id}`),
        supabase.from("prescriptions").select("id, created_at, opd_visit_id, prescription_items(medicine_name, dosage, timing, food_instruction, duration_days)").eq("opd_visit_id", "00000000-0000-0000-0000-000000000000"),
        (supabase as any).from("radiology_orders").select("test_name, created_at, radiology_reports(impression)").eq("patient_id", adm.patient_id).order("created_at"),
        (supabase as any).from("nursing_notes").select("note, created_at").eq("admission_id", id).order("created_at"),
        (supabase as any).from("vitals").select("*").eq("admission_id", id).order("recorded_at", { ascending: false }).limit(1),
      ]);

      const dxFromRounds = (rounds.data ?? []).map((r: any) => r.updated_diagnosis).filter(Boolean).join("\n");
      if (dxFromRounds && !finalDx) setFinalDx(dxFromRounds);

      const procText = (surgeries.data ?? []).map((s: any) => `${s.procedure_name}${s.performed_at ? " (" + new Date(s.performed_at).toLocaleDateString() + ")" : ""}`).join("\n");
      if (procText && !procedures) setProcedures(procText);

      const courseText = (rounds.data ?? []).map((r: any) => `${new Date(r.rounded_at).toLocaleDateString()}: ${r.progress_notes ?? r.clinical_findings ?? ""}`).filter((x: string) => x.trim().length > 12).join("\n");
      const abnormal = (labs.data ?? []).flatMap((o: any) => (o.lab_results ?? []).filter((r: any) => r.flag).map((r: any) => `${r.test_name}: ${r.result_value} ${r.unit ?? ""} [${r.flag}]`)).slice(0, 8).join("\n");
      const imaging = ((radiology.data ?? []) as any[])
        .map((o: any) => {
          const imp = (o.radiology_reports ?? []).map((r: any) => r.impression).filter(Boolean).join("; ");
          return imp ? `${o.test_name}: ${imp}` : "";
        })
        .filter(Boolean).slice(0, 6).join("\n");
      const nursingText = ((nursing.data ?? []) as any[]).map((n: any) => n.note).filter(Boolean).slice(-5).join("\n");
      const v = ((vitals.data ?? []) as any[])[0];
      const vitalsLine = v
        ? ["BP " + [v.bp_systolic, v.bp_diastolic].filter(Boolean).join("/"), v.pulse && `Pulse ${v.pulse}`, v.temperature && `Temp ${v.temperature}`, v.spo2 && `SpO2 ${v.spo2}%`]
            .filter((x: any) => x && String(x).trim() && x !== "BP ").join(" · ")
        : "";
      const merged = [
        courseText,
        vitalsLine && `\nLatest vitals: ${vitalsLine}`,
        abnormal && `\nNotable labs:\n${abnormal}`,
        imaging && `\nImaging:\n${imaging}`,
        nursingText && `\nNursing notes:\n${nursingText}`,
      ].filter(Boolean).join("");
      if (merged && !course) setCourse(merged);


      const followUp = (rounds.data ?? []).map((r: any) => r.follow_up_orders).filter(Boolean).join("\n");
      if (followUp && !followUpInstr) setFollowUpInstr(followUp);

      const { data: mar } = await supabase.from("medication_administration").select("medicine_name, dosage, route").eq("admission_id", id).eq("status", "administered");
      const seen = new Set<string>();
      const medRows: Med[] = [];
      (prescriptions.data ?? []).flatMap((p: any) => p.prescription_items ?? []).forEach((it: any) => {
        const k = it.medicine_name?.toLowerCase(); if (!k || seen.has(k)) return;
        seen.add(k);
        medRows.push({ id: crypto.randomUUID(), medicine_name: it.medicine_name, dosage: it.dosage ?? "", duration: it.duration_days ? `${it.duration_days} days` : "", instructions: [it.timing, it.food_instruction].filter(Boolean).join(", ") });
      });
      (mar ?? []).forEach((m: any) => {
        const k = m.medicine_name?.toLowerCase(); if (!k || seen.has(k)) return;
        seen.add(k);
        medRows.push({ id: crypto.randomUUID(), medicine_name: m.medicine_name, dosage: m.dosage ?? "", duration: "", instructions: m.route ?? "" });
      });
      if (medRows.length && meds.length === 0) setMeds(medRows);
    },
    onSuccess: () => toast.success("Discharge summary populated from records"),
    onError: (e: any) => toast.error(e.message),
  });

  const handleApplyTemplate = (data: DischargeTemplateApplyPayload) => {
    setFinalDx(data.primary_diagnosis || "");
    if (data.secondary_diagnosis) setProcedures(data.secondary_diagnosis);
    if (data.doctor_notes) setAdvice(data.doctor_notes);
    if (data.hospital_course) setCourse(data.hospital_course);
    if (data.follow_up_instructions) setFollowUpInstr(data.follow_up_instructions);
    if (data.follow_up_date) setFollowUpDate(data.follow_up_date);
    if (data.condition_at_discharge) setCondition(data.condition_at_discharge);
    if (data.medicines && data.medicines.length > 0) {
      setMeds(
        data.medicines.map((m) => ({
          id: m.id || crypto.randomUUID(),
          medicine_name: m.medicine_name,
          dosage: m.dose || m.dosage || "",
          duration: m.duration || "",
          instructions: [m.route, m.frequency, m.instructions].filter(Boolean).join(" · ") || (m.instructions || ""),
        }))
      );
    }
  };

  // Auto-fill once on mount when no existing summary
  const autoTriedRef = useRef(false);
  useEffect(() => {
    if (autoTriedRef.current) return;
    if (!adm || !existingFetched) return;
    if (existing) return; // don't overwrite edit-mode
    autoTriedRef.current = true;
    autofill.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adm, existingFetched, existing]);

  // ---- local auto-save (browser crash / accidental close protection) ----
  const LOCAL_KEY = `sbg.discharge.draft.${id}`;
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !existingFetched || existing) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      setFinalDx((v) => v || d.finalDx || "");
      setProcedures((v) => v || d.procedures || "");
      setCourse((v) => v || d.course || "");
      setCondition((v) => (v && v !== "Stable" ? v : d.condition || "Stable"));
      setAdvice((v) => v || d.advice || "");
      setFollowUpInstr((v) => v || d.followUpInstr || "");
      setFollowUpDate((v) => v || d.followUpDate || "");
      if (Array.isArray(d.meds) && d.meds.length) setMeds((m) => (m.length ? m : d.meds));
      toast.info("Unsaved draft restored from this browser");
    } catch { /* ignore */ }
  }, [existingFetched, existing, LOCAL_KEY]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify({ finalDx, procedures, course, condition, advice, followUpInstr, followUpDate, meds }));
      } catch { /* ignore */ }
    }, 2000);
    return () => clearTimeout(t);
  }, [finalDx, procedures, course, condition, advice, followUpInstr, followUpDate, meds, LOCAL_KEY]);

  const [savedId, setSavedId] = useState<string | null>(null);
  const [finalised, setFinalised] = useState(false);

  const save = useMutation({
    mutationFn: async ({ draft }: { draft: boolean }) => {
      const dsIdExisting = savedId ?? existing?.ds?.id ?? null;
      const payload = {
        admission_id: id,
        final_diagnosis: finalDx || null, procedures_performed: procedures || null,
        hospital_course: course || null, condition_at_discharge: condition || null,
        follow_up_instructions: followUpInstr || null, follow_up_date: followUpDate || null,
        advice: advice || null, created_by: user?.id ?? null, is_draft: draft,
      } as any;
      let dsId: string;
      if (dsIdExisting) {
        const { error } = await supabase.from("discharge_summaries").update(payload).eq("id", dsIdExisting);
        if (error) throw error;
        dsId = dsIdExisting;
        await supabase.from("discharge_medications").delete().eq("discharge_id", dsId);
      } else {
        const { data: ds, error } = await supabase.from("discharge_summaries").insert(payload).select("id").single();
        if (error) throw error;
        dsId = ds.id;
      }
      if (meds.length > 0) {
        const { error: e2 } = await supabase.from("discharge_medications").insert(meds.filter((m) => m.medicine_name.trim()).map((m, idx) => ({
          discharge_id: dsId, medicine_name: m.medicine_name, dosage: m.dosage || null,
          duration: m.duration || null, instructions: m.instructions || null, position: idx,
        })));
        if (e2) throw e2;
      }
      if (!draft) {
        if (adm?.status !== "discharged") {
          await supabase.from("admissions").update({ status: "discharged", discharged_at: new Date().toISOString() }).eq("id", id);
          if (adm?.bed_id) await supabase.from("beds").update({ status: "cleaning" }).eq("id", adm.bed_id);
        }
        // File the summary under the patient's documents so it appears in
        // Document Management / patient history automatically.
        try {
          await archiveDischargeDocument({
            patientId: adm!.patient_id,
            admissionNo: adm?.admission_no,
            patientName: (adm as any)?.patients?.full_name,
            uhid: (adm as any)?.patients?.uhid,
            doctorName: (adm as any)?.doctors?.name,
            dischargeId: dsId,
            fields: {
              "Final diagnosis": finalDx, "Procedures performed": procedures, "Hospital course": course,
              "Condition at discharge": condition, "Follow-up instructions": followUpInstr,
              "Follow-up date": followUpDate, "Advice on discharge": advice,
            },
            meds,
            uploadedBy: user?.id ?? null,
            uploadedByName: user?.email ?? null,
          });
        } catch (e: any) {
          toast.warning(`Summary saved, but filing to patient documents failed: ${e.message ?? e}`);
        }
      }
      return { id: dsId, draft };
    },
    onSuccess: ({ id: dsId, draft }) => {
      setSavedId(dsId);
      if (draft) { toast.success("Draft saved"); return; }
      setFinalised(true);
      try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
      toast.success("Discharge summary generated");
      navigate({ to: "/discharge/$id/print", params: { id: dsId } });
    },
    onError: (e: any) => toast.error(e.message),
  });


  if (!adm) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const shareWhatsApp = () => {
    const lines = [
      `*Discharge summary* — ${adm.patients?.full_name} (${adm.patients?.uhid})`,
      `Admission: ${adm.admission_no} · Dr. ${adm.doctors?.name}`,
      finalDx && `Diagnosis: ${finalDx}`,
      procedures && `Procedures: ${procedures}`,
      followUpInstr && `Follow-up: ${followUpInstr}`,
      followUpDate && `Follow-up on: ${followUpDate}`,
      meds.length && `Medicines: ${meds.map((m) => `${m.medicine_name} ${m.dosage}`.trim()).join(", ")}`,
    ].filter(Boolean).join("\n");
    const phone = (adm.patients?.mobile ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, "_blank");
  };

  const isEdit = !!existing?.ds?.id;
  const isFinalised = finalised || (!!existing?.ds?.id && !(existing?.ds as any)?.is_draft);


  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="icon"><Link to="/ipd/$id" params={{ id }}><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? "Edit discharge summary" : "Discharge"} — {adm.patients?.full_name}</h1>
          <p className="text-sm text-muted-foreground">{adm.admission_no} · Treating: Dr. {adm.doctors?.name}{isEdit ? " · Editing existing summary" : " · Auto-filled from records"}</p>
        </div>
        <Button variant="outline" onClick={() => autofill.mutate()} disabled={autofill.isPending}>
          <Sparkles className="size-4 mr-2" />{autofill.isPending ? "Pulling…" : "Re-run auto-fill"}
        </Button>
      </div>

      {!isEdit && (billingSummary?.totals.pending ?? pendingTotal) > 0 && (
        <Card className="p-4 bg-destructive/10 border-destructive/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-destructive">
                Discharge blocked — pending balance ₹{(billingSummary?.totals.pending ?? pendingTotal).toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Settle the outstanding amount in the Billing Center before completing discharge.
              </div>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/billing-center">Open Billing Center</Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Discharge template selector & auto-fill */}
      <DischargeTemplateSelector
        hospitalId={(adm as any)?.hospital_id}
        doctorId={adm.doctor_id}
        currentValues={{
          primary_diagnosis: finalDx,
          secondary_diagnosis: procedures,
          doctor_notes: advice,
          hospital_course: course,
          follow_up_instructions: followUpInstr,
          condition_at_discharge: condition,
          medicines: meds,
        }}
        onApplyTemplate={handleApplyTemplate}
      />

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold">Clinical summary</h2>
          <span className="text-[11px] text-muted-foreground">
            Say “new line”, “comma”, “full stop”, “bullet” while dictating
          </span>
        </div>
        <DictateTextarea label="Final diagnosis" rows={2} value={finalDx} onChange={setFinalDx} />
        <DictateTextarea label="Procedures performed" rows={2} value={procedures} onChange={setProcedures} />
        <DictateTextarea label="Hospital course" rows={3} value={course} onChange={setCourse} placeholder="Summary of stay, treatment given, response…" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2"><Label>Condition at discharge</Label><MicButton size="icon" onAppend={(c) => setCondition((v) => (v ? v + " " + c : c))} /></div>
            <Input value={condition} onChange={(e) => setCondition(e.target.value)} />
          </div>
          <div className="space-y-1"><Label>Follow-up date</Label><Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} /></div>
        </div>
        <DictateTextarea label="Follow-up instructions" rows={2} value={followUpInstr} onChange={setFollowUpInstr} />
        <DictateTextarea label="Advice on discharge" rows={2} value={advice} onChange={setAdvice} />
      </Card>


      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Take-home medicines</h2>
          <Button variant="outline" size="sm" onClick={() => setMeds([...meds, { id: crypto.randomUUID(), medicine_name: "", dosage: "", duration: "", instructions: "" }])}><Plus className="size-3.5 mr-1" />Add</Button>
        </div>
        <div className="space-y-3">
          {meds.map((m) => (
            <div key={m.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <Input className="sm:col-span-4" placeholder="Medicine" value={m.medicine_name} onChange={(e) => setMeds(meds.map((x) => x.id === m.id ? { ...x, medicine_name: e.target.value } : x))} />
              <Input className="sm:col-span-2" placeholder="Dose" value={m.dosage} onChange={(e) => setMeds(meds.map((x) => x.id === m.id ? { ...x, dosage: e.target.value } : x))} />
              <Input className="sm:col-span-2" placeholder="Duration" value={m.duration} onChange={(e) => setMeds(meds.map((x) => x.id === m.id ? { ...x, duration: e.target.value } : x))} />
              <Input className="sm:col-span-3" placeholder="Instructions" value={m.instructions} onChange={(e) => setMeds(meds.map((x) => x.id === m.id ? { ...x, instructions: e.target.value } : x))} />
              <Button variant="ghost" size="icon" className="sm:col-span-1 justify-self-end text-muted-foreground hover:text-destructive" onClick={() => setMeds(meds.filter((x) => x.id !== m.id))}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          {meds.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No take-home medicines added.</div>}
        </div>
      </Card>

      <div className="flex justify-end gap-2 sm:gap-3 flex-wrap">
        <Button variant="outline" asChild><Link to="/ipd/$id" params={{ id }}>Cancel</Link></Button>
        <Button variant="outline" onClick={shareWhatsApp}><Share2 className="size-4 mr-2" />WhatsApp share</Button>
        <Button variant="secondary" onClick={() => save.mutate({ draft: true })} disabled={save.isPending}>
          <Save className="size-4 mr-2" />Save draft
        </Button>
        <Button onClick={() => save.mutate({ draft: false })} disabled={save.isPending || (!isFinalised && (billingSummary?.totals.pending ?? pendingTotal) > 0)}>
          <Download className="size-4 mr-2" />{save.isPending ? "Saving…" : isFinalised ? "Update & print" : "Discharge & print"}
        </Button>
      </div>

    </div>
  );
}
