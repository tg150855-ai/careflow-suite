import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/ipd/new")({
  component: NewAdmission,
  validateSearch: (s: Record<string, unknown>) => ({ patientId: typeof s.patientId === "string" ? s.patientId : undefined }),
});

const Schema = z.object({
  patient_id: z.string().uuid("Select a patient"),
  doctor_id: z.string().uuid("Select a doctor"),
  ward_id: z.string().uuid("Select a ward"),
  bed_id: z.string().uuid("Select a bed"),
  department_id: z.string().uuid().optional().nullable(),
  reason: z.string().max(500).optional(),
  initial_diagnosis: z.string().max(500).optional(),
  attender_name: z.string().max(120).optional(),
  attender_mobile: z.string().max(20).optional(),
  emergency_contact: z.string().max(120).optional(),
  insurance_provider: z.string().max(120).optional(),
  insurance_policy_no: z.string().max(120).optional(),
  estimated_stay_days: z.number().min(0).max(365).optional(),
  is_emergency: z.boolean().default(false),
});

function NewAdmission() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { patientId: presetPatient } = useSearch({ from: "/_authenticated/ipd/new" });

  const [patientQ, setPatientQ] = useState("");
  const [patientId, setPatientId] = useState<string | null>(presetPatient ?? null);
  const [patient, setPatient] = useState<any>(null);
  const [doctorId, setDoctorId] = useState<string>("");
  const [wardId, setWardId] = useState<string>("");
  const [bedId, setBedId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [attender, setAttender] = useState("");
  const [attenderMobile, setAttenderMobile] = useState("");
  const [emergency, setEmergency] = useState("");
  const [insProvider, setInsProvider] = useState("");
  const [insPolicy, setInsPolicy] = useState("");
  const [estDays, setEstDays] = useState<number>(3);
  const [isEmergency, setIsEmergency] = useState(false);

  const { data: doctors = [] } = useQuery({ queryKey: ["doctors"], queryFn: async () => (await supabase.from("doctors").select("id, name, specialization").eq("active", true).order("name")).data ?? [] });
  const { data: wards = [] } = useQuery({ queryKey: ["wards"], queryFn: async () => (await supabase.from("wards").select("id, name, type").order("name")).data ?? [] });
  const { data: beds = [] } = useQuery({
    queryKey: ["beds-available", wardId],
    enabled: !!wardId,
    queryFn: async () => (await supabase.from("beds").select("id, bed_number, status, charge_per_day").eq("ward_id", wardId).eq("status", "available").order("bed_number")).data ?? [],
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["pt-search", patientQ],
    enabled: patientQ.length >= 2 && !patientId,
    queryFn: async () => {
      const term = `%${patientQ}%`;
      return (await supabase.from("patients").select("id, full_name, uhid, mobile, gender").or(`full_name.ilike.${term},mobile.ilike.${term},uhid.ilike.${term}`).limit(8)).data ?? [];
    },
  });

  useEffect(() => {
    if (!patientId) { setPatient(null); return; }
    supabase.from("patients").select("*").eq("id", patientId).single().then(({ data }) => setPatient(data));
  }, [patientId]);

  useEffect(() => { setBedId(""); }, [wardId]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = Schema.parse({
        patient_id: patientId ?? "",
        doctor_id: doctorId,
        ward_id: wardId,
        bed_id: bedId,
        reason, initial_diagnosis: diagnosis,
        attender_name: attender, attender_mobile: attenderMobile, emergency_contact: emergency,
        insurance_provider: insProvider, insurance_policy_no: insPolicy,
        estimated_stay_days: estDays, is_emergency: isEmergency,
      });
      // Create admission
      const { data: adm, error } = await supabase.from("admissions").insert({
        ...parsed,
        created_by: user?.id ?? null,
      }).select("id, admission_no").single();
      if (error) throw error;
      // Mark bed occupied
      await supabase.from("beds").update({ status: "occupied" }).eq("id", bedId);
      return adm;
    },
    onSuccess: (a) => { toast.success(`Admission ${a.admission_no} created`); navigate({ to: "/ipd/$id", params: { id: a.id } }); },
    onError: (e: any) => toast.error(e.message ?? "Failed to admit"),
  });

  const canSubmit = patientId && doctorId && wardId && bedId;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/ipd"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New admission</h1>
          <p className="text-sm text-muted-foreground">Admit patient to in-patient department</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Patient</h2>
            {!patient ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input autoFocus value={patientQ} onChange={(e) => setPatientQ(e.target.value)} placeholder="Search by name, mobile or UHID..." className="pl-9" />
                </div>
                {patientQ.length >= 2 && (
                  <div className="border rounded-xl divide-y max-h-64 overflow-y-auto">
                    {patients.length === 0 && <div className="p-4 text-sm text-muted-foreground">No patients found. <Link to="/patients/new" className="text-primary underline">Register new</Link></div>}
                    {patients.map((p: any) => (
                      <button key={p.id} onClick={() => { setPatientId(p.id); setPatientQ(""); }} className="w-full text-left p-3 hover:bg-surface-muted flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">{p.full_name.slice(0, 2).toUpperCase()}</div>
                        <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{p.full_name}</div><div className="text-xs text-muted-foreground">{p.uhid} · {p.mobile}</div></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><User className="size-4" /></div>
                  <div><div className="font-medium">{patient.full_name}</div><div className="text-xs text-muted-foreground">{patient.uhid} · {patient.mobile} · {patient.gender}</div></div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setPatientId(null); setPatient(null); }}>Change</Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-4">Clinical</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Treating doctor</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}{d.specialization ? ` · ${d.specialization}` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Estimated stay (days)</Label>
                <Input type="number" min={0} value={estDays} onChange={(e) => setEstDays(Number(e.target.value))} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Admission reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Acute appendicitis" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Initial diagnosis</Label>
                <Textarea rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Provisional diagnosis & clinical impression" />
              </div>
              <label className="flex items-center gap-2 md:col-span-2 mt-1">
                <Checkbox checked={isEmergency} onCheckedChange={(v) => setIsEmergency(!!v)} />
                <span className="text-sm">Emergency admission</span>
              </label>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-4">Attender & insurance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><Label>Attender name</Label><Input value={attender} onChange={(e) => setAttender(e.target.value)} /></div>
              <div className="space-y-1"><Label>Attender mobile</Label><Input value={attenderMobile} onChange={(e) => setAttenderMobile(e.target.value)} /></div>
              <div className="space-y-1 md:col-span-2"><Label>Emergency contact</Label><Input value={emergency} onChange={(e) => setEmergency(e.target.value)} placeholder="Name & relation & phone" /></div>
              <div className="space-y-1"><Label>Insurance provider</Label><Input value={insProvider} onChange={(e) => setInsProvider(e.target.value)} /></div>
              <div className="space-y-1"><Label>Policy no.</Label><Input value={insPolicy} onChange={(e) => setInsPolicy(e.target.value)} /></div>
            </div>
          </Card>
        </div>

        <Card className="p-6 h-fit lg:sticky lg:top-20 space-y-4">
          <h2 className="font-semibold">Bed allocation</h2>
          <div className="space-y-1">
            <Label>Ward</Label>
            <Select value={wardId} onValueChange={setWardId}>
              <SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger>
              <SelectContent>{wards.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Bed</Label>
            <Select value={bedId} onValueChange={setBedId} disabled={!wardId}>
              <SelectTrigger><SelectValue placeholder={wardId ? "Select bed" : "Select ward first"} /></SelectTrigger>
              <SelectContent>
                {beds.length === 0 && wardId && <div className="px-3 py-2 text-xs text-muted-foreground">No available beds in this ward</div>}
                {beds.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.bed_number} · ₹{Number(b.charge_per_day).toLocaleString()}/day</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" size="lg" disabled={!canSubmit || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Admitting…" : "Confirm admission"}</Button>
        </Card>
      </div>
    </div>
  );
}
