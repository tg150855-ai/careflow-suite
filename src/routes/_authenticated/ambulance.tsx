import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Ambulance, Plus, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { inr } from "@/lib/format";
import { RecordActions } from "@/components/common/record-actions";

export const Route = createFileRoute("/_authenticated/ambulance")({ component: AmbulancePage });

const AMB_TYPES = [
  "Basic Life Support (BLS)",
  "Advanced Life Support (ALS)",
  "Patient Transport",
  "Neonatal",
  "Air Ambulance",
];

// UI status ↔ ambulance_status enum
const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Active", value: "available" },
  { label: "Under Maintenance", value: "maintenance" },
  { label: "Retired", value: "out_of_service" },
];
function statusLabel(v: string) {
  if (v === "on_duty") return "On Duty";
  return STATUS_OPTIONS.find((s) => s.value === v)?.label ?? v.replace("_", " ");
}
function statusClass(v: string) {
  if (v === "available") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (v === "maintenance") return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  if (v === "out_of_service") return "bg-muted text-muted-foreground";
  return "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
}

type FleetForm = {
  vehicle_number: string;
  vehicle_type: string;
  driver_name: string;
  driver_phone: string;
  attendant_name: string;
  capacity: string;
  equipment: string;
  insurance_no: string;
  insurance_expiry: string;
  last_service_date: string;
  next_service_due: string;
  status: string;
  notes: string;
};

const EMPTY_FLEET: FleetForm = {
  vehicle_number: "", vehicle_type: AMB_TYPES[0], driver_name: "", driver_phone: "", attendant_name: "",
  capacity: "", equipment: "", insurance_no: "", insurance_expiry: "", last_service_date: "",
  next_service_due: "", status: "available", notes: "",
};

function AmbulancePage() {
  const [ambs, setAmbs] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ambulance_id: "", caller_name: "", caller_phone: "", pickup_location: "", destination: "", eta_minutes: 15, fare: 0 });

  const [fleetOpen, setFleetOpen] = useState(false);
  const [fleetEditId, setFleetEditId] = useState<string | null>(null);
  const [fleetForm, setFleetForm] = useState<FleetForm>({ ...EMPTY_FLEET });

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
    if (!form.ambulance_id) return toast.error("Select an ambulance from the fleet");
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await (supabase as any).from("ambulance_dispatches").insert({ ...form, dispatched_at: new Date().toISOString(), status: "dispatched", created_by: user?.id });
    if (error) return toast.error(error.message);
    await (supabase as any).from("ambulances").update({ status: "on_duty" } as any).eq("id", form.ambulance_id);
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

  async function removeTrip(id: string) {
    const { error } = await (supabase as any).from("ambulance_dispatches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dispatch deleted"); load();
  }

  function whatsappTrip(t: any) {
    const msg = `Ambulance dispatch ${t.dispatch_no}\nPickup: ${t.pickup_location}\nDestination: ${t.destination ?? "—"}\nETA: ${t.eta_minutes ?? "—"} min\nStatus: ${t.status}`;
    const phone = (t.caller_phone ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function openAddFleet() {
    setFleetEditId(null);
    setFleetForm({ ...EMPTY_FLEET });
    setFleetOpen(true);
  }
  function openEditFleet(a: any) {
    setFleetEditId(a.id);
    setFleetForm({
      vehicle_number: a.vehicle_number ?? "",
      vehicle_type: a.vehicle_type ?? AMB_TYPES[0],
      driver_name: a.driver_name ?? "",
      driver_phone: a.driver_phone ?? "",
      attendant_name: a.attendant_name ?? "",
      capacity: a.capacity != null ? String(a.capacity) : "",
      equipment: a.equipment ?? "",
      insurance_no: a.insurance_no ?? "",
      insurance_expiry: a.insurance_expiry ?? "",
      last_service_date: a.last_service_date ?? "",
      next_service_due: a.next_service_due ?? "",
      status: a.status === "on_duty" ? "available" : (a.status ?? "available"),
      notes: a.notes ?? "",
    });
    setFleetOpen(true);
  }

  async function saveFleet() {
    if (!fleetForm.vehicle_number.trim()) return toast.error("Vehicle number required");
    if (!fleetForm.driver_name.trim()) return toast.error("Driver name required");
    if (!fleetForm.driver_phone.trim()) return toast.error("Driver mobile required");
    const payload = {
      vehicle_number: fleetForm.vehicle_number.trim(),
      vehicle_type: fleetForm.vehicle_type,
      driver_name: fleetForm.driver_name.trim(),
      driver_phone: fleetForm.driver_phone.trim(),
      attendant_name: fleetForm.attendant_name || null,
      capacity: fleetForm.capacity ? Number(fleetForm.capacity) : null,
      equipment: fleetForm.equipment || null,
      insurance_no: fleetForm.insurance_no || null,
      insurance_expiry: fleetForm.insurance_expiry || null,
      last_service_date: fleetForm.last_service_date || null,
      next_service_due: fleetForm.next_service_due || null,
      status: fleetForm.status,
      notes: fleetForm.notes || null,
    };
    const q = fleetEditId
      ? (supabase as any).from("ambulances").update(payload as any).eq("id", fleetEditId)
      : (supabase as any).from("ambulances").insert(payload as any);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success(fleetEditId ? "Ambulance updated successfully" : "Ambulance added successfully");
    setFleetOpen(false);
    load();
  }

  async function removeFleet(id: string) {
    const { error } = await (supabase as any).from("ambulances").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ambulance deleted"); load();
  }

  const fleetOptions = ambs.filter((a) => a.status === "available");

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
              <div className="col-span-2"><Label>Ambulance *</Label>
                <Select value={form.ambulance_id} onValueChange={(v) => setForm({ ...form, ambulance_id: v })}>
                  <SelectTrigger><SelectValue placeholder={fleetOptions.length ? "Select vehicle from fleet" : "No available vehicle in fleet"} /></SelectTrigger>
                  <SelectContent>{fleetOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.vehicle_number} — {a.vehicle_type} · {a.driver_name ?? "No driver"}</SelectItem>)}</SelectContent>
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
                    <TableCell className="flex gap-1 items-center flex-wrap">
                      {t.status === "dispatched" && <Button size="sm" variant="outline" onClick={() => updateTrip(t.id, "en_route", t.ambulance_id)}>En route</Button>}
                      {t.status === "en_route" && <Button size="sm" variant="outline" onClick={() => updateTrip(t.id, "arrived", t.ambulance_id)}>Arrived</Button>}
                      {["arrived", "en_route", "dispatched"].includes(t.status) && <Button size="sm" onClick={() => updateTrip(t.id, "completed", t.ambulance_id)}>Complete</Button>}
                      <RecordActions onWhatsApp={() => whatsappTrip(t)} onDelete={() => removeTrip(t.id)} deleteLabel={`dispatch ${t.dispatch_no}`} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fleet">
          <Card><CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{ambs.length} vehicle{ambs.length === 1 ? "" : "s"} in fleet</div>
              <Button size="sm" onClick={openAddFleet}><Plus className="size-4 mr-1" /> Add Ambulance</Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Vehicle No</TableHead><TableHead>Type</TableHead><TableHead>Driver Name</TableHead>
                <TableHead>Driver Mobile</TableHead><TableHead>Status</TableHead><TableHead>Capacity</TableHead>
                <TableHead>Last Service</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ambs.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No ambulances yet. Add your first vehicle.</TableCell></TableRow>}
                {ambs.map((a) => {
                  const serviceSoon = a.next_service_due && differenceInCalendarDays(new Date(a.next_service_due), new Date()) <= 7;
                  const insExpired = a.insurance_expiry && differenceInCalendarDays(new Date(a.insurance_expiry), new Date()) < 0;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono flex items-center gap-1.5">
                        {a.vehicle_number}
                        {serviceSoon && <AlertTriangle className="size-3.5 text-amber-500" aria-label="Service due within 7 days" />}
                        {insExpired && <ShieldAlert className="size-3.5 text-destructive" aria-label="Insurance expired" />}
                      </TableCell>
                      <TableCell className="text-sm">{a.vehicle_type ?? "—"}</TableCell>
                      <TableCell className="text-sm">{a.driver_name ?? "—"}{a.attendant_name && <div className="text-xs text-muted-foreground">Attendant: {a.attendant_name}</div>}</TableCell>
                      <TableCell className="text-sm">{a.driver_phone ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={statusClass(a.status)}>{statusLabel(a.status)}</Badge></TableCell>
                      <TableCell className="text-sm">{a.capacity ?? "—"}</TableCell>
                      <TableCell className="text-sm">{a.last_service_date ? format(new Date(a.last_service_date), "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell>
                        <RecordActions onEdit={() => openEditFleet(a)} onDelete={() => removeFleet(a.id)} deleteLabel={`ambulance ${a.vehicle_number}`} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Add / Edit ambulance */}
      <Dialog open={fleetOpen} onOpenChange={setFleetOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{fleetEditId ? "Edit Ambulance" : "Add Ambulance"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Vehicle Number *</Label><Input placeholder="MH-12-AB-1234" value={fleetForm.vehicle_number} onChange={(e) => setFleetForm({ ...fleetForm, vehicle_number: e.target.value })} /></div>
            <div><Label>Ambulance Type</Label>
              <Select value={fleetForm.vehicle_type} onValueChange={(v) => setFleetForm({ ...fleetForm, vehicle_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AMB_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Driver Name *</Label><Input value={fleetForm.driver_name} onChange={(e) => setFleetForm({ ...fleetForm, driver_name: e.target.value })} /></div>
            <div><Label>Driver Mobile *</Label><Input value={fleetForm.driver_phone} onChange={(e) => setFleetForm({ ...fleetForm, driver_phone: e.target.value })} /></div>
            <div><Label>Co-driver / Attendant</Label><Input value={fleetForm.attendant_name} onChange={(e) => setFleetForm({ ...fleetForm, attendant_name: e.target.value })} /></div>
            <div><Label>Seating Capacity</Label><Input type="number" value={fleetForm.capacity} onChange={(e) => setFleetForm({ ...fleetForm, capacity: e.target.value })} /></div>
            <div className="col-span-2"><Label>Equipment Onboard</Label><Textarea rows={2} placeholder="Oxygen, Stretcher, Defibrillator" value={fleetForm.equipment} onChange={(e) => setFleetForm({ ...fleetForm, equipment: e.target.value })} /></div>
            <div><Label>Insurance Number</Label><Input value={fleetForm.insurance_no} onChange={(e) => setFleetForm({ ...fleetForm, insurance_no: e.target.value })} /></div>
            <div><Label>Insurance Expiry</Label><Input type="date" value={fleetForm.insurance_expiry} onChange={(e) => setFleetForm({ ...fleetForm, insurance_expiry: e.target.value })} /></div>
            <div><Label>Last Service Date</Label><Input type="date" value={fleetForm.last_service_date} onChange={(e) => setFleetForm({ ...fleetForm, last_service_date: e.target.value })} /></div>
            <div><Label>Next Service Due</Label><Input type="date" value={fleetForm.next_service_due} onChange={(e) => setFleetForm({ ...fleetForm, next_service_due: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={fleetForm.status} onValueChange={(v) => setFleetForm({ ...fleetForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={fleetForm.notes} onChange={(e) => setFleetForm({ ...fleetForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveFleet}>{fleetEditId ? "Save changes" : "Add ambulance"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
