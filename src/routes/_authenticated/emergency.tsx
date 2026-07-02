import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Siren, Plus, Activity, AlertOctagon, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { RecordActions } from "@/components/common/record-actions";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/emergency")({ component: EmergencyPage });

type ER = { id: string; emergency_no: string; full_name: string; mobile: string | null; gender: string | null; approx_age: number | null; emergency_type: string | null; triage: string | null; status: string; arrival_time: string };

const triageColor: Record<string, string> = {
  red: "bg-destructive text-destructive-foreground",
  orange: "bg-warning text-warning-foreground",
  yellow: "bg-yellow-200 text-yellow-900",
  green: "bg-success/20 text-success",
};

function EmergencyPage() {
  const [cases, setCases] = useState<ER[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", mobile: "", gender: "male", approx_age: 30, emergency_type: "trauma", chief_complaint: "", triage: "yellow" });

  async function load() {
    const { data } = await (supabase as any).from("emergency_cases").select("*").order("arrival_time", { ascending: false }).limit(100);
    setCases((data as ER[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!form.full_name) return toast.error("Name required");
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await (supabase as any).from("emergency_cases").insert({ ...form, created_by: user?.id } as any);
    if (error) return toast.error(error.message);
    toast.success("Emergency case registered");
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
        <CardHeader><CardTitle>Active Casualty Board</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>ER No</TableHead><TableHead>Patient</TableHead><TableHead>Triage</TableHead><TableHead>Type</TableHead><TableHead>Arrival</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {cases.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No emergency cases</TableCell></TableRow>}
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.emergency_no}</TableCell>
                  <TableCell><div className="font-medium">{c.full_name}</div><div className="text-xs text-muted-foreground">{c.gender}, {c.approx_age}y</div></TableCell>
                  <TableCell>{c.triage && <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${triageColor[c.triage]}`}>{c.triage}</span>}</TableCell>
                  <TableCell className="text-sm">{c.emergency_type}</TableCell>
                  <TableCell className="text-xs">{formatDistanceToNow(new Date(c.arrival_time), { addSuffix: true })}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {c.status === "waiting" && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "in_treatment")}>Treat</Button>}
                    {c.status === "in_treatment" && <>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "admitted")}>Admit</Button>
                      <Button size="sm" onClick={() => updateStatus(c.id, "discharged")}>Discharge</Button>
                    </>}
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card><CardContent className="p-5 flex items-center gap-3">
      <div className="size-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">{icon}</div>
      <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold">{value}</div></div>
    </CardContent></Card>
  );
}
