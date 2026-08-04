import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SignatureCanvas from "react-signature-canvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useIsSuperAdmin } from "@/lib/use-super-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DictateTextarea } from "@/components/dictate-textarea";
import { useHospitalProfile } from "@/components/print-header";
import { logAudit } from "@/lib/audit";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileSignature, Plus, Printer, Search, Trash2, MessageCircle, Mail, Eraser } from "lucide-react";

export const CONSENT_TYPES = [
  "General Consent", "Admission Consent", "Operation Consent", "Surgery Consent",
  "Anesthesia Consent", "Blood Transfusion Consent", "High Risk Consent", "Procedure Consent",
  "Radiology Consent", "CT Scan Consent", "MRI Consent", "Endoscopy Consent",
  "Dialysis Consent", "Chemotherapy Consent", "ICU Consent", "Vaccination Consent",
  "Discharge Against Medical Advice (DAMA)", "Custom Consent",
];

function templateBody(type: string, ctx: { hospital: string; patient: string; uhid: string; age: string; gender: string; doctor: string; department: string; procedure: string; diagnosis: string }) {
  const head = `I, ${ctx.patient || "____________"} (UHID: ${ctx.uhid || "____"}, Age/Sex: ${ctx.age || "__"}/${ctx.gender || "__"}), currently under the care of ${ctx.doctor || "Dr. ____________"} in the ${ctx.department || "____"} department at ${ctx.hospital}, hereby state the following:`;
  const common = [
    `1. The nature of my condition${ctx.diagnosis ? ` (${ctx.diagnosis})` : ""} has been explained to me in a language I understand.`,
    `2. The proposed ${ctx.procedure || "treatment/procedure"}, its purpose, benefits, alternatives, and possible risks and complications have been explained to me.`,
    `3. I have been given the opportunity to ask questions and all my questions have been answered to my satisfaction.`,
    `4. I understand that no guarantee has been given to me about the result of the treatment.`,
    `5. I give my consent voluntarily, without any pressure, and I may withdraw it at any time before the procedure begins.`,
  ];
  const extra: Record<string, string[]> = {
    "Anesthesia Consent": ["6. I consent to the administration of anesthesia (general/regional/local) as considered appropriate by the anesthetist, including its known risks."],
    "Blood Transfusion Consent": ["6. I consent to the transfusion of blood and/or blood products and understand the associated risks including transfusion reactions and infections."],
    "High Risk Consent": ["6. I understand that this case is HIGH RISK and that the outcome may include serious complications or death despite the best medical care."],
    "Discharge Against Medical Advice (DAMA)": [
      "6. I am leaving the hospital AGAINST MEDICAL ADVICE at my own risk and responsibility.",
      "7. The possible consequences of leaving, including deterioration and death, have been explained to me.",
      "8. I release the hospital and the treating team from all liability arising out of this decision.",
    ],
    "ICU Consent": ["6. I consent to ICU care including monitoring, ventilation, central lines and other supportive measures as required."],
    "Chemotherapy Consent": ["6. I consent to chemotherapy and understand its side effects including nausea, hair loss, infection risk and marrow suppression."],
    "Dialysis Consent": ["6. I consent to dialysis sessions and understand the risks of vascular access, hypotension and infection."],
  };
  return [head, "", ...common, ...(extra[type] ?? [])].join("\n");
}

type Row = any;

export function ConsentForms({ patientId, patient }: { patientId?: string; patient?: any }) {
  const { user, profile } = useAuth();
  const canDelete = useIsSuperAdmin();
  const qc = useQueryClient();
  const { data: hospital } = useHospitalProfile();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["consent-forms", patientId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("consent_forms")
        .select("*, patients(id, full_name, uhid, mobile, dob, gender), doctors(name)")
        .order("created_at", { ascending: false });
      if (patientId) q = q.eq("patient_id", patientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (rows as Row[]).filter((r) => {
      if (typeFilter !== "all" && r.form_type !== typeFilter) return false;
      if (statusFilter !== "all" && (r.status ?? "draft") !== statusFilter) return false;
      if (from && new Date(r.created_at) < new Date(from)) return false;
      if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
      if (!s) return true;
      return [r.patients?.full_name, r.patients?.uhid, r.doctors?.name, r.department, r.form_type, r.procedure]
        .filter(Boolean).some((x: string) => x.toLowerCase().includes(s));
    });
  }, [rows, search, typeFilter, statusFilter, from, to]);

  const remove = async (row: Row) => {
    const { error } = await (supabase as any).from("consent_forms").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await logAudit({ action: "delete", entity: "consent_forms", entityId: row.id, before: row });
    toast.success("Consent form deleted");
    qc.invalidateQueries({ queryKey: ["consent-forms"] });
  };

  const shareWhatsApp = (row: Row) => {
    const phone = (row.patients?.mobile ?? patient?.mobile ?? "").replace(/\D/g, "");
    const text = `*${row.form_type}* — ${row.patients?.full_name ?? patient?.full_name ?? ""} (${row.patients?.uhid ?? patient?.uhid ?? ""})\nDate: ${format(new Date(row.created_at), "dd MMM yyyy")}\nStatus: ${row.status ?? "draft"}\n${window.location.origin}/consent/${row.id}/print`;
    logAudit({ action: "share", entity: "consent_forms", entityId: row.id });
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };
  const shareEmail = (row: Row) => {
    logAudit({ action: "share", entity: "consent_forms", entityId: row.id });
    window.open(`mailto:?subject=${encodeURIComponent(row.form_type)}&body=${encodeURIComponent(`${window.location.origin}/consent/${row.id}/print`)}`);
  };
  const openPrint = (row: Row) => {
    logAudit({ action: "print", entity: "consent_forms", entityId: row.id });
    window.open(`/consent/${row.id}/print`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search UHID, patient, doctor, department…" className="h-9 pl-8" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[190px]"><SelectValue placeholder="Consent type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem>{CONSENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="signed">Signed</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
        <Button className="ml-auto" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-1.5" />New consent
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No consent forms yet.</div>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 p-3 hover:bg-muted/40">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileSignature className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{r.form_type}{r.procedure ? ` — ${r.procedure}` : ""}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.patients?.full_name ?? "—"} · UHID {r.patients?.uhid ?? "—"}
                    {r.doctors?.name ? ` · Dr. ${r.doctors.name}` : ""}{r.department ? ` · ${r.department}` : ""}
                    {" · "}{format(new Date(r.created_at), "dd MMM yyyy HH:mm")}
                  </div>
                </div>
                <Badge variant={(r.status ?? "draft") === "signed" ? "default" : "secondary"} className="rounded-full">{r.status ?? "draft"}</Badge>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
                  <Button size="icon" variant="ghost" title="Print / PDF" onClick={() => openPrint(r)}><Printer className="size-4" /></Button>
                  <Button size="icon" variant="ghost" title="WhatsApp" onClick={() => shareWhatsApp(r)}><MessageCircle className="size-4" /></Button>
                  <Button size="icon" variant="ghost" title="Email" onClick={() => shareEmail(r)}><Mail className="size-4" /></Button>
                  {canDelete && <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit consent form" : "New consent form"}</DialogTitle></DialogHeader>
          <ConsentEditor
            key={editing?.id ?? "new"}
            row={editing}
            patientId={patientId}
            patient={patient}
            hospitalName={hospital?.hospital_name ?? ""}
            userId={user?.id ?? null}
            userName={profile?.full_name ?? user?.email ?? null}
            onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["consent-forms"] }); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- editor ---------------- */

function SignaturePad({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<any>(null);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button type="button" size="sm" variant="ghost" onClick={() => { ref.current?.clear(); onChange(null); }}>
          <Eraser className="size-3.5 mr-1" />Clear
        </Button>
      </div>
      {value ? (
        <img src={value} alt={label} className="h-24 w-full rounded-md border bg-background object-contain" onClick={() => onChange(null)} />
      ) : (
        <div className="rounded-md border bg-background touch-none">
          <SignatureCanvas
            ref={ref}
            penColor="#111827"
            canvasProps={{ className: "w-full h-24 rounded-md", style: { touchAction: "none" } }}
            onEnd={() => onChange(ref.current?.toDataURL("image/png") ?? null)}
          />
        </div>
      )}
    </div>
  );
}

function ConsentEditor({
  row, patientId, patient, hospitalName, userId, userName, onSaved,
}: {
  row: Row | null; patientId?: string; patient?: any; hospitalName: string;
  userId: string | null; userName: string | null; onSaved: () => void;
}) {
  const [pid, setPid] = useState<string | null>(row?.patient_id ?? patientId ?? null);
  const [pat, setPat] = useState<any>(row?.patients ?? patient ?? null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>(row?.form_type ?? "General Consent");
  const [procedure, setProcedure] = useState(row?.procedure ?? "");
  const [diagnosis, setDiagnosis] = useState(row?.diagnosis ?? "");
  const [department, setDepartment] = useState(row?.department ?? "");
  const [doctorId, setDoctorId] = useState<string | null>(row?.doctor_id ?? null);
  const [content, setContent] = useState(row?.content ?? "");
  const [witnessName, setWitnessName] = useState(row?.witness_name ?? "");
  const [witnessRelation, setWitnessRelation] = useState(row?.witness_relation ?? "");
  const [patientSig, setPatientSig] = useState<string | null>(row?.patient_signature ?? null);
  const [doctorSig, setDoctorSig] = useState<string | null>(row?.doctor_signature ?? null);
  const [witnessSig, setWitnessSig] = useState<string | null>(row?.witness_signature ?? null);
  const [saving, setSaving] = useState(false);

  const { data: doctors = [] } = useQuery({
    queryKey: ["consent-doctors"],
    queryFn: async () => (await (supabase as any).from("doctors").select("id, name, specialization").order("name")).data ?? [],
  });
  const { data: results = [] } = useQuery({
    queryKey: ["consent-patient-search", q],
    enabled: !pid && q.trim().length >= 2,
    queryFn: async () => {
      const like = `%${q.trim()}%`;
      return (await (supabase as any).from("patients").select("id, full_name, uhid, mobile, dob, gender")
        .or(`full_name.ilike.${like},mobile.ilike.${like},uhid.ilike.${like}`).limit(20)).data ?? [];
    },
  });

  const age = pat?.dob ? String(new Date().getFullYear() - new Date(pat.dob).getFullYear()) : "";
  const doctorName = doctors.find((d: any) => d.id === doctorId)?.name;

  const fillTemplate = () => {
    setContent(templateBody(type, {
      hospital: hospitalName, patient: pat?.full_name ?? "", uhid: pat?.uhid ?? "",
      age, gender: pat?.gender ?? "", doctor: doctorName ? `Dr. ${doctorName}` : "",
      department, procedure, diagnosis,
    }));
  };

  const save = async () => {
    if (!pid) return toast.error("Select a patient first.");
    setSaving(true);
    try {
      const signed = !!(patientSig || doctorSig);
      const payload: any = {
        patient_id: pid, form_type: type, procedure: procedure || null, diagnosis: diagnosis || null,
        department: department || null, doctor_id: doctorId, content: content || null,
        witness_name: witnessName || null, witness_relation: witnessRelation || null,
        patient_signature: patientSig, doctor_signature: doctorSig, witness_signature: witnessSig,
        signature_data: patientSig, signed, signed_at: signed ? new Date().toISOString() : null,
        status: signed ? "signed" : "draft", created_by: userId,
      };
      let id = row?.id as string | undefined;
      if (id) {
        const { error } = await (supabase as any).from("consent_forms").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("consent_forms").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      await logAudit({ action: row?.id ? "update" : "create", entity: "consent_forms", entityId: id ?? null, after: { ...payload, patient_signature: !!patientSig, doctor_signature: !!doctorSig, witness_signature: !!witnessSig } });

      // File a copy under the patient's documents so it appears in Document Management.
      try {
        const html = `<!doctype html><meta charset="utf-8"/><title>${type}</title><body style="font-family:system-ui;max-width:760px;margin:32px auto"><h2>${type}</h2><p><b>Patient:</b> ${pat?.full_name ?? ""} (UHID ${pat?.uhid ?? ""})</p><pre style="white-space:pre-wrap;font:13px/1.6 system-ui">${(content ?? "").replace(/[<>&]/g, "")}</pre></body>`;
        const blob = new Blob([html], { type: "text/html" });
        const path = `${pid}/consent/${Date.now()}-${type.replace(/[^\w]+/g, "-")}.html`;
        await supabase.storage.from("patient-documents").upload(path, blob, { contentType: "text/html", upsert: true });
        await (supabase as any).from("patient_documents").insert({
          patient_id: pid, department: "Consent Forms", file_name: `${type}.html`, file_type: "text/html",
          file_size: blob.size, storage_path: path, description: procedure || type,
          uploaded_by: userId, uploaded_by_name: userName,
        });
        await (supabase as any).from("consent_forms").update({ storage_path: path }).eq("id", id);
      } catch { /* filing failure must not block the consent record */ }

      toast.success(row?.id ? "Consent form updated" : "Consent form saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save consent form");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {!pid ? (
        <div className="space-y-2">
          <Label>Select patient</Label>
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, UHID or mobile…" />
          <div className="max-h-56 overflow-y-auto divide-y rounded-lg border">
            {results.map((p: any) => (
              <button key={p.id} onClick={() => { setPid(p.id); setPat(p); }} className="w-full text-left p-2.5 hover:bg-muted/50">
                <div className="text-sm font-medium">{p.full_name}</div>
                <div className="text-xs text-muted-foreground">{p.uhid} · {p.mobile}</div>
              </button>
            ))}
            {q.trim().length < 2 && <div className="p-3 text-xs text-muted-foreground text-center">Type at least 2 characters.</div>}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-2.5 text-sm flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{pat?.full_name ?? "Patient"}</div>
            <div className="text-xs text-muted-foreground truncate">UHID {pat?.uhid ?? "—"} · {age ? `${age}y` : ""} {pat?.gender ?? ""}</div>
          </div>
          {!patientId && <Button variant="ghost" size="sm" onClick={() => { setPid(null); setPat(null); }}>Change</Button>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Consent type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">{CONSENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Treating doctor</Label>
          <Select value={doctorId ?? ""} onValueChange={setDoctorId}>
            <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
            <SelectContent className="max-h-72">{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Department</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
        <div className="space-y-1"><Label>Procedure</Label><Input value={procedure} onChange={(e) => setProcedure(e.target.value)} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Diagnosis</Label><Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={fillTemplate}>Auto-fill template</Button>
      </div>

      <DictateTextarea label="Consent text" rows={10} value={content} onChange={setContent} placeholder="Use “Auto-fill template” or dictate the consent text…" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Witness name</Label><Input value={witnessName} onChange={(e) => setWitnessName(e.target.value)} /></div>
        <div className="space-y-1"><Label>Relation with patient</Label><Input value={witnessRelation} onChange={(e) => setWitnessRelation(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SignaturePad label="Patient signature" value={patientSig} onChange={setPatientSig} />
        <SignaturePad label="Doctor signature" value={doctorSig} onChange={setDoctorSig} />
        <SignaturePad label="Witness signature" value={witnessSig} onChange={setWitnessSig} />
      </div>

      <div className="flex justify-end gap-2 flex-wrap">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save consent"}</Button>
      </div>
    </div>
  );
}
