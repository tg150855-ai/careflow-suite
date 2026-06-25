import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Printer, Play, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { inr } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "./ot.index";

export const Route = createFileRoute("/_authenticated/ot/schedule")({ component: OtSchedule });

type FormState = {
  patient_id: string; admission_id: string; ot_room_id: string;
  primary_surgeon_id: string; assistant_surgeon_id: string; anesthetist_id: string;
  procedure_name: string; procedure_code: string; priority: string;
  scheduled_start: string; scheduled_end: string;
  ot_charge: number; surgeon_charge: number; assistant_charge: number; anesthesia_charge: number; consumables_charge: number;
  notes: string;
};

const empty: FormState = {
  patient_id: "", admission_id: "", ot_room_id: "",
  primary_surgeon_id: "", assistant_surgeon_id: "", anesthetist_id: "",
  procedure_name: "", procedure_code: "", priority: "planned",
  scheduled_start: "", scheduled_end: "",
  ot_charge: 0, surgeon_charge: 0, assistant_charge: 0, anesthesia_charge: 0, consumables_charge: 0,
  notes: "",
};

function OtSchedule() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["ot-schedule"],
    queryFn: async () => (await (supabase as any).from("surgeries")
      .select("id, surgery_no, procedure_name, priority, status, scheduled_start, scheduled_end, estimated_cost, ot_charge, surgeon_charge, assistant_charge, anesthesia_charge, consumables_charge, admission_id, patients(full_name, uhid), ot_rooms(name), primary:primary_surgeon_id(name), assistant:assistant_surgeon_id(name), anesthetist:anesthetist_id(name)")
      .order("scheduled_start", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: patients = [] } = useQuery({ queryKey: ["ot-patients"], queryFn: async () => (await supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500)).data ?? [] });
  const { data: rooms = [] } = useQuery({ queryKey: ["ot-rooms"], queryFn: async () => (await (supabase as any).from("ot_rooms").select("id, name").eq("active", true)).data ?? [] });
  const { data: doctors = [] } = useQuery({ queryKey: ["ot-doctors"], queryFn: async () => (await supabase.from("doctors").select("id, name").eq("active", true).order("name")).data ?? [] });
  const { data: procedures = [] } = useQuery({ queryKey: ["ot-catalog"], queryFn: async () => (await (supabase as any).from("ot_procedure_catalog").select("*").eq("active", true).order("name")).data ?? [] });
  const { data: admissions = [] } = useQuery({
    queryKey: ["ot-adms", form.patient_id],
    enabled: !!form.patient_id,
    queryFn: async () => (await supabase.from("admissions").select("id, admission_no, status").eq("patient_id", form.patient_id).order("admitted_at", { ascending: false })).data ?? [],
  });

  function pickProcedure(name: string) {
    const p = procedures.find((x: any) => x.name === name);
    if (!p) { setForm((f) => ({ ...f, procedure_name: name })); return; }
    setForm((f) => ({
      ...f,
      procedure_name: p.name, procedure_code: p.code ?? "",
      ot_charge: Number(p.ot_charge ?? 0), surgeon_charge: Number(p.surgeon_charge ?? 0),
      assistant_charge: Number(p.assistant_charge ?? 0), anesthesia_charge: Number(p.anesthesia_charge ?? 0),
      consumables_charge: Number(p.consumables_charge ?? 0),
    }));
  }

  function openNew() { setEditId(null); setForm(empty); setOpen(true); }
  function openEdit(r: any) {
    setEditId(r.id);
    setForm({
      patient_id: r.patient_id ?? "", admission_id: r.admission_id ?? "", ot_room_id: r.ot_room_id ?? "",
      primary_surgeon_id: r.primary_surgeon_id ?? "", assistant_surgeon_id: r.assistant_surgeon_id ?? "", anesthetist_id: r.anesthetist_id ?? "",
      procedure_name: r.procedure_name ?? "", procedure_code: r.procedure_code ?? "", priority: r.priority ?? "planned",
      scheduled_start: r.scheduled_start ? r.scheduled_start.slice(0, 16) : "",
      scheduled_end: r.scheduled_end ? r.scheduled_end.slice(0, 16) : "",
      ot_charge: Number(r.ot_charge ?? 0), surgeon_charge: Number(r.surgeon_charge ?? 0),
      assistant_charge: Number(r.assistant_charge ?? 0), anesthesia_charge: Number(r.anesthesia_charge ?? 0),
      consumables_charge: Number(r.consumables_charge ?? 0),
      notes: r.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.patient_id || !form.procedure_name || !form.scheduled_start || !form.scheduled_end) return toast.error("Patient, procedure, start and end are required.");
    const total = form.ot_charge + form.surgeon_charge + form.assistant_charge + form.anesthesia_charge + form.consumables_charge;
    const payload: any = {
      patient_id: form.patient_id,
      admission_id: form.admission_id || null,
      ot_room_id: form.ot_room_id || null,
      primary_surgeon_id: form.primary_surgeon_id || null,
      assistant_surgeon_id: form.assistant_surgeon_id || null,
      anesthetist_id: form.anesthetist_id || null,
      procedure_name: form.procedure_name,
      procedure_code: form.procedure_code || null,
      priority: form.priority,
      scheduled_start: new Date(form.scheduled_start).toISOString(),
      scheduled_end: new Date(form.scheduled_end).toISOString(),
      ot_charge: form.ot_charge, surgeon_charge: form.surgeon_charge,
      assistant_charge: form.assistant_charge, anesthesia_charge: form.anesthesia_charge,
      consumables_charge: form.consumables_charge,
      estimated_cost: total,
      notes: form.notes || null,
    };
    if (editId) {
      const { error } = await (supabase as any).from("surgeries").update(payload).eq("id", editId);
      if (error) return toast.error(error.message);
      toast.success("Surgery updated");
    } else {
      const u = (await supabase.auth.getUser()).data.user;
      const { error } = await (supabase as any).from("surgeries").insert({ ...payload, created_by: u?.id, status: "scheduled" });
      if (error) return toast.error(error.message);
      toast.success("Surgery scheduled");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["ot-schedule"] });
    qc.invalidateQueries({ queryKey: ["ot-today"] });
    qc.invalidateQueries({ queryKey: ["ot-all-counts"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this surgery?")) return;
    const { error } = await (supabase as any).from("surgeries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["ot-schedule"] });
  }

  async function setStatus(id: string, status: string) {
    const patch: any = { status };
    if (status === "in_progress") patch.actual_start = new Date().toISOString();
    if (status === "completed") patch.actual_end = new Date().toISOString();
    const { error } = await (supabase as any).from("surgeries").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["ot-schedule"] });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Surgery Scheduling</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={openNew}><Plus className="size-4" /> Schedule Surgery</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Edit Surgery" : "Schedule Surgery"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 grid grid-cols-2 gap-3">
                    <div>
                      <Label>Patient *</Label>
                      <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v, admission_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                        <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.uhid} — {p.full_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>IPD Admission (optional)</Label>
                      <Select value={form.admission_id || "none"} onValueChange={(v) => setForm({ ...form, admission_id: v === "none" ? "" : v })} disabled={!form.patient_id}>
                        <SelectTrigger><SelectValue placeholder={form.patient_id ? "Link admission" : "Select patient first"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {admissions.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.admission_no} ({a.status})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Procedure *</Label>
                    {procedures.length > 0 ? (
                      <Select value={form.procedure_name} onValueChange={pickProcedure}>
                        <SelectTrigger><SelectValue placeholder="Choose / type" /></SelectTrigger>
                        <SelectContent>
                          {procedures.map((p: any) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : <Input value={form.procedure_name} onChange={(e) => setForm({ ...form, procedure_name: e.target.value })} placeholder="e.g. Appendectomy" />}
                  </div>
                  <div><Label>Procedure Code</Label><Input value={form.procedure_code} onChange={(e) => setForm({ ...form, procedure_code: e.target.value })} /></div>
                  <div>
                    <Label>Primary Surgeon</Label>
                    <Select value={form.primary_surgeon_id} onValueChange={(v) => setForm({ ...form, primary_surgeon_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Assistant Surgeon</Label>
                    <Select value={form.assistant_surgeon_id || "none"} onValueChange={(v) => setForm({ ...form, assistant_surgeon_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">— None —</SelectItem>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Anesthetist</Label>
                    <Select value={form.anesthetist_id || "none"} onValueChange={(v) => setForm({ ...form, anesthetist_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">— None —</SelectItem>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>OT Room</Label>
                    <Select value={form.ot_room_id || "none"} onValueChange={(v) => setForm({ ...form, ot_room_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select OT" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">— None —</SelectItem>{rooms.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Scheduled Start *</Label><Input type="datetime-local" value={form.scheduled_start} onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })} /></div>
                  <div><Label>Scheduled End *</Label><Input type="datetime-local" value={form.scheduled_end} onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })} /></div>

                  <div className="col-span-2 mt-2 text-xs font-medium text-muted-foreground uppercase">OT Charges (₹)</div>
                  <div><Label>OT Charge</Label><Input type="number" value={form.ot_charge} onChange={(e) => setForm({ ...form, ot_charge: +e.target.value })} /></div>
                  <div><Label>Surgeon</Label><Input type="number" value={form.surgeon_charge} onChange={(e) => setForm({ ...form, surgeon_charge: +e.target.value })} /></div>
                  <div><Label>Assistant</Label><Input type="number" value={form.assistant_charge} onChange={(e) => setForm({ ...form, assistant_charge: +e.target.value })} /></div>
                  <div><Label>Anesthesia</Label><Input type="number" value={form.anesthesia_charge} onChange={(e) => setForm({ ...form, anesthesia_charge: +e.target.value })} /></div>
                  <div><Label>Consumables</Label><Input type="number" value={form.consumables_charge} onChange={(e) => setForm({ ...form, consumables_charge: +e.target.value })} /></div>
                  <div className="flex items-end"><div className="text-sm">Total: <span className="font-semibold">{inr(form.ot_charge + form.surgeon_charge + form.assistant_charge + form.anesthesia_charge + form.consumables_charge)}</span></div></div>

                  <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={save}><Save className="size-4" /> {editId ? "Update" : "Save"}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Surgery No</TableHead><TableHead>Patient</TableHead><TableHead>Procedure</TableHead>
              <TableHead>Surgeon</TableHead><TableHead>OT</TableHead><TableHead>Schedule</TableHead>
              <TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Cost</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No surgeries yet</TableCell></TableRow>}
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.surgery_no}</TableCell>
                  <TableCell>{r.patients?.full_name}<div className="text-[11px] text-muted-foreground">{r.patients?.uhid}</div></TableCell>
                  <TableCell>{r.procedure_name}</TableCell>
                  <TableCell className="text-xs">{r.primary?.name ?? "—"}{r.assistant?.name && <div className="text-muted-foreground">+ {r.assistant.name}</div>}</TableCell>
                  <TableCell>{r.ot_rooms?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{format(new Date(r.scheduled_start), "dd MMM HH:mm")}</TableCell>
                  <TableCell><PriorityBadge p={r.priority} /></TableCell>
                  <TableCell><StatusBadge s={r.status} /></TableCell>
                  <TableCell>{inr(r.estimated_cost ?? 0)}</TableCell>
                  <TableCell className="flex gap-1 flex-wrap">
                    <Button asChild size="sm" variant="outline"><Link to="/ot/$id" params={{ id: r.id }}>Open</Link></Button>
                    {r.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "in_progress")}><Play className="size-3" /></Button>}
                    {r.status === "in_progress" && <Button size="sm" onClick={() => setStatus(r.id, "completed")}><CheckCircle2 className="size-3" /></Button>}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="size-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-3 text-rose-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
