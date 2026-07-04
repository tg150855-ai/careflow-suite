import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Skull } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { RecordActions } from "@/components/common/record-actions";
import { ModuleActionBar } from "@/components/common/action-bar";
import { SearchBox } from "@/components/common/search-box";
import { DayMonthYearTabs, useDateRange } from "@/components/common/date-range-tabs";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";
import { exportXlsx, printPage } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/ipd/death-register")({ component: DeathRegister });

function DeathRegister() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { range, preset, setPreset } = useDateRange("month");

  const { data: rows = [] } = useQuery({
    queryKey: ["death-register"],
    queryFn: async () => (await supabase.from("death_register").select("*, patients(full_name, uhid, gender, dob, mobile), admissions(admission_no)").order("died_at", { ascending: false })).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("death_register").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["death-register"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const inRange = (d?: string | null) => {
    if (!d || preset === "all") return true;
    const t = new Date(d).getTime();
    return t >= range.from.getTime() && t <= range.to.getTime();
  };

  const filtered = useMemo(() => (rows as any[]).filter((r) => {
    if (!inRange(r.died_at)) return false;
    if (!search) return true;
    const hay = `${r.patients?.full_name ?? ""} ${r.patients?.uhid ?? ""} ${r.admissions?.admission_no ?? ""} ${r.cause_of_death ?? ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  }), [rows, search, range, preset]);

  const doExport = () => exportXlsx(
    filtered.map((r) => ({
      Patient: r.patients?.full_name, UHID: r.patients?.uhid, Admission: r.admissions?.admission_no,
      "Died at": r.died_at, Cause: r.cause_of_death, Doctor: r.certifying_doctor_name, Place: r.place_of_death,
    })),
    `death-register-${format(new Date(), "yyyyMMdd")}.xlsx`,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Skull className="size-5" />Death register</h1>
          <p className="text-sm text-muted-foreground mt-1">Mortality records with audit trail.</p>
        </div>
        <NewDeathDialog />
      </div>

      <ModuleActionBar
        leading={<SearchBox value={search} onChange={setSearch} placeholder="Search patient, UHID, admission, cause…" />}
        onExport={doExport}
        onPrint={printPage}
        extra={<DayMonthYearTabs value={preset} onChange={setPreset} />}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-muted">
              <tr>
                <th className="text-left font-medium px-4 py-2">Patient</th>
                <th className="text-left font-medium py-2">UHID</th>
                <th className="text-left font-medium py-2">Admission</th>
                <th className="text-left font-medium py-2">Date / time</th>
                <th className="text-left font-medium py-2">Cause</th>
                <th className="text-left font-medium py-2">Certified by</th>
                <th className="text-right font-medium px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium">{r.patients?.full_name}</td>
                  <td className="py-2 font-mono text-xs">{r.patients?.uhid}</td>
                  <td className="py-2 font-mono text-xs">{r.admissions?.admission_no ?? "—"}</td>
                  <td className="py-2">{format(new Date(r.died_at), "dd MMM yyyy, p")}</td>
                  <td className="py-2 max-w-xs truncate">{r.cause_of_death}</td>
                  <td className="py-2">{r.certifying_doctor_name ?? "—"}</td>
                  <td className="text-right px-4 py-2">
                    <RecordActions
                      size="icon"
                      deleteLabel={`death record for ${r.patients?.full_name ?? "patient"}`}
                      onPrint={() => window.print()}
                      onWhatsApp={() => shareOnWhatsApp(
                        summarizeRecord("Death Record", {
                          Patient: r.patients?.full_name,
                          UHID: r.patients?.uhid,
                          "Died at": format(new Date(r.died_at), "dd MMM yyyy, p"),
                          Cause: r.cause_of_death,
                          Doctor: r.certifying_doctor_name ?? "—",
                          Place: r.place_of_death ?? "—",
                        }),
                        undefined,
                        r.patients?.mobile ?? undefined,
                      )}
                      onDelete={() => del.mutate(r.id)}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">No deaths recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}


function NewDeathDialog() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [admissionId, setAdmissionId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [diedAt, setDiedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [cause, setCause] = useState(""); const [immediate, setImmediate] = useState(""); const [underlying, setUnderlying] = useState("");
  const [doctorName, setDoctorName] = useState(""); const [place, setPlace] = useState("Hospital"); const [remarks, setRemarks] = useState("");

  const { data: matches = [] } = useQuery({
    queryKey: ["death-search", search], enabled: open && search.length > 1,
    queryFn: async () => (await supabase.from("admissions").select("id, admission_no, patient_id, patients(full_name, uhid)").or(`admission_no.ilike.%${search}%`).limit(10)).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error("Select admission");
      if (!cause.trim()) throw new Error("Cause of death is required");
      const { error } = await supabase.from("death_register").insert({
        patient_id: patientId, admission_id: admissionId || null,
        died_at: new Date(diedAt).toISOString(),
        cause_of_death: cause, immediate_cause: immediate || null, underlying_cause: underlying || null,
        certifying_doctor_name: doctorName || null, certified_by: user?.id ?? null,
        place_of_death: place || null, remarks: remarks || null,
        created_by: user?.id ?? null, updated_by: user?.id ?? null,
      });
      if (error) throw error;
      if (admissionId) await supabase.from("admissions").update({ status: "discharged", discharged_at: new Date(diedAt).toISOString(), notes: `Expired — ${cause}` }).eq("id", admissionId);
    },
    onSuccess: () => {
      toast.success("Death recorded");
      qc.invalidateQueries({ queryKey: ["death-register"] });
      setOpen(false);
      setSearch(""); setAdmissionId(""); setPatientId(""); setCause(""); setImmediate(""); setUnderlying(""); setDoctorName(""); setRemarks("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Record death</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Record death</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Admission</Label>
            <Input placeholder="Search by admission number (IPD-…)" value={search} onChange={(e) => setSearch(e.target.value)} />
            {matches.length > 0 && !admissionId && (
              <div className="border rounded-md max-h-40 overflow-auto mt-1">
                {matches.map((m: any) => (
                  <button key={m.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted" onClick={() => { setAdmissionId(m.id); setPatientId(m.patient_id); setSearch(`${m.admission_no} — ${m.patients?.full_name}`); }}>
                    <div className="font-medium">{m.patients?.full_name}</div>
                    <div className="text-xs text-muted-foreground">{m.admission_no} · {m.patients?.uhid}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Date & time of death</Label><Input type="datetime-local" value={diedAt} onChange={(e) => setDiedAt(e.target.value)} /></div>
            <div className="space-y-1"><Label>Place</Label>
              <Select value={place} onValueChange={setPlace}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Hospital", "ICU", "OT", "Emergency", "Brought dead"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Cause of death *</Label><Textarea rows={2} value={cause} onChange={(e) => setCause(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Immediate cause</Label><Input value={immediate} onChange={(e) => setImmediate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Underlying cause</Label><Input value={underlying} onChange={(e) => setUnderlying(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Certifying doctor</Label><Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. name" /></div>
          <div className="space-y-1"><Label>Remarks</Label><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
