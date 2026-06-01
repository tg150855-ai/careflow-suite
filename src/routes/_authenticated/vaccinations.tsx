import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Syringe, Plus } from "lucide-react";
import { format, isPast } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vaccinations")({ component: VaxPage });

function VaxPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", vaccine_name: "", dose_number: "1", due_date: "" });

  async function load() {
    const { data } = await supabase
      .from("vaccinations")
      .select("*, patients(full_name, uhid)")
      .order("due_date", { ascending: true, nullsFirst: false }).limit(200);
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  async function create() {
    if (!form.patient_id || !form.vaccine_name) return toast.error("Patient & vaccine required");
    const { error } = await supabase.from("vaccinations").insert({
      patient_id: form.patient_id,
      vaccine_name: form.vaccine_name,
      dose_number: parseInt(form.dose_number),
      due_date: form.due_date || null,
      status: "scheduled",
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Vaccination scheduled"); setOpen(false);
    setForm({ patient_id: "", vaccine_name: "", dose_number: "1", due_date: "" }); load();
  }

  async function markGiven(id: string) {
    await supabase.from("vaccinations").update({ status: "given", given_date: new Date().toISOString().split("T")[0] } as any).eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Syringe className="size-6 text-primary" /> Vaccination Management</h1>
          <p className="text-sm text-muted-foreground">Track schedules, due dates, missed shots. Automated reminders.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Schedule</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule Vaccination</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Patient" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Vaccine</Label><Input value={form.vaccine_name} onChange={(e) => setForm({ ...form, vaccine_name: e.target.value })} placeholder="e.g. Hepatitis B" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Dose #</Label><Input type="number" min={1} value={form.dose_number} onChange={(e) => setForm({ ...form, dose_number: e.target.value })} /></div>
                <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Schedule</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Patient</TableHead><TableHead>Vaccine</TableHead><TableHead>Dose</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No vaccinations scheduled</TableCell></TableRow>}
            {rows.map((r) => {
              const overdue = r.status === "scheduled" && r.due_date && isPast(new Date(r.due_date));
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.patients?.full_name ?? "—"}</TableCell>
                  <TableCell className="font-medium">{r.vaccine_name}</TableCell>
                  <TableCell>{r.dose_number}</TableCell>
                  <TableCell className="text-xs">{r.due_date ? format(new Date(r.due_date), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={overdue ? "destructive" : r.status === "given" ? "default" : "outline"} className="capitalize">
                      {overdue ? "Overdue" : r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.status !== "given" && <Button size="sm" variant="outline" onClick={() => markGiven(r.id)}>Mark Given</Button>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
