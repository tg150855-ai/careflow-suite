import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Activity, Stethoscope, Pill, ClipboardList, LogOut, AlertCircle, ArrowLeftRight, FlaskConical, Scan, Syringe, Receipt, Printer, Trash2, Plus, Skull } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { VoiceDictate } from "@/components/voice-dictate";
import { patientPhotoPublicUrl } from "@/components/patient-photo-field";

export const Route = createFileRoute("/_authenticated/ipd/$id")({ component: AdmissionDetail });

function AdmissionDetail() {
  const { id } = Route.useParams();

  const { data: adm } = useQuery({
    queryKey: ["admission", id],
    queryFn: async () => (await supabase.from("admissions").select("*, patients(*), doctors(name, specialization), wards(name, type), beds(bed_number, charge_per_day)").eq("id", id).single()).data,
  });

  if (!adm) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const days = Math.max(1, differenceInDays(adm.discharged_at ? new Date(adm.discharged_at) : new Date(), new Date(adm.admitted_at)) + 1);
  const photo = (adm.patients as any)?.photo_url ? patientPhotoPublicUrl((adm.patients as any).photo_url) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 flex-wrap">
        <Button asChild variant="ghost" size="icon" className="mt-1"><Link to="/ipd"><ArrowLeft className="size-4" /></Link></Button>
        <Avatar className="size-14">
          {photo ? <AvatarImage src={photo} alt={adm.patients?.full_name} /> : null}
          <AvatarFallback>{adm.patients?.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{adm.patients?.full_name}</h1>
            <Badge variant="secondary" className="font-mono">{adm.admission_no}</Badge>
            <Badge variant={adm.status === "active" ? "default" : "outline"} className="capitalize">{adm.status}</Badge>
            {adm.is_emergency && <Badge className="bg-destructive/10 text-destructive border-destructive/20" variant="outline">Emergency</Badge>}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {adm.patients?.uhid} · {adm.patients?.mobile} · {adm.patients?.gender} · Bed {adm.beds?.bed_number ?? "—"} ({adm.wards?.name}) · Day {days}
          </div>
        </div>
        {adm.status === "active" && (
          <div className="flex gap-2">
            <TransferDialog admission={adm} />
            <Button asChild variant="default"><Link to="/ipd/$id/discharge" params={{ id }}><LogOut className="size-4 mr-2" />Discharge</Link></Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard label="Admitted on" value={format(new Date(adm.admitted_at), "dd MMM yyyy, p")} />
        <InfoCard label="Discharged on" value={adm.discharged_at ? format(new Date(adm.discharged_at), "dd MMM yyyy, p") : "—"} sub={adm.discharged_at ? `${days} day stay` : "In hospital"} />
        <InfoCard label="Treating doctor" value={adm.doctors?.name ?? "—"} sub={adm.doctors?.specialization} />
        <InfoCard label="Bed charge" value={adm.beds?.charge_per_day ? `₹${adm.beds.charge_per_day}/day` : "—"} sub={`Est ${adm.estimated_stay_days ?? "—"} days`} />
      </div>


      <Tabs defaultValue="vitals">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="vitals"><Activity className="size-3.5 mr-1.5" />Vitals</TabsTrigger>
          <TabsTrigger value="rounds"><Stethoscope className="size-3.5 mr-1.5" />Rounds</TabsTrigger>
          <TabsTrigger value="mar"><Pill className="size-3.5 mr-1.5" />Medication</TabsTrigger>
          <TabsTrigger value="nursing"><ClipboardList className="size-3.5 mr-1.5" />Nursing</TabsTrigger>
          <TabsTrigger value="labs"><FlaskConical className="size-3.5 mr-1.5" />Labs</TabsTrigger>
          <TabsTrigger value="radiology"><Scan className="size-3.5 mr-1.5" />Radiology</TabsTrigger>
          <TabsTrigger value="vaccinations"><Syringe className="size-3.5 mr-1.5" />Vaccinations</TabsTrigger>
          <TabsTrigger value="transfers"><ArrowLeftRight className="size-3.5 mr-1.5" />Transfers</TabsTrigger>
          <TabsTrigger value="billing"><Receipt className="size-3.5 mr-1.5" />Billing</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="vitals"><VitalsTab admissionId={id} patientId={adm.patient_id} /></TabsContent>
        <TabsContent value="rounds"><RoundsTab admissionId={id} doctorId={adm.doctor_id} /></TabsContent>
        <TabsContent value="mar"><MARTab admissionId={id} /></TabsContent>
        <TabsContent value="nursing"><NursingTab admissionId={id} /></TabsContent>
        <TabsContent value="labs"><LabsTab admissionId={id} patientId={adm.patient_id} /></TabsContent>
        <TabsContent value="radiology"><RadiologyTab admissionId={id} patientId={adm.patient_id} /></TabsContent>
        <TabsContent value="vaccinations"><VaccinationsTab patientId={adm.patient_id} /></TabsContent>
        <TabsContent value="transfers"><TransfersTab admissionId={id} /></TabsContent>
        <TabsContent value="billing"><BillingTab admission={adm} days={days} /></TabsContent>
        <TabsContent value="overview">
          <Card className="p-6 space-y-3 text-sm">
            <Row label="Initial diagnosis" value={adm.initial_diagnosis} />
            <Row label="Attender" value={adm.attender_name ? `${adm.attender_name} (${adm.attender_mobile ?? "—"})` : "—"} />
            <Row label="Emergency contact" value={adm.emergency_contact} />
            <Row label="Insurance" value={adm.insurance_provider ? `${adm.insurance_provider} · ${adm.insurance_policy_no ?? "—"}` : "—"} />
            <Row label="Notes" value={adm.notes} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoCard({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-4">
      <div className="w-40 text-xs text-muted-foreground shrink-0">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

/* ----------------------------- TRANSFER DIALOG ----------------------------- */
function TransferDialog({ admission }: { admission: any }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [wardId, setWardId] = useState("");
  const [bedId, setBedId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [approver, setApprover] = useState("");

  const { data: wards = [] } = useQuery({
    queryKey: ["wards-active"], queryFn: async () => (await supabase.from("wards").select("id, name, type").order("name")).data ?? [],
  });
  const { data: beds = [] } = useQuery({
    queryKey: ["beds-available", wardId], enabled: !!wardId,
    queryFn: async () => (await supabase.from("beds").select("id, bed_number, status, charge_per_day").eq("ward_id", wardId).in("status", ["available"]).order("bed_number")).data ?? [],
  });
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-list"], queryFn: async () => (await supabase.from("doctors").select("id, name").order("name")).data ?? [],
  });

  const transfer = useMutation({
    mutationFn: async () => {
      if (!bedId) throw new Error("Select a target bed");
      const { error: e1 } = await supabase.from("bed_transfers").insert({
        admission_id: admission.id, from_bed_id: admission.bed_id, to_bed_id: bedId,
        from_ward_id: admission.ward_id, to_ward_id: wardId,
        reason: reason || null, notes: notes || null,
        approved_by: approver || null, created_by: user?.id ?? null,
      });
      if (e1) throw e1;
      await supabase.from("admissions").update({ ward_id: wardId, bed_id: bedId }).eq("id", admission.id);
      if (admission.bed_id) await supabase.from("beds").update({ status: "cleaning" }).eq("id", admission.bed_id);
      await supabase.from("beds").update({ status: "occupied" }).eq("id", bedId);
    },
    onSuccess: () => {
      toast.success("Patient transferred");
      setOpen(false); setWardId(""); setBedId(""); setReason(""); setNotes(""); setApprover("");
      qc.invalidateQueries({ queryKey: ["admission", admission.id] });
      qc.invalidateQueries({ queryKey: ["transfers", admission.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><ArrowLeftRight className="size-4 mr-2" />Transfer</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Transfer patient</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Currently in <b>{admission.wards?.name}</b> · Bed <b>{admission.beds?.bed_number ?? "—"}</b>
          </div>
          <div className="space-y-1">
            <Label>Target ward</Label>
            <Select value={wardId} onValueChange={(v) => { setWardId(v); setBedId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger>
              <SelectContent>{wards.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name} ({w.type})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Target bed</Label>
            <Select value={bedId} onValueChange={setBedId} disabled={!wardId}>
              <SelectTrigger><SelectValue placeholder={wardId ? "Select bed" : "Pick ward first"} /></SelectTrigger>
              <SelectContent>
                {beds.map((b: any) => <SelectItem key={b.id} value={b.id}>Bed {b.bed_number} — ₹{b.charge_per_day}/day</SelectItem>)}
                {beds.length === 0 && wardId && <div className="p-2 text-xs text-muted-foreground">No available beds.</div>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Approving doctor</Label>
            <Select value={approver} onValueChange={setApprover}>
              <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
              <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Step-down, isolation, ICU, family request…" /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => transfer.mutate()} disabled={transfer.isPending || !bedId}>{transfer.isPending ? "Transferring…" : "Save transfer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransfersTab({ admissionId }: { admissionId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["transfers", admissionId],
    queryFn: async () => (await supabase.from("bed_transfers").select("*, from_bed:from_bed_id(bed_number), to_bed:to_bed_id(bed_number), from_ward:from_ward_id(name), to_ward:to_ward_id(name)").eq("admission_id", admissionId).order("transferred_at", { ascending: false })).data ?? [],
  });
  return (
    <Card className="p-6 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Transfer history</h3>
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-3.5 mr-1.5" />Print slip</Button>
      </div>
      <div className="space-y-2">
        {rows.map((t: any) => (
          <div key={t.id} className="flex items-center gap-4 text-sm border-b last:border-0 pb-2 last:pb-0">
            <div className="text-xs text-muted-foreground w-32 shrink-0">{format(new Date(t.transferred_at), "dd MMM yyyy, p")}</div>
            <div className="flex-1">
              <div>
                <span className="text-muted-foreground">From</span> {t.from_ward?.name ?? "—"} / Bed {t.from_bed?.bed_number ?? "—"}{" "}
                <ArrowLeftRight className="size-3 inline mx-1 text-muted-foreground" />{" "}
                <span className="text-muted-foreground">To</span> {t.to_ward?.name ?? "—"} / Bed {t.to_bed?.bed_number ?? "—"}
              </div>
              {t.reason && <div className="text-xs text-muted-foreground mt-0.5">{t.reason}{t.notes ? ` — ${t.notes}` : ""}</div>}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No transfers recorded.</div>}
      </div>
    </Card>
  );
}

/* --------------------------------- VITALS --------------------------------- */
function VitalsTab({ admissionId, patientId }: { admissionId: string; patientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [v, setV] = useState({ systolic: "", diastolic: "", pulse: "", temp: "", ox: "", sugar: "", weight: "" });
  const set = (k: keyof typeof v) => (val: string) => setV({ ...v, [k]: val });

  const { data: rows = [] } = useQuery({
    queryKey: ["vitals", admissionId],
    queryFn: async () => (await supabase.from("vitals").select("*").eq("admission_id", admissionId).order("recorded_at", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vitals").insert({
        admission_id: admissionId, patient_id: patientId,
        systolic: v.systolic ? Number(v.systolic) : null, diastolic: v.diastolic ? Number(v.diastolic) : null,
        pulse: v.pulse ? Number(v.pulse) : null, temperature: v.temp ? Number(v.temp) : null,
        oxygen: v.ox ? Number(v.ox) : null, sugar: v.sugar ? Number(v.sugar) : null, weight: v.weight ? Number(v.weight) : null,
        recorded_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setV({ systolic: "", diastolic: "", pulse: "", temp: "", ox: "", sugar: "", weight: "" }); toast.success("Vitals recorded"); qc.invalidateQueries({ queryKey: ["vitals", admissionId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (rid: string) => { const { error } = await supabase.from("vitals").delete().eq("id", rid); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["vitals", admissionId] }); },
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Record vitals</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Field label="Systolic" value={v.systolic} onChange={set("systolic")} unit="mmHg" />
          <Field label="Diastolic" value={v.diastolic} onChange={set("diastolic")} unit="mmHg" />
          <Field label="Pulse" value={v.pulse} onChange={set("pulse")} unit="bpm" />
          <Field label="Temp" value={v.temp} onChange={set("temp")} unit="°F" />
          <Field label="SpO₂" value={v.ox} onChange={set("ox")} unit="%" />
          <Field label="Sugar" value={v.sugar} onChange={set("sugar")} unit="mg/dL" />
          <Field label="Weight" value={v.weight} onChange={set("weight")} unit="kg" />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="mt-4">Save reading</Button>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">History</h3>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-3.5 mr-1.5" />Print</Button>
        </div>
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-muted">
              <tr>
                <th className="text-left font-medium px-6 py-2">Time</th>
                <th className="text-right font-medium py-2">BP</th>
                <th className="text-right font-medium py-2">Pulse</th>
                <th className="text-right font-medium py-2">Temp</th>
                <th className="text-right font-medium py-2">SpO₂</th>
                <th className="text-right font-medium py-2">Sugar</th>
                <th className="text-right font-medium py-2">Weight</th>
                <th className="text-right font-medium px-6 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-6 py-2 text-xs">{format(new Date(r.recorded_at), "dd MMM, HH:mm")}</td>
                  <td className="text-right tabular-nums py-2">{r.systolic && r.diastolic ? `${r.systolic}/${r.diastolic}` : "—"}</td>
                  <td className="text-right tabular-nums py-2">{r.pulse ?? "—"}</td>
                  <td className="text-right tabular-nums py-2">{r.temperature ?? "—"}</td>
                  <td className="text-right tabular-nums py-2">{r.oxygen ?? "—"}</td>
                  <td className="text-right tabular-nums py-2">{r.sugar ?? "—"}</td>
                  <td className="text-right tabular-nums py-2">{r.weight ?? "—"}</td>
                  <td className="text-right px-6 py-2"><Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="size-3.5" /></Button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground text-sm">No vitals recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, unit }: { label: string; value: string; onChange: (v: string) => void; unit?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label} {unit && <span className="text-muted-foreground">({unit})</span>}</Label>
      <Input type="number" step="0.1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* --------------------------------- ROUNDS --------------------------------- */
const TEMPLATES: Record<string, string> = {
  stable: "Patient is stable. Vitals within normal limits. Continue current management. No new complaints.",
  critical: "Patient remains critical. Close monitoring required. ICU care continued. Family informed of condition.",
  icu: "ICU rounds: Hemodynamically stable on minimal support. Ventilator settings reviewed. Sedation titrated. Continue antibiotics.",
  post_op: "Post-op day review: Surgical site clean and dry. Pain well controlled. Ambulating. Diet advanced. Discharge planning initiated.",
};

function RoundsTab({ admissionId, doctorId }: { admissionId: string; doctorId: string }) {
  const qc = useQueryClient();
  const { user, hasAnyRole } = useAuth();
  const canWrite = hasAnyRole(["admin", "doctor"]);
  const [progress, setProgress] = useState("");
  const [findings, setFindings] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [followUp, setFollowUp] = useState("");

  const { data: rounds = [] } = useQuery({
    queryKey: ["rounds", admissionId],
    queryFn: async () => (await supabase.from("doctor_rounds").select("*, doctors(name)").eq("admission_id", admissionId).order("rounded_at", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("doctor_rounds").insert({
        admission_id: admissionId, doctor_id: doctorId,
        progress_notes: progress || null, clinical_findings: findings || null,
        updated_diagnosis: diagnosis || null, follow_up_orders: followUp || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setProgress(""); setFindings(""); setDiagnosis(""); setFollowUp(""); toast.success("Round recorded"); qc.invalidateQueries({ queryKey: ["rounds", admissionId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (rid: string) => { const { error } = await supabase.from("doctor_rounds").delete().eq("id", rid); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["rounds", admissionId] }); },
  });

  return (
    <div className="space-y-4 mt-4">
      {canWrite && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="font-semibold">New round entry</h3>
            <div className="flex gap-2 items-center">
              <VoiceDictate onTranscript={(t) => setProgress((prev) => (prev ? prev + " " : "") + t)} label="Dictate progress" />
              <Select onValueChange={(k) => setProgress(TEMPLATES[k] ?? "")}>
                <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Quick template…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">Stable</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="icu">ICU notes</SelectItem>
                  <SelectItem value="post_op">Post surgery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Progress notes</Label><Textarea rows={3} value={progress} onChange={(e) => setProgress(e.target.value)} /></div>
            <div className="space-y-1"><Label>Clinical findings</Label><Textarea rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} /></div>
            <div className="space-y-1"><Label>Updated diagnosis</Label><Textarea rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
            <div className="space-y-1"><Label>Follow-up orders</Label><Textarea rows={2} value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></div>
          </div>
          <Button className="mt-4" onClick={() => save.mutate()} disabled={save.isPending}>Save round</Button>
        </Card>
      )}

      <div className="space-y-3">
        {rounds.map((r: any) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Dr. {r.doctors?.name ?? "—"}</div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">{format(new Date(r.rounded_at), "dd MMM yyyy, p")}</div>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => window.print()}><Printer className="size-3.5" /></Button>
                {canWrite && <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="size-3.5" /></Button>}
              </div>
            </div>
            {r.progress_notes && <NoteBlock label="Progress" value={r.progress_notes} />}
            {r.clinical_findings && <NoteBlock label="Findings" value={r.clinical_findings} />}
            {r.updated_diagnosis && <NoteBlock label="Diagnosis" value={r.updated_diagnosis} />}
            {r.follow_up_orders && <NoteBlock label="Follow-up" value={r.follow_up_orders} />}
          </Card>
        ))}
        {rounds.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No rounds recorded yet.</Card>}
      </div>
    </div>
  );
}

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}

/* ----------------------------------- MAR ---------------------------------- */
function MARTab({ admissionId }: { admissionId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [med, setMed] = useState(""); const [dose, setDose] = useState(""); const [route, setRoute] = useState("Oral");
  const [time, setTime] = useState(() => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));

  const { data: items = [] } = useQuery({
    queryKey: ["mar", admissionId],
    queryFn: async () => (await supabase.from("medication_administration").select("*").eq("admission_id", admissionId).order("scheduled_at", { ascending: true })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!med) throw new Error("Medicine required");
      const { error } = await supabase.from("medication_administration").insert({
        admission_id: admissionId, medicine_name: med, dosage: dose || null, route, scheduled_at: new Date(time).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setMed(""); setDose(""); toast.success("Scheduled"); qc.invalidateQueries({ queryKey: ["mar", admissionId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "administered" | "missed" | "held" }) => {
      const { error } = await supabase.from("medication_administration").update({
        status, administered_at: status === "administered" ? new Date().toISOString() : null, administered_by: user?.id ?? null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mar", admissionId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("medication_administration").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mar", admissionId] }),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Schedule medicine</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input placeholder="Medicine" value={med} onChange={(e) => setMed(e.target.value)} className="md:col-span-2" />
          <Input placeholder="Dose (e.g. 500mg)" value={dose} onChange={(e) => setDose(e.target.value)} />
          <Select value={route} onValueChange={setRoute}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["Oral", "IV", "IM", "SC", "Topical", "Inhalation"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <Button onClick={() => add.mutate()} disabled={add.isPending} className="mt-4">Schedule</Button>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-3">Administration record</h3>
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-muted">
              <tr>
                <th className="text-left font-medium px-6 py-2">Due</th>
                <th className="text-left font-medium py-2">Medicine</th>
                <th className="text-left font-medium py-2">Dose</th>
                <th className="text-left font-medium py-2">Route</th>
                <th className="text-left font-medium py-2">Status</th>
                <th className="text-right font-medium px-6 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it: any) => {
                const overdue = it.status === "scheduled" && new Date(it.scheduled_at) < new Date();
                return (
                  <tr key={it.id} className={overdue ? "bg-destructive/5" : ""}>
                    <td className="px-6 py-2 text-xs">
                      {format(new Date(it.scheduled_at), "dd MMM HH:mm")}
                      {overdue && <AlertCircle className="size-3.5 text-destructive inline ml-1" />}
                    </td>
                    <td className="py-2 font-medium">{it.medicine_name}</td>
                    <td className="py-2">{it.dosage ?? "—"}</td>
                    <td className="py-2">{it.route ?? "—"}</td>
                    <td className="py-2"><Badge variant={it.status === "administered" ? "default" : it.status === "missed" ? "destructive" : "outline"} className="capitalize">{it.status}</Badge></td>
                    <td className="px-6 py-2 text-right">
                      {it.status === "scheduled" ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: it.id, status: "administered" })}>Given</Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: it.id, status: "missed" })}>Miss</Button>
                          <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(it.id)}><Trash2 className="size-3.5" /></Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(it.id)}><Trash2 className="size-3.5" /></Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">No medicines scheduled.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------- NURSING -------------------------------- */
function NursingTab({ admissionId }: { admissionId: string }) {
  const qc = useQueryClient();
  const { user, hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["admin", "doctor", "nurse"]);
  const [note, setNote] = useState(""); const [shift, setShift] = useState("Day");

  const { data: notes = [] } = useQuery({
    queryKey: ["nursing", admissionId],
    queryFn: async () => (await supabase.from("nursing_notes").select("*").eq("admission_id", admissionId).order("created_at", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!note.trim()) throw new Error("Note required");
      const { error } = await supabase.from("nursing_notes").insert({ admission_id: admissionId, shift, note, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { setNote(""); toast.success("Note added"); qc.invalidateQueries({ queryKey: ["nursing", admissionId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("nursing_notes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nursing", admissionId] }),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="font-semibold">Add nursing note</h3>
          <VoiceDictate onTranscript={(t) => setNote((prev) => (prev ? prev + " " : "") + t)} />
        </div>
        <div className="flex gap-3 mb-3">
          <Select value={shift} onValueChange={setShift}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{["Morning", "Day", "Evening", "Night"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Textarea rows={3} placeholder="Shift handover, observations, patient status…" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button className="mt-3" onClick={() => add.mutate()} disabled={add.isPending}>Save note</Button>
      </Card>

      <div className="space-y-2">
        {notes.map((n: any) => (
          <Card key={n.id} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <Badge variant="secondary">{n.shift ?? "Shift"}</Badge>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">{format(new Date(n.created_at), "dd MMM, p")}</div>
                {canEdit && <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(n.id)}><Trash2 className="size-3.5" /></Button>}
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap mt-2">{n.note}</div>
          </Card>
        ))}
        {notes.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No nursing notes yet.</Card>}
      </div>
    </div>
  );
}

/* ---------------------------------- LABS --------------------------------- */
function LabsTab({ admissionId, patientId }: { admissionId: string; patientId: string }) {
  const { data: orders = [] } = useQuery({
    queryKey: ["lab-orders-adm", admissionId, patientId],
    queryFn: async () => (await supabase.from("lab_orders").select("*, lab_results(*)").or(`admission_id.eq.${admissionId},patient_id.eq.${patientId}`).order("created_at", { ascending: false })).data ?? [],
  });

  const share = (o: any) => {
    const text = `Lab order ${o.order_no} (${o.status}). Results: ${(o.lab_results ?? []).map((r: any) => `${r.test_name}: ${r.result_value ?? "pending"} ${r.unit ?? ""}`).join(" | ") || "pending"}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <Card className="p-6 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Lab orders & results</h3>
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-3.5 mr-1.5" />Print</Button>
      </div>
      <div className="space-y-3">
        {orders.map((o: any) => (
          <div key={o.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{o.order_no}</span>
                <Badge variant={o.status === "completed" ? "default" : "outline"} className="capitalize">{o.status}</Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd MMM yyyy")}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => share(o)}>Share</Button>
            </div>
            {(o.lab_results ?? []).length > 0 && (
              <div className="space-y-1 mt-2">
                {o.lab_results.map((r: any) => (
                  <div key={r.id} className="text-sm grid grid-cols-12 gap-2">
                    <div className="col-span-5 truncate">{r.test_name}</div>
                    <div className="col-span-3 font-medium">{r.result_value ?? "—"} {r.unit ?? ""}</div>
                    <div className="col-span-3 text-xs text-muted-foreground">{r.reference_range ?? ""}</div>
                    <div className="col-span-1 text-right">{r.flag && <Badge variant="destructive" className="text-[10px]">{r.flag}</Badge>}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {orders.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No lab orders. Use Laboratory module to add.</div>}
      </div>
    </Card>
  );
}

/* ------------------------------- RADIOLOGY ------------------------------- */
function RadiologyTab({ admissionId, patientId }: { admissionId: string; patientId: string }) {
  const { data: orders = [] } = useQuery({
    queryKey: ["rad-orders-adm", admissionId, patientId],
    queryFn: async () => (await supabase.from("radiology_orders").select("*, radiology_reports(*)").or(`admission_id.eq.${admissionId},patient_id.eq.${patientId}`).order("created_at", { ascending: false })).data ?? [],
  });
  const share = (o: any) => {
    const rep = (o.radiology_reports ?? [])[0];
    const text = `${o.modality} ${o.investigation} (${o.status}). ${rep?.impression ? "Impression: " + rep.impression : "Report pending"}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  return (
    <Card className="p-6 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Radiology & imaging</h3>
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-3.5 mr-1.5" />Print</Button>
      </div>
      <div className="space-y-3">
        {orders.map((o: any) => {
          const rep = (o.radiology_reports ?? [])[0];
          return (
            <div key={o.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{o.modality}</Badge>
                  <span className="text-sm font-medium">{o.investigation}</span>
                  <Badge variant={o.status === "completed" ? "default" : "outline"} className="capitalize">{o.status}</Badge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => share(o)}>Share</Button>
              </div>
              {rep?.findings && <div className="text-sm mt-1"><span className="text-xs text-muted-foreground">Findings: </span>{rep.findings}</div>}
              {rep?.impression && <div className="text-sm mt-1"><span className="text-xs text-muted-foreground">Impression: </span>{rep.impression}</div>}
            </div>
          );
        })}
        {orders.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No radiology orders. Use Radiology module to add.</div>}
      </div>
    </Card>
  );
}

/* ----------------------------- VACCINATIONS ----------------------------- */
function VaccinationsTab({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [vaccine, setVaccine] = useState(""); const [dose, setDose] = useState("1"); const [batch, setBatch] = useState("");
  const [given, setGiven] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["vaccinations", patientId],
    queryFn: async () => (await supabase.from("vaccinations").select("*").eq("patient_id", patientId).order("given_date", { ascending: false })).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!vaccine.trim()) throw new Error("Vaccine required");
      const { error } = await supabase.from("vaccinations").insert({
        patient_id: patientId, vaccine_name: vaccine, dose_number: Number(dose) || 1,
        given_date: given, batch_no: batch || null, notes: notes || null,
        status: "given", administered_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setVaccine(""); setBatch(""); setNotes(""); toast.success("Vaccination recorded"); qc.invalidateQueries({ queryKey: ["vaccinations", patientId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("vaccinations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vaccinations", patientId] }),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-6">
        <h3 className="font-semibold mb-3">Add vaccination</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input className="md:col-span-2" placeholder="Vaccine name" value={vaccine} onChange={(e) => setVaccine(e.target.value)} />
          <Input type="number" placeholder="Dose #" value={dose} onChange={(e) => setDose(e.target.value)} />
          <Input type="date" value={given} onChange={(e) => setGiven(e.target.value)} />
          <Input placeholder="Batch #" value={batch} onChange={(e) => setBatch(e.target.value)} />
        </div>
        <Textarea className="mt-3" rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="mt-3" onClick={() => add.mutate()} disabled={add.isPending}>Save vaccination</Button>
      </Card>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">History</h3>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-3.5 mr-1.5" />Print</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground bg-surface-muted">
            <tr><th className="text-left px-3 py-2">Vaccine</th><th className="text-left py-2">Dose</th><th className="text-left py-2">Given on</th><th className="text-left py-2">Batch</th><th className="text-left py-2">Notes</th><th></th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r: any) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.vaccine_name}</td>
                <td className="py-2">{r.dose_number ?? "—"}</td>
                <td className="py-2">{r.given_date ?? "—"}</td>
                <td className="py-2">{r.batch_no ?? "—"}</td>
                <td className="py-2 text-xs text-muted-foreground truncate max-w-xs">{r.notes ?? ""}</td>
                <td className="text-right pr-3"><Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => del.mutate(r.id)}><Trash2 className="size-3.5" /></Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground text-sm">No vaccinations recorded.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* --------------------------------- BILLING -------------------------------- */
function BillingTab({ admission, days }: { admission: any; days: number }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const admissionId = admission.id;
  const patientId = admission.patient_id;

  const { data: bill, refetch: refetchBill } = useQuery({
    queryKey: ["ipd-bill", admissionId],
    queryFn: async () => (await supabase.from("bills").select("*, bill_items(*), payments(*)").eq("admission_id", admissionId).maybeSingle()).data,
  });

  const { data: lab = [] } = useQuery({
    queryKey: ["lab-bill", admissionId, patientId],
    queryFn: async () => (await supabase.from("lab_orders").select("order_no, total_amount, created_at").or(`admission_id.eq.${admissionId},patient_id.eq.${patientId}`)).data ?? [],
  });
  const { data: rad = [] } = useQuery({
    queryKey: ["rad-bill", admissionId, patientId],
    queryFn: async () => (await supabase.from("radiology_orders").select("modality, investigation, amount, created_at").or(`admission_id.eq.${admissionId},patient_id.eq.${patientId}`)).data ?? [],
  });
  const { data: pharm = [] } = useQuery({
    queryKey: ["pharm-bill", patientId],
    queryFn: async () => (await supabase.from("pharmacy_sales").select("invoice_no, total, created_at").eq("patient_id", patientId)).data ?? [],
  });

  const bedCharge = Number(admission.beds?.charge_per_day ?? 0) * days;
  const labTotal = lab.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
  const radTotal = rad.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
  const pharmTotal = pharm.reduce((s: number, r: any) => s + Number(r.total ?? 0), 0);

  const [extra, setExtra] = useState<{ id: string; description: string; category: string; quantity: string; unit_price: string }[]>([]);
  const [discount, setDiscount] = useState("0");
  const [gstPct, setGstPct] = useState("0");

  const aggregateItems = useMemo(() => {
    const items: { category: string; description: string; quantity: number; unit_price: number; amount: number }[] = [];
    if (bedCharge > 0) items.push({ category: "Bed", description: `Bed charges (${days} day${days > 1 ? "s" : ""})`, quantity: days, unit_price: Number(admission.beds?.charge_per_day ?? 0), amount: bedCharge });
    if (labTotal > 0) items.push({ category: "Lab", description: `Laboratory (${lab.length} orders)`, quantity: 1, unit_price: labTotal, amount: labTotal });
    if (radTotal > 0) items.push({ category: "Radiology", description: `Radiology (${rad.length} orders)`, quantity: 1, unit_price: radTotal, amount: radTotal });
    if (pharmTotal > 0) items.push({ category: "Pharmacy", description: `Pharmacy (${pharm.length} sales)`, quantity: 1, unit_price: pharmTotal, amount: pharmTotal });
    extra.forEach((e) => {
      const amt = (Number(e.quantity) || 0) * (Number(e.unit_price) || 0);
      if (amt > 0 && e.description) items.push({ category: e.category, description: e.description, quantity: Number(e.quantity), unit_price: Number(e.unit_price), amount: amt });
    });
    return items;
  }, [bedCharge, days, admission.beds?.charge_per_day, labTotal, lab.length, radTotal, rad.length, pharmTotal, pharm.length, extra]);

  const subtotal = aggregateItems.reduce((s, it) => s + it.amount, 0);
  const disc = Number(discount) || 0;
  const gst = ((subtotal - disc) * (Number(gstPct) || 0)) / 100;
  const total = subtotal - disc + gst;

  const saveBill = useMutation({
    mutationFn: async () => {
      const { data: billNo } = await supabase.rpc("gen_bill_no");
      let billId: string | undefined = bill?.id;
      if (!billId) {
        const { data, error } = await supabase.from("bills").insert({
          bill_no: billNo as string, admission_id: admissionId, patient_id: patientId, doctor_id: admission.doctor_id,
          subtotal, discount: disc, gst, total, paid: 0, pending: total,
          status: total > 0 ? "draft" : "paid",
          created_by: user?.id ?? null,
        }).select("id").single();
        if (error) throw error;
        billId = data.id;
      } else {
        const paid = Number(bill!.paid ?? 0);
        const nextStatus: "paid" | "partial" | "draft" = paid >= total ? "paid" : paid > 0 ? "partial" : "draft";
        await supabase.from("bills").update({ subtotal, discount: disc, gst, total, pending: Math.max(0, total - paid), status: nextStatus }).eq("id", billId);
        await supabase.from("bill_items").delete().eq("bill_id", billId);
      }
      if (aggregateItems.length > 0) {
        await supabase.from("bill_items").insert(aggregateItems.map((it, idx) => ({ ...it, bill_id: billId, position: idx })));
      }
    },
    onSuccess: () => { toast.success("Bill saved"); refetchBill(); qc.invalidateQueries({ queryKey: ["ipd-bill", admissionId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const [payAmt, setPayAmt] = useState(""); const [payMethod, setPayMethod] = useState<"cash" | "upi" | "card" | "bank_transfer">("cash"); const [payRef, setPayRef] = useState("");
  const collect = useMutation({
    mutationFn: async () => {
      if (!bill?.id) throw new Error("Save bill first");
      const amt = Number(payAmt);
      if (!amt || amt <= 0) throw new Error("Enter amount");
      const { error } = await supabase.from("payments").insert({ bill_id: bill.id, amount: amt, method: payMethod, reference: payRef || null, created_by: user?.id ?? null });
      if (error) throw error;
      const newPaid = Number(bill.paid ?? 0) + amt;
      const newPending = Math.max(0, Number(bill.total) - newPaid);
      await supabase.from("bills").update({ paid: newPaid, pending: newPending, status: newPending <= 0 ? "paid" : "partial" }).eq("id", bill.id);
    },
    onSuccess: () => { setPayAmt(""); setPayRef(""); toast.success("Payment recorded"); refetchBill(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">IPD bill summary</h3>
            {bill && <div className="text-xs text-muted-foreground mt-0.5">Invoice <span className="font-mono">{bill.bill_no}</span> · <Badge variant="outline" className="capitalize">{bill.status}</Badge></div>}
          </div>
          <div className="flex gap-2">
            {bill && <Button asChild variant="outline" size="sm"><Link to="/billing/$id" params={{ id: bill.id }}><Receipt className="size-3.5 mr-1.5" />Open invoice</Link></Button>}
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-3.5 mr-1.5" />Print</Button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-muted">
              <tr><th className="text-left px-6 py-2">Category</th><th className="text-left py-2">Description</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Rate</th><th className="text-right px-6 py-2">Amount</th></tr>
            </thead>
            <tbody className="divide-y">
              {aggregateItems.map((it, i) => (
                <tr key={i}><td className="px-6 py-2"><Badge variant="secondary">{it.category}</Badge></td><td className="py-2">{it.description}</td><td className="text-right py-2 tabular-nums">{it.quantity}</td><td className="text-right py-2 tabular-nums">₹{it.unit_price.toLocaleString("en-IN")}</td><td className="text-right px-6 py-2 tabular-nums font-medium">₹{it.amount.toLocaleString("en-IN")}</td></tr>
              ))}
              {aggregateItems.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-sm">No charges yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Custom charges (doctor / nursing / procedure)</h4>
            <Button size="sm" variant="outline" onClick={() => setExtra([...extra, { id: crypto.randomUUID(), description: "", category: "Doctor", quantity: "1", unit_price: "" }])}><Plus className="size-3.5 mr-1.5" />Add</Button>
          </div>
          <div className="space-y-2">
            {extra.map((e) => (
              <div key={e.id} className="grid grid-cols-12 gap-2">
                <Select value={e.category} onValueChange={(v) => setExtra(extra.map((x) => x.id === e.id ? { ...x, category: v } : x))}>
                  <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Doctor", "Nursing", "Procedure", "Consumable", "Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="col-span-5" placeholder="Description" value={e.description} onChange={(ev) => setExtra(extra.map((x) => x.id === e.id ? { ...x, description: ev.target.value } : x))} />
                <Input type="number" className="col-span-2" placeholder="Qty" value={e.quantity} onChange={(ev) => setExtra(extra.map((x) => x.id === e.id ? { ...x, quantity: ev.target.value } : x))} />
                <Input type="number" className="col-span-2" placeholder="Rate" value={e.unit_price} onChange={(ev) => setExtra(extra.map((x) => x.id === e.id ? { ...x, unit_price: ev.target.value } : x))} />
                <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground hover:text-destructive" onClick={() => setExtra(extra.filter((x) => x.id !== e.id))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t">
          <div className="space-y-1"><Label>Discount (₹)</Label><Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          <div className="space-y-1"><Label>GST (%)</Label><Input type="number" value={gstPct} onChange={(e) => setGstPct(e.target.value)} /></div>
          <div className="md:col-span-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−₹{disc.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="tabular-nums">₹{gst.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t"><span>Total</span><span className="tabular-nums">₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={() => saveBill.mutate()} disabled={saveBill.isPending || aggregateItems.length === 0}>{bill ? "Update bill" : "Generate bill"}</Button>
        </div>
      </Card>

      {bill && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Collect payment</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <div className="md:col-span-2 text-sm">
              <div className="text-muted-foreground text-xs">Outstanding</div>
              <div className="text-2xl font-semibold tabular-nums">₹{Number(bill.pending).toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground mt-1">Paid ₹{Number(bill.paid).toLocaleString("en-IN")} of ₹{Number(bill.total).toLocaleString("en-IN")}</div>
            </div>
            <Input type="number" placeholder="Amount" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
            <Select value={payMethod} onValueChange={(v) => setPayMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["cash", "upi", "card", "bank_transfer"].map((m) => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Reference (optional)" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
          </div>
          <Button onClick={() => collect.mutate()} disabled={collect.isPending || Number(bill.pending) <= 0}>Record payment</Button>

          {(bill.payments ?? []).length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="text-xs text-muted-foreground mb-2">Payment history</div>
              {bill.payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2"><Badge variant="outline" className="capitalize">{p.method}</Badge>{p.reference && <span className="text-xs text-muted-foreground">{p.reference}</span>}</div>
                  <div className="flex items-center gap-3"><span className="tabular-nums">₹{Number(p.amount).toLocaleString("en-IN")}</span><span className="text-xs text-muted-foreground">{format(new Date(p.paid_at), "dd MMM, p")}</span></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
