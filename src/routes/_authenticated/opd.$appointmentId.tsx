import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Plus, Trash2, Save, Printer, FlaskConical, Stethoscope, Pill,
  Receipt, MessageCircle, History, Activity,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { format, differenceInYears } from "date-fns";
import { DoctorDictate, parseMedicationLine, splitDictationToLines } from "@/components/doctor-dictate";

export const Route = createFileRoute("/_authenticated/opd/$appointmentId")({ component: Consultation });

// ---------------- types ----------------
interface RxItem {
  medicine_name: string;
  strength: string;
  route: string;
  frequency: string; // e.g. "1-0-1" or "M/A/E/N"
  food_instruction: string;
  duration_days: string;
  quantity: string;
  instructions: string;
}
interface InvItem { name: string; priority: "Routine" | "Urgent" | "Stat"; price: string; notes: string; }
interface ProcItem { name: string; price: string; notes: string; }

const EMPTY_RX: RxItem = { medicine_name: "", strength: "", route: "Oral", frequency: "1-0-1", food_instruction: "After meal", duration_days: "5", quantity: "", instructions: "" };
const EMPTY_INV: InvItem = { name: "", priority: "Routine", price: "0", notes: "" };
const EMPTY_PROC: ProcItem = { name: "", price: "0", notes: "" };

const ROUTES = ["Oral", "IV", "IM", "SC", "Topical", "Inhalation", "PR", "PV"];
const FREQS = ["1-0-0", "0-0-1", "1-0-1", "1-1-1", "1-1-1-1", "SOS", "Stat"];
const FOOD = ["Before meal", "After meal", "With meal", "Empty stomach"];
const PRIORITIES = ["Routine", "Urgent", "Stat"] as const;
const COMMON_TESTS = ["CBC", "Blood Sugar (FBS/PPBS)", "LFT", "KFT", "Lipid Profile", "TSH", "Urine Routine", "X-Ray Chest", "USG Abdomen", "ECG", "CT Scan", "MRI"];
const COMMON_PROCEDURES = ["Dressing", "Injection IM", "Injection IV", "Nebulization", "ECG", "Suturing", "Catheterization"];

// helper – pack non-canonical med fields into notes JSON so no schema change needed
function packNotes(it: RxItem) {
  return JSON.stringify({ s: it.strength, r: it.route, q: it.quantity, i: it.instructions });
}
function unpackNotes(notes: string | null) {
  if (!notes) return { strength: "", route: "Oral", quantity: "", instructions: "" };
  try {
    const j = JSON.parse(notes);
    return { strength: j.s ?? "", route: j.r ?? "Oral", quantity: j.q ?? "", instructions: j.i ?? "" };
  } catch { return { strength: "", route: "Oral", quantity: "", instructions: notes }; }
}

function ageOf(dob?: string | null) {
  if (!dob) return "—";
  try { return `${differenceInYears(new Date(), new Date(dob))}y`; } catch { return "—"; }
}

function Consultation() {
  const { appointmentId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // -------------- queries --------------
  const { data: appt } = useQuery({
    queryKey: ["appt", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments")
        .select("id, scheduled_at, status, token_no, patient_id, doctor_id, patients(*), doctors(id, name, specialization, consultation_fee)")
        .eq("id", appointmentId).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["patient-history", appt?.patient_id],
    enabled: !!appt?.patient_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("opd_visits")
        .select("id, diagnosis, chief_complaints, created_at, doctors(name), prescriptions(id, prescription_items(medicine_name, dosage))")
        .eq("patient_id", appt!.patient_id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: prevBills = [] } = useQuery({
    queryKey: ["patient-bills", appt?.patient_id],
    enabled: !!appt?.patient_id,
    queryFn: async () => (await supabase.from("bills").select("id, bill_no, total, pending, status, created_at").eq("patient_id", appt!.patient_id).order("created_at", { ascending: false }).limit(5)).data ?? [],
  });

  // -------------- form state --------------
  const [chief, setChief] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [findings, setFindings] = useState("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [vitals, setVitals] = useState({ bp: "", pulse: "", temp: "", spo2: "", weight: "", height: "" });
  const [items, setItems] = useState<RxItem[]>([{ ...EMPTY_RX }]);
  const [investigations, setInvestigations] = useState<InvItem[]>([]);
  const [procedures, setProcedures] = useState<ProcItem[]>([]);
  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    if (appt?.doctors?.consultation_fee != null) setConsultationFee(Number(appt.doctors.consultation_fee));
  }, [appt?.doctors?.consultation_fee]);

  const { data: existingVisit } = useQuery({
    queryKey: ["opd-consult-existing-visit", appointmentId],
    enabled: !!appt?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("opd_visits")
        .select("id, chief_complaints, diagnosis, clinical_findings, notes, follow_up_date, vitals, prescriptions(id, prescription_items(id, medicine_name, dosage, timing, food_instruction, duration_days, notes, position))")
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: existingBill } = useQuery({
    queryKey: ["opd-consult-existing-bill", existingVisit?.id],
    enabled: !!existingVisit?.id,
    queryFn: async () => {
      const { data: b } = await supabase.from("bills").select("id, paid, status, bill_no").eq("opd_visit_id", existingVisit.id).maybeSingle();
      if (!b) return null;
      const { data: bi } = await supabase.from("bill_items").select("category, description, quantity, unit_price").eq("bill_id", b.id).order("position");
      return { bill: b, items: bi ?? [] };
    },
  });

  useEffect(() => {
    if (!appt?.id) return;
    if (appt.status === "in_consultation" || appt.status === "completed") return;
    supabase.from("appointments").update({ status: "in_consultation" as any }).eq("id", appt.id).then(() => {
      qc.invalidateQueries({ queryKey: ["opd-consult-queue"] });
    });
  }, [appt?.id, appt?.status, qc]);

  useEffect(() => {
    if (!existingVisit) return;
    setChief(existingVisit.chief_complaints ?? "");
    setDiagnosis(existingVisit.diagnosis ?? "");
    setFindings(existingVisit.clinical_findings ?? "");
    setNotes((existingVisit.notes ?? "").replace(/\n?\[Consultation duration: .*? min\]$/m, ""));
    setFollowUp(existingVisit.follow_up_date ?? "");
    setVitals({ bp: "", pulse: "", temp: "", spo2: "", weight: "", height: "", ...(existingVisit.vitals ?? {}) });
    const rxItems = existingVisit.prescriptions?.[0]?.prescription_items ?? [];
    if (rxItems.length) {
      setItems(rxItems.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)).map((it: any) => {
        const meta = unpackNotes(it.notes);
        return {
          medicine_name: it.medicine_name ?? "",
          strength: meta.strength,
          route: meta.route,
          frequency: it.dosage ?? "",
          food_instruction: it.food_instruction ?? "After meal",
          duration_days: it.duration_days ? String(it.duration_days) : "",
          quantity: meta.quantity,
          instructions: meta.instructions,
        };
      }));
    }
  }, [existingVisit]);

  useEffect(() => {
    if (!existingBill?.items?.length) return;
    const inv: InvItem[] = [];
    const proc: ProcItem[] = [];
    let fee = consultationFee;
    for (const i of existingBill.items as any[]) {
      if (i.category === "Lab") inv.push({ name: i.description, priority: "Routine", price: String(i.unit_price), notes: "" });
      else if (i.category === "Procedure") proc.push({ name: i.description, price: String(i.unit_price), notes: "" });
      else if (i.category === "Consultation") fee = Number(i.unit_price);
    }
    setInvestigations(inv);
    setProcedures(proc);
    setConsultationFee(fee);
  }, [existingBill?.bill?.id]); // eslint-disable-line

  // -------------- save --------------
  async function save(opts: { print?: boolean; bill?: boolean } = {}) {
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

      // 1. opd_visit (upsert by appointment_id)
      let visitId = existingVisit?.id as string | undefined;
      if (!visitId) {
        const { data: existing } = await supabase.from("opd_visits").select("id").eq("appointment_id", appt.id).maybeSingle();
        visitId = existing?.id;
      }
      if (visitId) {
        const { error } = await supabase.from("opd_visits").update(visitPayload).eq("id", visitId);
        if (error) throw error;
      } else {
        const { data: visit, error } = await supabase.from("opd_visits").insert(visitPayload).select("id").single();
        if (error) throw error;
        visitId = visit.id;
      }

      // 2. vitals table snapshot (best-effort, ignore failure)
      if (Object.values(vitals).some(v => v)) {
        const bp = (vitals.bp ?? "").split("/");
        await supabase.from("vitals").insert({
          patient_id: appt.patient_id,
          recorded_at: new Date().toISOString(),
          systolic: bp[0] ? Number(bp[0]) || null : null,
          diastolic: bp[1] ? Number(bp[1]) || null : null,
          pulse: vitals.pulse ? Number(vitals.pulse) || null : null,
          temperature: vitals.temp ? Number(vitals.temp) || null : null,
          oxygen: vitals.spo2 ? Number(vitals.spo2) || null : null,
          weight: vitals.weight ? Number(vitals.weight) || null : null,
          recorded_by: user?.id,
          notes: vitals.height ? `Height: ${vitals.height} cm` : null,
        });
      }

      // 3. prescription + items
      let { data: rx } = await supabase.from("prescriptions").select("id").eq("opd_visit_id", visitId).maybeSingle();
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
          dosage: it.frequency,
          timing: it.frequency,
          food_instruction: it.food_instruction,
          duration_days: it.duration_days ? Number(it.duration_days) : null,
          notes: packNotes(it),
          position: idx,
        })));
        if (e3) throw e3;
      }

      // 4. AUTO-BILL — consultation + investigations + procedures + meds
      const { data: existingBillRow } = await supabase.from("bills").select("id, paid, status, bill_no").eq("opd_visit_id", visitId).maybeSingle();
      const billItems: any[] = [];
      let position = 0;
      // consultation
      billItems.push({ category: "Consultation", description: `Consultation - ${appt.doctors?.name ?? "Doctor"}`, quantity: 1, unit_price: consultationFee, amount: consultationFee, position: position++ });
      // investigations
      investigations.filter(i => i.name.trim()).forEach((i) => {
        const price = Number(i.price) || 0;
        billItems.push({ category: "Lab", description: `${i.name}${i.priority !== "Routine" ? ` [${i.priority}]` : ""}`, quantity: 1, unit_price: price, amount: price, position: position++ });
      });
      // procedures
      procedures.filter(p => p.name.trim()).forEach((p) => {
        const price = Number(p.price) || 0;
        billItems.push({ category: "Procedure", description: p.name, quantity: 1, unit_price: price, amount: price, position: position++ });
      });
      // meds (₹0, pharmacy bills separately if needed)
      validItems.forEach((it) => {
        const qty = Number(it.quantity) || 1;
        billItems.push({
          category: "Pharmacy",
          description: `${it.medicine_name}${it.strength ? ` ${it.strength}` : ""}${it.duration_days ? ` × ${it.duration_days}d` : ""}`,
          quantity: qty, unit_price: 0, amount: 0, position: position++,
        });
      });

      const subtotal = billItems.reduce((s, i) => s + Number(i.amount), 0);
      const total = subtotal;
      const paid = Number(existingBillRow?.paid ?? 0);
      const pending = Math.max(0, total - paid);
      const status: "draft" | "partial" | "paid" = paid >= total && total > 0 ? "paid" : paid > 0 ? "partial" : "draft";

      let billId = existingBillRow?.id;
      const lockBillEdits = paid > 0; // do not overwrite items once payment has started
      if (billId) {
        await supabase.from("bills").update({
          patient_id: appt.patient_id, doctor_id: appt.doctor_id, opd_visit_id: visitId,
          subtotal, discount: 0, gst: 0, total, pending, status,
        }).eq("id", billId);
        if (!lockBillEdits) {
          await supabase.from("bill_items").delete().eq("bill_id", billId);
          await supabase.from("bill_items").insert(billItems.map(b => ({ ...b, bill_id: billId })));
        }
      } else {
        const { data: created, error: be } = await supabase.from("bills").insert({
          patient_id: appt.patient_id, doctor_id: appt.doctor_id, opd_visit_id: visitId,
          subtotal, discount: 0, gst: 0, total, paid: 0, pending: total, status: "draft", created_by: user?.id,
        }).select("id").single();
        if (be) throw be;
        billId = created.id;
        await supabase.from("bill_items").insert(billItems.map(b => ({ ...b, bill_id: billId })));
      }

      // 5. mark appointment completed
      await supabase.from("appointments").update({ status: "completed" as any }).eq("id", appt.id);
      qc.invalidateQueries();
      toast.success("Consultation saved · invoice auto-generated");

      if (opts.print) window.open(`/prescriptions/${rx.id}/print`, "_blank");
      if (opts.bill) navigate({ to: "/opd/billing" });
      else if (!opts.print) navigate({ to: "/opd" });
    } catch (err: any) {
      console.error("[consultation save]", err);
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function shareWhatsApp() {
    const mobile = (appt as any)?.patients?.mobile?.replace(/\D/g, "");
    const rxId = existingVisit?.prescriptions?.[0]?.id;
    if (!rxId) { toast.info("Save the consultation first"); return; }
    const url = `${window.location.origin}/prescriptions/${rxId}/print`;
    const msg = `Hello ${(appt as any).patients?.full_name}, your prescription from Dr ${(appt as any).doctors?.name} is ready: ${url}`;
    window.open(`https://wa.me/${mobile ?? ""}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  // -------------- totals preview --------------
  const billPreview = useMemo(() => {
    const inv = investigations.filter(i => i.name.trim()).reduce((s, i) => s + (Number(i.price) || 0), 0);
    const pr = procedures.filter(p => p.name.trim()).reduce((s, p) => s + (Number(p.price) || 0), 0);
    return { consult: consultationFee, inv, pr, total: consultationFee + inv + pr };
  }, [consultationFee, investigations, procedures]);

  if (!appt) return <div className="text-sm text-muted-foreground">Loading...</div>;

  const patient = (appt as any).patients;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/opd"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {patient?.full_name} <span className="text-sm text-muted-foreground font-mono ml-1">{patient?.uhid}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {ageOf(patient?.dob)} · <span className="capitalize">{patient?.gender}</span> · {patient?.mobile} · {(appt as any).doctors?.name} · token {(appt as any).token_no ?? "—"} · {format(new Date(appt.scheduled_at), "dd MMM yyyy HH:mm")}
          </p>
        </div>
        {existingBill?.bill?.bill_no && (
          <Badge variant="outline" className="font-mono text-[10px]"><Receipt className="size-3 mr-1" />{existingBill.bill.bill_no}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: history */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2"><History className="size-4 text-primary" /><h2 className="font-semibold text-sm">Patient timeline</h2></div>
            <div className="space-y-2 text-xs">
              <div><span className="text-muted-foreground">Allergies:</span> {patient?.allergies || "—"}</div>
              <div><span className="text-muted-foreground">Chronic:</span> {patient?.chronic_diseases || "—"}</div>
              <div><span className="text-muted-foreground">Blood:</span> {patient?.blood_group || "—"}</div>
            </div>
            <div className="pt-3 border-t">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Previous visits</div>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No previous visits.</p>
              ) : (
                <div className="space-y-2.5">
                  {history.map((v: any) => (
                    <div key={v.id} className="text-xs border-l-2 border-primary/30 pl-2.5 py-0.5">
                      <div className="text-muted-foreground">{format(new Date(v.created_at), "dd MMM yyyy")} · {v.doctors?.name}</div>
                      <div className="font-medium truncate">{v.diagnosis || v.chief_complaints || "Consultation"}</div>
                      {v.prescriptions?.[0]?.prescription_items?.length > 0 && (
                        <div className="text-muted-foreground truncate">Rx: {v.prescriptions[0].prescription_items.slice(0,3).map((p: any) => p.medicine_name).join(", ")}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {prevBills.length > 0 && (
              <div className="pt-3 border-t">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Recent bills</div>
                <div className="space-y-1.5 text-xs">
                  {prevBills.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground">{b.bill_no}</span>
                      <span className="tabular-nums">₹{Number(b.total).toFixed(0)}</span>
                      <span className="text-[10px] capitalize">{b.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Center: consultation */}
        <div className="xl:col-span-6 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><h2 className="font-semibold text-sm">Vitals</h2></div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <VitalInput label="BP" value={vitals.bp} onChange={(v) => setVitals({ ...vitals, bp: v })} placeholder="120/80" />
              <VitalInput label="Pulse" value={vitals.pulse} onChange={(v) => setVitals({ ...vitals, pulse: v })} placeholder="72" />
              <VitalInput label="Temp" value={vitals.temp} onChange={(v) => setVitals({ ...vitals, temp: v })} placeholder="98.6" />
              <VitalInput label="SpO₂" value={vitals.spo2} onChange={(v) => setVitals({ ...vitals, spo2: v })} placeholder="98" />
              <VitalInput label="Wt (kg)" value={vitals.weight} onChange={(v) => setVitals({ ...vitals, weight: v })} placeholder="kg" />
              <VitalInput label="Ht (cm)" value={vitals.height} onChange={(v) => setVitals({ ...vitals, height: v })} placeholder="cm" />
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="font-semibold text-sm flex items-center gap-2"><Stethoscope className="size-4 text-primary" />Clinical notes</h2>
            <FieldArea label="Chief complaints" value={chief} onChange={setChief} rows={2} />
            <FieldArea label="Clinical findings" value={findings} onChange={setFindings} rows={2} />
            <FieldArea label="Diagnosis" value={diagnosis} onChange={setDiagnosis} rows={2} />
            <FieldArea label="Doctor advice / notes" value={notes} onChange={setNotes} rows={2} />
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Follow-up date</Label>
              <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="h-9 text-sm w-48" />
            </div>
          </Card>

          {/* Medicines */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><Pill className="size-4 text-primary" />Medicines</h2>
              <Button size="sm" variant="ghost" onClick={() => setItems([...items, { ...EMPTY_RX }])}><Plus className="size-3.5 mr-1" />Add medicine</Button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="rounded-xl border p-3 space-y-2 bg-surface-muted/40">
                  <div className="grid grid-cols-12 gap-2">
                    <Input value={it.medicine_name} onChange={(e) => updateItem(i, "medicine_name", e.target.value)} placeholder="Medicine name" className="h-9 text-sm col-span-6" />
                    <Input value={it.strength} onChange={(e) => updateItem(i, "strength", e.target.value)} placeholder="Strength (500mg)" className="h-9 text-sm col-span-3" />
                    <Select value={it.route} onValueChange={(v) => updateItem(i, "route", v)}>
                      <SelectTrigger className="h-9 text-sm col-span-2"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-9 w-9 col-span-1 justify-self-end" onClick={() => setItems(items.filter((_, x) => x !== i))}><Trash2 className="size-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <Select value={it.frequency} onValueChange={(v) => updateItem(i, "frequency", v)}>
                      <SelectTrigger className="h-9 text-sm col-span-3"><SelectValue placeholder="Freq" /></SelectTrigger>
                      <SelectContent>{FREQS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={it.food_instruction} onValueChange={(v) => updateItem(i, "food_instruction", v)}>
                      <SelectTrigger className="h-9 text-sm col-span-3"><SelectValue /></SelectTrigger>
                      <SelectContent>{FOOD.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" value={it.duration_days} onChange={(e) => updateItem(i, "duration_days", e.target.value)} placeholder="Days" className="h-9 text-sm col-span-2" />
                    <Input type="number" value={it.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} placeholder="Qty" className="h-9 text-sm col-span-2" />
                    <Input value={it.instructions} onChange={(e) => updateItem(i, "instructions", e.target.value)} placeholder="Instructions" className="h-9 text-sm col-span-2" />
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No medicines yet.</p>}
            </div>
          </Card>

          {/* Investigations */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><FlaskConical className="size-4 text-primary" />Investigations / Tests</h2>
              <Button size="sm" variant="ghost" onClick={() => setInvestigations([...investigations, { ...EMPTY_INV }])}><Plus className="size-3.5 mr-1" />Add test</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TESTS.map(t => (
                <Button key={t} type="button" variant="outline" size="sm" className="h-7 text-[11px] rounded-full" onClick={() => setInvestigations([...investigations, { ...EMPTY_INV, name: t }])}>+ {t}</Button>
              ))}
            </div>
            {investigations.length > 0 && (
              <div className="space-y-2">
                {investigations.map((inv, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input value={inv.name} onChange={(e) => updateInv(i, "name", e.target.value)} placeholder="Test name" className="h-9 text-sm col-span-5" />
                    <Select value={inv.priority} onValueChange={(v) => updateInv(i, "priority", v as any)}>
                      <SelectTrigger className="h-9 text-sm col-span-2"><SelectValue /></SelectTrigger>
                      <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input value={inv.notes} onChange={(e) => updateInv(i, "notes", e.target.value)} placeholder="Notes" className="h-9 text-sm col-span-2" />
                    <Input type="number" value={inv.price} onChange={(e) => updateInv(i, "price", e.target.value)} placeholder="₹ price" className="h-9 text-sm col-span-2" />
                    <Button variant="ghost" size="icon" className="h-9 w-9 col-span-1 justify-self-end" onClick={() => setInvestigations(investigations.filter((_, x) => x !== i))}><Trash2 className="size-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Procedures */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm flex items-center gap-2"><Activity className="size-4 text-primary" />Procedures</h2>
              <Button size="sm" variant="ghost" onClick={() => setProcedures([...procedures, { ...EMPTY_PROC }])}><Plus className="size-3.5 mr-1" />Add procedure</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_PROCEDURES.map(p => (
                <Button key={p} type="button" variant="outline" size="sm" className="h-7 text-[11px] rounded-full" onClick={() => setProcedures([...procedures, { ...EMPTY_PROC, name: p }])}>+ {p}</Button>
              ))}
            </div>
            {procedures.length > 0 && (
              <div className="space-y-2">
                {procedures.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input value={p.name} onChange={(e) => updateProc(i, "name", e.target.value)} placeholder="Procedure name" className="h-9 text-sm col-span-6" />
                    <Input value={p.notes} onChange={(e) => updateProc(i, "notes", e.target.value)} placeholder="Notes" className="h-9 text-sm col-span-3" />
                    <Input type="number" value={p.price} onChange={(e) => updateProc(i, "price", e.target.value)} placeholder="₹ price" className="h-9 text-sm col-span-2" />
                    <Button variant="ghost" size="icon" className="h-9 w-9 col-span-1 justify-self-end" onClick={() => setProcedures(procedures.filter((_, x) => x !== i))}><Trash2 className="size-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: billing preview */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="p-4 space-y-3 xl:sticky xl:top-4">
            <div className="flex items-center gap-2"><Receipt className="size-4 text-primary" /><h2 className="font-semibold text-sm">Auto-billing preview</h2></div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Consultation fee (₹)</Label>
                <Input type="number" value={consultationFee} onChange={(e) => setConsultationFee(Number(e.target.value))} className="h-9 text-sm" />
              </div>
              <div className="text-xs space-y-1 pt-2 border-t">
                <Row label="Consultation" value={billPreview.consult} />
                <Row label={`Investigations (${investigations.filter(i=>i.name.trim()).length})`} value={billPreview.inv} />
                <Row label={`Procedures (${procedures.filter(p=>p.name.trim()).length})`} value={billPreview.pr} />
                <Row label={`Medicines (${items.filter(i=>i.medicine_name.trim()).length})`} value={0} muted />
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Total</span>
                <span className="tabular-nums">₹{billPreview.total.toFixed(0)}</span>
              </div>
              {existingBill?.bill?.paid != null && Number(existingBill.bill.paid) > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠ Payment already recorded · items are locked.</p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">Saving consultation auto-generates / updates the invoice. Collect payment in OPD Billing.</p>
          </Card>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 py-3 flex items-center justify-end gap-2">
          <Button variant="ghost" asChild><Link to="/opd">Cancel</Link></Button>
          <Button variant="outline" onClick={shareWhatsApp}><MessageCircle className="size-4 mr-2" />WhatsApp</Button>
          <Button variant="outline" onClick={() => save({ print: true })} disabled={saving}><Printer className="size-4 mr-2" />Save & print Rx</Button>
          <Button variant="outline" onClick={() => save({ bill: true })} disabled={saving}><Receipt className="size-4 mr-2" />Save & collect</Button>
          <Button onClick={() => save()} disabled={saving} size="lg"><Save className="size-4 mr-2" />Save consultation</Button>
        </div>
      </div>
    </div>
  );

  function updateItem(i: number, k: keyof RxItem, v: string) {
    setItems(items.map((it, x) => x === i ? { ...it, [k]: v } : it));
  }
  function updateInv(i: number, k: keyof InvItem, v: string) {
    setInvestigations(investigations.map((it, x) => x === i ? { ...it, [k]: v } : it));
  }
  function updateProc(i: number, k: keyof ProcItem, v: string) {
    setProcedures(procedures.map((it, x) => x === i ? { ...it, [k]: v } : it));
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
function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">₹{value.toFixed(0)}</span>
    </div>
  );
}
