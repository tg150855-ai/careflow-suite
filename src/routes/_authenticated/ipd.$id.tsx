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
import { ArrowLeft, Activity, Stethoscope, Pill, ClipboardList, LogOut, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/ipd/$id")({ component: AdmissionDetail });

function AdmissionDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: adm } = useQuery({
    queryKey: ["admission", id],
    queryFn: async () => (await supabase.from("admissions").select("*, patients(*), doctors(name, specialization), wards(name, type), beds(bed_number, charge_per_day)").eq("id", id).single()).data,
  });

  if (!adm) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const days = differenceInDays(new Date(), new Date(adm.admitted_at)) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="icon"><Link to="/ipd"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{adm.patients?.full_name}</h1>
            <Badge variant="secondary" className="font-mono">{adm.admission_no}</Badge>
            <Badge variant={adm.status === "active" ? "default" : "outline"} className="capitalize">{adm.status}</Badge>
            {adm.is_emergency && <Badge className="bg-destructive/10 text-destructive border-destructive/20" variant="outline">Emergency</Badge>}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {adm.patients?.uhid} · {adm.patients?.mobile} · Bed {adm.beds?.bed_number ?? "—"} ({adm.wards?.name}) · Day {days}
          </div>
        </div>
        {adm.status === "active" && (
          <Button asChild variant="default"><Link to="/ipd/$id/discharge" params={{ id }}><LogOut className="size-4 mr-2" />Discharge</Link></Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard label="Admitted on" value={format(new Date(adm.admitted_at), "dd MMM yyyy, p")} />
        <InfoCard label="Treating doctor" value={adm.doctors?.name ?? "—"} sub={adm.doctors?.specialization} />
        <InfoCard label="Reason" value={adm.reason ?? "—"} />
        <InfoCard label="Estimated stay" value={adm.estimated_stay_days ? `${adm.estimated_stay_days} days` : "—"} />
      </div>

      <Tabs defaultValue="vitals">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="vitals"><Activity className="size-3.5 mr-1.5" />Vitals</TabsTrigger>
          <TabsTrigger value="rounds"><Stethoscope className="size-3.5 mr-1.5" />Doctor rounds</TabsTrigger>
          <TabsTrigger value="mar"><Pill className="size-3.5 mr-1.5" />Medication (MAR)</TabsTrigger>
          <TabsTrigger value="nursing"><ClipboardList className="size-3.5 mr-1.5" />Nursing notes</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="vitals"><VitalsTab admissionId={id} patientId={adm.patient_id} /></TabsContent>
        <TabsContent value="rounds"><RoundsTab admissionId={id} doctorId={adm.doctor_id} /></TabsContent>
        <TabsContent value="mar"><MARTab admissionId={id} /></TabsContent>
        <TabsContent value="nursing"><NursingTab admissionId={id} /></TabsContent>
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

function VitalsTab({ admissionId, patientId }: { admissionId: string; patientId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [systolic, setSystolic] = useState(""); const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState(""); const [temp, setTemp] = useState("");
  const [ox, setOx] = useState(""); const [sugar, setSugar] = useState(""); const [weight, setWeight] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["vitals", admissionId],
    queryFn: async () => (await supabase.from("vitals").select("*").eq("admission_id", admissionId).order("recorded_at", { ascending: false })).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vitals").insert({
        admission_id: admissionId, patient_id: patientId,
        systolic: systolic ? Number(systolic) : null, diastolic: diastolic ? Number(diastolic) : null,
        pulse: pulse ? Number(pulse) : null, temperature: temp ? Number(temp) : null,
        oxygen: ox ? Number(ox) : null, sugar: sugar ? Number(sugar) : null, weight: weight ? Number(weight) : null,
        recorded_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSystolic(""); setDiastolic(""); setPulse(""); setTemp(""); setOx(""); setSugar(""); setWeight("");
      toast.success("Vitals recorded");
      qc.invalidateQueries({ queryKey: ["vitals", admissionId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Record vitals</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Field label="Systolic" value={systolic} onChange={setSystolic} unit="mmHg" />
          <Field label="Diastolic" value={diastolic} onChange={setDiastolic} unit="mmHg" />
          <Field label="Pulse" value={pulse} onChange={setPulse} unit="bpm" />
          <Field label="Temp" value={temp} onChange={setTemp} unit="°F" />
          <Field label="SpO₂" value={ox} onChange={setOx} unit="%" />
          <Field label="Sugar" value={sugar} onChange={setSugar} unit="mg/dL" />
          <Field label="Weight" value={weight} onChange={setWeight} unit="kg" />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="mt-4">Save reading</Button>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-3">History</h3>
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
                <th className="text-right font-medium px-6 py-2">Weight</th>
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
                  <td className="text-right tabular-nums px-6 py-2">{r.weight ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">No vitals recorded yet.</td></tr>}
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

  return (
    <div className="space-y-4 mt-4">
      {canWrite && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">New round entry</h3>
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
              <div className="text-xs text-muted-foreground">{format(new Date(r.rounded_at), "dd MMM yyyy, p")}</div>
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
        <h3 className="font-semibold mb-3">Schedule</h3>
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
                      {it.status === "scheduled" && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: it.id, status: "administered" })}>Given</Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: it.id, status: "missed" })}>Miss</Button>
                        </div>
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

function NursingTab({ admissionId }: { admissionId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
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

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-6">
        <h3 className="font-semibold mb-3">Add nursing note</h3>
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
              <div className="text-xs text-muted-foreground">{format(new Date(n.created_at), "dd MMM, p")}</div>
            </div>
            <div className="text-sm whitespace-pre-wrap mt-2">{n.note}</div>
          </Card>
        ))}
        {notes.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No nursing notes yet.</Card>}
      </div>
    </div>
  );
}
