import { createFileRoute } from "@tanstack/react-router";
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
import { Video, Plus, PhoneCall } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/telemedicine")({ component: TelePage });

function TelePage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", doctor_id: "", scheduled_at: "" });

  async function load() {
    const { data } = await supabase
      .from("telemedicine_sessions")
      .select("*, patients(full_name, uhid), profiles!telemedicine_sessions_doctor_id_fkey(full_name)")
      .order("scheduled_at", { ascending: false }).limit(100);
    setSessions(data ?? []);
  }
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").limit(500).then(({ data }) => setPatients(data ?? []));
    supabase.from("profiles").select("id, full_name").limit(200).then(({ data }) => setDoctors(data ?? []));
  }, []);

  async function create() {
    if (!form.patient_id || !form.doctor_id || !form.scheduled_at) return toast.error("All fields required");
    const room = `tele-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("telemedicine_sessions").insert({
      patient_id: form.patient_id,
      doctor_id: form.doctor_id,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      room_url: `https://meet.jit.si/${room}`,
      status: "scheduled",
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Session scheduled");
    setOpen(false); setForm({ patient_id: "", doctor_id: "", scheduled_at: "" });
    load();
  }

  async function start(id: string) {
    await supabase.from("telemedicine_sessions").update({ status: "active", started_at: new Date().toISOString() } as any).eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Video className="size-6 text-primary" /> Telemedicine</h1>
          <p className="text-sm text-muted-foreground">Online consultations — video, audio, chat.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New Session</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule Tele-Consultation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Doctor</Label>
                <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>When</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Schedule</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Patient</TableHead><TableHead>Doctor</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {sessions.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">No sessions yet</TableCell></TableRow>}
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-xs">{format(new Date(s.scheduled_at), "dd MMM yyyy HH:mm")}</TableCell>
                <TableCell>{s.patients?.full_name ?? "—"}</TableCell>
                <TableCell>{s.profiles?.full_name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{s.status}</Badge></TableCell>
                <TableCell>
                  {s.room_url && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => start(s.id)}>Start</Button>
                      <a href={s.room_url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost"><PhoneCall className="size-3.5 mr-1" />Join</Button></a>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
