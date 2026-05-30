import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Scissors, Plus, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ot")({ component: OTDashboard });

type Surgery = { id: string; surgery_no: string; procedure_name: string; priority: string; status: string; scheduled_start: string; scheduled_end: string; estimated_cost: number; patient_id: string };

function OTDashboard() {
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [patients, setPatients] = useState<{ id: string; full_name: string; uhid: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", ot_room_id: "", procedure_name: "", priority: "elective", scheduled_start: "", scheduled_end: "", estimated_cost: 0, notes: "" });

  async function load() {
    const [s, r, p] = await Promise.all([
      (supabase as any).from("surgeries").select("*").order("scheduled_start", { ascending: false }).limit(50),
      (supabase as any).from("ot_rooms").select("id,name").eq("active", true),
      supabase.from("patients").select("id,full_name,uhid").order("created_at", { ascending: false }).limit(200),
    ]);
    setSurgeries((s.data as Surgery[]) ?? []);
    setRooms(r.data ?? []);
    setPatients(p.data ?? []);
  }
  useEffect(() => { load(); }, []);

  const scheduled = surgeries.filter((x) => x.status === "scheduled").length;
  const completed = surgeries.filter((x) => x.status === "completed").length;
  const emergency = surgeries.filter((x) => x.priority === "emergency").length;
  const revenue = surgeries.filter((x) => x.status === "completed").reduce((s, x) => s + Number(x.estimated_cost || 0), 0);

  async function submit() {
    if (!form.patient_id || !form.procedure_name || !form.scheduled_start || !form.scheduled_end) {
      toast.error("Fill patient, procedure, start and end time");
      return;
    }
    // Conflict detection: same OT room overlap
    if (form.ot_room_id) {
      const { data: conflicts } = await (supabase as any).from("surgeries")
        .select("id,procedure_name,scheduled_start,scheduled_end")
        .eq("ot_room_id", form.ot_room_id)
        .neq("status", "cancelled")
        .lt("scheduled_start", form.scheduled_end)
        .gt("scheduled_end", form.scheduled_start);
      if (conflicts && conflicts.length > 0) {
        toast.error(`OT conflict with ${conflicts[0].procedure_name}`);
        return;
      }
    }
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await (supabase as any).from("surgeries").insert({ ...form, created_by: user?.id, ot_room_id: form.ot_room_id || null });
    if (error) return toast.error(error.message);
    toast.success("Surgery scheduled");
    setOpen(false);
    setForm({ patient_id: "", ot_room_id: "", procedure_name: "", priority: "elective", scheduled_start: "", scheduled_end: "", estimated_cost: 0, notes: "" });
    load();
  }

  async function updateStatus(id: string, status: string) {
    const patch: Record<string, unknown> = { status };
    if (status === "in_progress") patch.actual_start = new Date().toISOString();
    if (status === "completed") patch.actual_end = new Date().toISOString();
    const { error } = await (supabase as any).from("surgeries").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Scissors className="size-6 text-primary" /> OT / Surgery Management</h1>
          <p className="text-sm text-muted-foreground">Schedule and track operation theatre cases.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Schedule Surgery</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Schedule Surgery</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Patient *</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.uhid} — {p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Procedure *</Label><Input value={form.procedure_name} onChange={(e) => setForm({ ...form, procedure_name: e.target.value })} placeholder="e.g. Appendectomy" /></div>
              <div>
                <Label>OT Room</Label>
                <Select value={form.ot_room_id} onValueChange={(v) => setForm({ ...form, ot_room_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select OT" /></SelectTrigger>
                  <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elective">Elective</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Start *</Label><Input type="datetime-local" value={form.scheduled_start} onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })} /></div>
              <div><Label>End *</Label><Input type="datetime-local" value={form.scheduled_end} onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })} /></div>
              <div className="col-span-2"><Label>Estimated Cost (₹)</Label><Input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Schedule</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Activity />} label="Scheduled" value={scheduled} />
        <StatCard icon={<CheckCircle2 />} label="Completed" value={completed} />
        <StatCard icon={<AlertTriangle />} label="Emergency" value={emergency} />
        <StatCard icon={<Scissors />} label="Revenue" value={inr(revenue)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Upcoming & Recent Surgeries</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Surgery No</TableHead><TableHead>Procedure</TableHead><TableHead>Schedule</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Cost</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {surgeries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No surgeries scheduled yet</TableCell></TableRow>}
              {surgeries.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.surgery_no}</TableCell>
                  <TableCell>{s.procedure_name}</TableCell>
                  <TableCell className="text-xs">{format(new Date(s.scheduled_start), "dd MMM HH:mm")}</TableCell>
                  <TableCell><Badge variant={s.priority === "emergency" ? "destructive" : s.priority === "urgent" ? "default" : "secondary"} className="capitalize">{s.priority}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{s.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell>{inr(s.estimated_cost)}</TableCell>
                  <TableCell className="flex gap-1">
                    {s.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "in_progress")}>Start</Button>}
                    {s.status === "in_progress" && <Button size="sm" onClick={() => updateStatus(s.id, "completed")}>Complete</Button>}
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </div>
    </CardContent></Card>
  );
}
