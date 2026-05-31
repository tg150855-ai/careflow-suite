import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Ambulance, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ambulance")({ component: AmbulancePage });

function AmbulancePage() {
  const [ambs, setAmbs] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ambulance_id: "", caller_name: "", caller_phone: "", pickup_location: "", destination: "", eta_minutes: 15, fare: 0 });

  async function load() {
    const [a, t] = await Promise.all([
      (supabase as any).from("ambulances").select("*").order("vehicle_number"),
      (supabase as any).from("ambulance_dispatches").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setAmbs(a.data ?? []);
    setTrips(t.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function dispatch() {
    if (!form.pickup_location) return toast.error("Pickup required");
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await (supabase as any).from("ambulance_dispatches").insert({ ...form, ambulance_id: form.ambulance_id || null, dispatched_at: new Date().toISOString(), status: "dispatched", created_by: user?.id });
    if (error) return toast.error(error.message);
    if (form.ambulance_id) await (supabase as any).from("ambulances").update({ status: "on_duty" } as any).eq("id", form.ambulance_id);
    toast.success("Ambulance dispatched");
    setOpen(false);
    setForm({ ambulance_id: "", caller_name: "", caller_phone: "", pickup_location: "", destination: "", eta_minutes: 15, fare: 0 });
    load();
  }

  async function updateTrip(id: string, status: string, ambulance_id: string | null) {
    const patch: Record<string, unknown> = { status };
    if (status === "arrived") patch.arrived_at = new Date().toISOString();
    if (status === "completed") patch.completed_at = new Date().toISOString();
    await (supabase as any).from("ambulance_dispatches").update(patch as any).eq("id", id);
    if (status === "completed" && ambulance_id) await (supabase as any).from("ambulances").update({ status: "available" } as any).eq("id", ambulance_id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Ambulance className="size-6 text-primary" /> Ambulance Management</h1>
          <p className="text-sm text-muted-foreground">Fleet and dispatch operations.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> New Dispatch</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Dispatch Ambulance</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Ambulance</Label>
                <Select value={form.ambulance_id} onValueChange={(v) => setForm({ ...form, ambulance_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Available" /></SelectTrigger>
                  <SelectContent>{ambs.filter((a) => a.status === "available").map((a) => <SelectItem key={a.id} value={a.id}>{a.vehicle_number} — {a.vehicle_type}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Caller Name</Label><Input value={form.caller_name} onChange={(e) => setForm({ ...form, caller_name: e.target.value })} /></div>
              <div><Label>Caller Phone</Label><Input value={form.caller_phone} onChange={(e) => setForm({ ...form, caller_phone: e.target.value })} /></div>
              <div className="col-span-2"><Label>Pickup *</Label><Input value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} /></div>
              <div className="col-span-2"><Label>Destination</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
              <div><Label>ETA (min)</Label><Input type="number" value={form.eta_minutes} onChange={(e) => setForm({ ...form, eta_minutes: Number(e.target.value) })} /></div>
              <div><Label>Fare (₹)</Label><Input type="number" value={form.fare} onChange={(e) => setForm({ ...form, fare: Number(e.target.value) })} /></div>
            </div>
            <DialogFooter><Button onClick={dispatch}>Dispatch</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="trips">
        <TabsList><TabsTrigger value="trips">Dispatches</TabsTrigger><TabsTrigger value="fleet">Fleet</TabsTrigger></TabsList>
        <TabsContent value="trips">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>No</TableHead><TableHead>Pickup → Destination</TableHead><TableHead>Caller</TableHead><TableHead>Status</TableHead><TableHead>Fare</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {trips.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No dispatches yet</TableCell></TableRow>}
                {trips.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.dispatch_no}</TableCell>
                    <TableCell><div className="text-sm">{t.pickup_location}</div><div className="text-xs text-muted-foreground">→ {t.destination ?? "—"}</div></TableCell>
                    <TableCell className="text-sm">{t.caller_name}<div className="text-xs text-muted-foreground">{t.caller_phone}</div></TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{t.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell>{inr(t.fare)}</TableCell>
                    <TableCell className="flex gap-1">
                      {t.status === "dispatched" && <Button size="sm" variant="outline" onClick={() => updateTrip(t.id, "en_route", t.ambulance_id)}>En route</Button>}
                      {t.status === "en_route" && <Button size="sm" variant="outline" onClick={() => updateTrip(t.id, "arrived", t.ambulance_id)}>Arrived</Button>}
                      {["arrived", "en_route", "dispatched"].includes(t.status) && <Button size="sm" onClick={() => updateTrip(t.id, "completed", t.ambulance_id)}>Complete</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="fleet">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Vehicle</TableHead><TableHead>Type</TableHead><TableHead>Driver</TableHead><TableHead>Equipment</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {ambs.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono">{a.vehicle_number}</TableCell>
                    <TableCell>{a.vehicle_type}</TableCell>
                    <TableCell>{a.driver_name}<div className="text-xs text-muted-foreground">{a.driver_phone}</div></TableCell>
                    <TableCell className="text-xs">{a.equipment}</TableCell>
                    <TableCell><Badge variant={a.status === "available" ? "secondary" : "outline"} className="capitalize">{a.status.replace("_", " ")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
