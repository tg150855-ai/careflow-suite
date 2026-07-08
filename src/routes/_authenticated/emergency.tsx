import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Siren, Plus, Activity, AlertOctagon, Clock, Pencil, User } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/emergency")({ component: EmergencyPage });

type ER = {
  id: string; emergency_no: string; full_name: string; mobile: string | null; gender: string | null;
  approx_age: number | null; emergency_type: string | null; triage: string | null; status: string;
  arrival_time: string; patient_id: string | null; attending_doctor_id: string | null; notes: string | null;
  chief_complaint: string | null;
  patients?: { id: string; uhid: string } | null;
};

const triageColor: Record<string, string> = {
  red: "bg-destructive text-destructive-foreground",
  orange: "bg-warning text-warning-foreground",
  yellow: "bg-yellow-200 text-yellow-900",
  green: "bg-success/20 text-success",
};

function EmergencyPage() {
  const [cases, setCases] = useState<ER[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ER | null>(null);
  const [form, setForm] = useState({ full_name: "", mobile: "", gender: "male", approx_age: 30, emergency_type: "trauma", chief_complaint: "", triage: "yellow" });

  async function load() {
    const { data } = await (supabase as any)
      .from("emergency_cases")
      .select("*, patients(id, uhid)")
      .order("arrival_time", { ascending: false })
      .limit(200);
    setCases((data as ER[]) ?? []);
  }
  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.from("doctors").select("id, name").order("name");
      setDoctors(data ?? []);
    })();
  }, []);

  /** Find patient by mobile/UHID or create a new one, return patient id. */
  async function linkOrCreatePatient(payload: { full_name: string; mobile: string; gender: string; approx_age: number }) {
    const mobile = payload.mobile?.trim();
    if (mobile) {
      const { data } = await supabase.from("patients").select("id").eq("mobile", mobile).limit(1).maybeSingle();
      if (data?.id) return data.id as string;
    }
    // Create minimal patient record
    const dob = payload.approx_age
      ? new Date(new Date().getFullYear() - payload.approx_age, 0, 1).toISOString().slice(0, 10)
      : null;
    const user = (await supabase.auth.getUser()).data.user;
    const { data: newP, error } = await (supabase as any)
      .from("patients")
      .insert({
        full_name: payload.full_name,
        mobile: mobile || null,
        gender: payload.gender,
        dob,
        created_by: user?.id,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("Auto-create patient failed:", error.message);
      return null;
    }
    return newP?.id ?? null;
  }

  async function submit() {
    if (!form.full_name) return toast.error("Name required");
    const user = (await supabase.auth.getUser()).data.user;
    const patient_id = await linkOrCreatePatient(form);
    const { error } = await (supabase as any).from("emergency_cases").insert({ ...form, patient_id, created_by: user?.id } as any);
    if (error) return toast.error(error.message);
    toast.success(patient_id ? "Emergency registered & linked to patient" : "Emergency case registered");
    setOpen(false);
    setForm({ full_name: "", mobile: "", gender: "male", approx_age: 30, emergency_type: "trauma", chief_complaint: "", triage: "yellow" });
    load();
  }

  async function updateStatus(id: string, status: string) {
    const patch: Record<string, unknown> = { status };
    if (status === "in_treatment") patch.treatment_start = new Date().toISOString();
    if (status === "discharged" || status === "admitted") patch.treatment_end = new Date().toISOString();
    await (supabase as any).from("emergency_cases").update(patch as any).eq("id", id);
    load();
  }

  async function saveEdit() {
    if (!editing) return;
    const patch: Record<string, unknown> = {
      triage: editing.triage,
      emergency_type: editing.emergency_type,
      status: editing.status,
      attending_doctor_id: editing.attending_doctor_id || null,
      notes: editing.notes,
      arrival_time: editing.arrival_time,
    };
    const { error } = await (supabase as any).from("emergency_cases").update(patch).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Emergency updated");
    setEditing(null);
    load();
  }

  async function removeCase(id: string) {
    const { error } = await (supabase as any).from("emergency_cases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  }

  function printCase(c: ER) {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<pre style="font-family:sans-serif;padding:24px;white-space:pre-wrap">Emergency Case Slip
ER No: ${c.emergency_no}
Patient: ${c.full_name}
Gender/Age: ${c.gender ?? "—"}, ${c.approx_age ?? "—"}y
Mobile: ${c.mobile ?? "—"}
Triage: ${(c.triage ?? "").toUpperCase()}
Type: ${c.emergency_type ?? "—"}
Arrival: ${format(new Date(c.arrival_time), "dd MMM yyyy HH:mm")}
Status: ${c.status}</pre>`);
    w.document.close(); w.focus(); w.print();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) =>
      [c.full_name, c.emergency_no, c.mobile, c.patients?.uhid]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [cases, search]);

  const waiting = cases.filter((c) => c.status === "waiting").length;
  const critical = cases.filter((c) => c.triage === "red" && c.status !== "discharged").length;
  const active = cases.filter((c) => ["waiting", "in_treatment"].includes(c.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Siren className="size-6 text-destructive" /> Emergency & Casualty</h1>
          <p className="text-sm text-muted-foreground">Fast-track registration and triage.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-destructive hover:bg-destructive/90"><Plus className="size-4" /> Quick Register</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Emergency Registration</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
              <div><Label>Age</Label><Input type="number" value={form.approx_age} onChange={(e) => setForm({ ...form, approx_age: Number(e.target.value) })} /></div>
              <div><Label>Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Triage</Label>
                <Select value={form.triage} onValueChange={(v) => setForm({ ...form, triage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Red — Critical</SelectItem>
                    <SelectItem value="orange">Orange — Urgent</SelectItem>
                    <SelectItem value="yellow">Yellow — Semi-Urgent</SelectItem>
                    <SelectItem value="green">Green — Stable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Emergency Type</Label><Input value={form.emergency_type} onChange={(e) => setForm({ ...form, emergency_type: e.target.value })} placeholder="trauma / cardiac / poisoning ..." /></div>
              <div className="col-span-2"><Label>Chief Complaint</Label><Input value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Register</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={<Clock />} label="Waiting" value={waiting} />
        <Stat icon={<AlertOctagon />} label="Critical (Red)" value={critical} />
        <Stat icon={<Activity />} label="Active Cases" value={active} />
        <Stat icon={<Siren />} label="Today Total" value={cases.filter((c) => new Date(c.arrival_time).toDateString() === new Date().toDateString()).length} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Active Casualty Board</CardTitle>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search by patient name, ER no, or UHID..."
            className="w-full max-w-sm"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>ER No</TableHead><TableHead>Patient</TableHead><TableHead>Triage</TableHead><TableHead>Type</TableHead><TableHead>Arrival</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{cases.length === 0 ? "No emergency cases" : "No matches"}</TableCell></TableRow>}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.emergency_no}</TableCell>
                  <TableCell>
                    <div className="font-medium flex items-center gap-1.5">
                      {c.full_name}
                      {c.patients?.id && (
                        <Link
                          to="/patients/$id"
                          params={{ id: c.patients.id }}
                          title="View patient profile"
                          className="text-primary hover:text-primary/80"
                        >
                          <User className="size-3.5" />
                        </Link>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.gender ?? "—"}, {c.approx_age ?? "—"}y
                      {c.patients?.uhid ? ` · ${c.patients.uhid}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>{c.triage && <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${triageColor[c.triage]}`}>{c.triage}</span>}</TableCell>
                  <TableCell className="text-sm">{c.emergency_type ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDistanceToNow(new Date(c.arrival_time), { addSuffix: true })}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.status === "waiting" && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "in_treatment")}>Treat</Button>}
                      {c.status === "in_treatment" && <>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "admitted")}>Admit</Button>
                        <Button size="sm" onClick={() => updateStatus(c.id, "discharged")}>Discharge</Button>
                      </>}
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ ...c })} title="Edit">
                        <Pencil className="size-3.5" />
                      </Button>
                      <RecordActions
                        size="sm"
                        deleteLabel={`emergency case ${c.emergency_no}`}
                        onPrint={() => printCase(c)}
                        onWhatsApp={() => shareOnWhatsApp(summarizeRecord("Emergency Case", {
                          ER: c.emergency_no,
                          Patient: c.full_name,
                          Triage: (c.triage ?? "").toUpperCase(),
                          Type: c.emergency_type ?? "—",
                          Status: c.status,
                          Arrival: format(new Date(c.arrival_time), "dd MMM HH:mm"),
                        }), undefined, c.mobile ?? undefined)}
                        onDelete={() => removeCase(c.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Emergency — {editing?.emergency_no}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Triage</Label>
                <Select value={editing.triage ?? ""} onValueChange={(v) => setEditing({ ...editing, triage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Red — Critical</SelectItem>
                    <SelectItem value="orange">Orange — Urgent</SelectItem>
                    <SelectItem value="yellow">Yellow — Semi-Urgent</SelectItem>
                    <SelectItem value="green">Green — Stable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="in_treatment">In treatment</SelectItem>
                    <SelectItem value="admitted">Admitted</SelectItem>
                    <SelectItem value="discharged">Discharged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Type</Label>
                <Input value={editing.emergency_type ?? ""} onChange={(e) => setEditing({ ...editing, emergency_type: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Attending Doctor</Label>
                <Select value={editing.attending_doctor_id ?? "__none"} onValueChange={(v) => setEditing({ ...editing, attending_doctor_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {doctors.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Arrival Time</Label>
                <Input
                  type="datetime-local"
                  value={editing.arrival_time ? new Date(editing.arrival_time).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditing({ ...editing, arrival_time: new Date(e.target.value).toISOString() })}
                />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card><CardContent className="p-5 flex items-center gap-3">
      <div className="size-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">{icon}</div>
      <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold">{value}</div></div>
    </CardContent></Card>
  );
}
