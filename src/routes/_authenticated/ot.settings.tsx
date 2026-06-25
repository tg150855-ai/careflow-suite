import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Save, Pencil, Settings as SettingsIcon, Scissors, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ot/settings")({ component: OtSettings });

function OtSettings() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><SettingsIcon className="size-5" /> OT Settings</h2>
      <Rooms />
      <Procedures />
      <Priorities />
    </div>
  );
}

function Rooms() {
  const qc = useQueryClient();
  const { data: rooms = [] } = useQuery({ queryKey: ["ot-set-rooms"], queryFn: async () => (await (supabase as any).from("ot_rooms").select("*").order("name")).data ?? [] });
  const [name, setName] = useState(""); const [location, setLocation] = useState("");
  async function add() {
    if (!name.trim()) return toast.error("Name required");
    const { error } = await (supabase as any).from("ot_rooms").insert({ name, location, active: true });
    if (error) return toast.error(error.message);
    setName(""); setLocation(""); toast.success("OT room added");
    qc.invalidateQueries({ queryKey: ["ot-set-rooms"] });
  }
  async function toggle(r: any) {
    await (supabase as any).from("ot_rooms").update({ active: !r.active }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["ot-set-rooms"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete OT room?")) return;
    const { error } = await (supabase as any).from("ot_rooms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ot-set-rooms"] });
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><DoorOpen className="size-4" /> OT Rooms</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-end">
          <div className="flex-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="OT-1" /></div>
          <div className="flex-1"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="2nd Floor" /></div>
          <Button onClick={add}><Plus className="size-4" /> Add</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rooms.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No OT rooms</TableCell></TableRow>}
            {rooms.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell><TableCell>{r.location ?? "—"}</TableCell>
                <TableCell><Switch checked={r.active} onCheckedChange={() => toggle(r)} /></TableCell>
                <TableCell><Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-3 text-rose-600" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Procedures() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: ["ot-set-proc"], queryFn: async () => (await (supabase as any).from("ot_procedure_catalog").select("*").order("name")).data ?? [] });
  const empty = { name: "", code: "", ot_charge: 0, surgeon_charge: 0, assistant_charge: 0, anesthesia_charge: 0, consumables_charge: 0, active: true };
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);

  function openNew() { setEditId(null); setForm(empty); setOpen(true); }
  function openEdit(r: any) { setEditId(r.id); setForm({ ...r }); setOpen(true); }

  async function save() {
    if (!form.name.trim()) return toast.error("Name required");
    const payload = { ...form, ot_charge: +form.ot_charge, surgeon_charge: +form.surgeon_charge, assistant_charge: +form.assistant_charge, anesthesia_charge: +form.anesthesia_charge, consumables_charge: +form.consumables_charge };
    if (editId) {
      const { error } = await (supabase as any).from("ot_procedure_catalog").update(payload).eq("id", editId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from("ot_procedure_catalog").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["ot-set-proc"] });
    qc.invalidateQueries({ queryKey: ["ot-catalog"] });
  }
  async function remove(id: string) {
    if (!confirm("Delete procedure?")) return;
    const { error } = await (supabase as any).from("ot_procedure_catalog").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["ot-set-proc"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Scissors className="size-4" /> Procedures & Charges</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" onClick={openNew}><Plus className="size-4" /> Procedure</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Procedure</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Code</Label><Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>OT Charge</Label><Input type="number" value={form.ot_charge} onChange={(e) => setForm({ ...form, ot_charge: e.target.value })} /></div>
              <div><Label>Surgeon</Label><Input type="number" value={form.surgeon_charge} onChange={(e) => setForm({ ...form, surgeon_charge: e.target.value })} /></div>
              <div><Label>Assistant</Label><Input type="number" value={form.assistant_charge} onChange={(e) => setForm({ ...form, assistant_charge: e.target.value })} /></div>
              <div><Label>Anesthesia</Label><Input type="number" value={form.anesthesia_charge} onChange={(e) => setForm({ ...form, anesthesia_charge: e.target.value })} /></div>
              <div><Label>Consumables</Label><Input type="number" value={form.consumables_charge} onChange={(e) => setForm({ ...form, consumables_charge: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}><Save className="size-4" /> Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>OT</TableHead><TableHead>Surgeon</TableHead><TableHead>Asst</TableHead><TableHead>Anes</TableHead><TableHead>Cons</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">No procedures yet</TableCell></TableRow>}
            {rows.map((r: any) => {
              const t = Number(r.ot_charge) + Number(r.surgeon_charge) + Number(r.assistant_charge) + Number(r.anesthesia_charge) + Number(r.consumables_charge);
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell><TableCell>{r.code ?? "—"}</TableCell>
                  <TableCell>{inr(r.ot_charge)}</TableCell><TableCell>{inr(r.surgeon_charge)}</TableCell>
                  <TableCell>{inr(r.assistant_charge)}</TableCell><TableCell>{inr(r.anesthesia_charge)}</TableCell>
                  <TableCell>{inr(r.consumables_charge)}</TableCell>
                  <TableCell className="text-right font-medium">{inr(t)}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="size-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-3 text-rose-600" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Priorities() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Priority Levels</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">System-defined priorities used when scheduling surgeries.</p>
        <div className="grid md:grid-cols-3 gap-3">
          <PriorityCard name="Planned" desc="Elective / pre-scheduled surgery, normal queue." />
          <PriorityCard name="Urgent" desc="Needs to be performed within 24 hours." />
          <PriorityCard name="Emergency" desc="Immediate, life-saving surgery. Top priority." />
        </div>
      </CardContent>
    </Card>
  );
}
function PriorityCard({ name, desc }: { name: string; desc: string }) {
  return <div className="rounded-lg border p-3 bg-card"><div className="font-semibold">{name}</div><div className="text-xs text-muted-foreground">{desc}</div></div>;
}
