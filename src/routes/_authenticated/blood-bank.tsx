import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Droplet, Plus, Users } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/blood-bank")({ component: BloodBankPage });

const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPONENTS = ["Whole Blood", "PRBC", "Platelets", "Plasma"];

function BloodBankPage() {
  const [donors, setDonors] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  const load = () => {
    supabase.from("blood_donors" as any).select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => setDonors(data ?? []));
    supabase.from("blood_inventory" as any).select("*, blood_donors(full_name)").order("expiry_date").limit(300).then(({ data }) => setInventory(data ?? []));
    supabase.from("blood_requests" as any).select("*, patients(full_name, uhid)").order("created_at", { ascending: false }).limit(200).then(({ data }) => setRequests(data ?? []));
  };

  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  const stockByGroup = GROUPS.map((g) => ({ g, count: inventory.filter((i) => i.blood_group === g && i.status === "available").length }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Droplet className="size-6 text-primary" /> Blood Bank</h1>
        <p className="text-sm text-muted-foreground">Donors, inventory, requests and issue workflow.</p>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {stockByGroup.map((s) => (
          <Card key={s.g}><CardContent className="pt-4 text-center">
            <div className="text-xs text-muted-foreground">{s.g}</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{s.count}</div>
            <div className="text-[10px] text-muted-foreground">units</div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="donors">Donors</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <div className="flex justify-end mb-3"><NewInventoryDialog donors={donors} onCreated={load} /></div>
          <Card><CardContent className="p-0 divide-y">
            {inventory.map((i) => {
              const days = differenceInDays(new Date(i.expiry_date), new Date());
              return (
                <div key={i.id} className="p-3 flex items-center gap-3">
                  <Badge>{i.blood_group}</Badge>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{i.component} <span className="text-muted-foreground font-normal">· Bag {i.bag_no ?? "—"}</span></div>
                    <div className="text-xs text-muted-foreground">Donor: {i.blood_donors?.full_name ?? "—"} · Collected {format(new Date(i.collection_date), "dd MMM")}</div>
                  </div>
                  <Badge variant={days < 0 ? "destructive" : days < 7 ? "default" : "outline"}>
                    {days < 0 ? "Expired" : `${days}d to expiry`}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{i.status}</Badge>
                </div>
              );
            })}
            {inventory.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No inventory.</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="donors">
          <div className="flex justify-end mb-3"><NewDonorDialog onCreated={load} /></div>
          <Card><CardContent className="p-0 divide-y">
            {donors.map((d) => (
              <div key={d.id} className="p-3 flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Users className="size-4" /></div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{d.full_name} <Badge variant="outline" className="ml-2">{d.blood_group}</Badge></div>
                  <div className="text-xs text-muted-foreground">{d.mobile ?? "—"} · {d.total_donations ?? 0} donations · Last: {d.last_donation_at ? format(new Date(d.last_donation_at), "dd MMM yyyy") : "—"}</div>
                </div>
              </div>
            ))}
            {donors.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No donors yet.</div>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="requests">
          <div className="flex justify-end mb-3"><NewRequestDialog patients={patients} onCreated={load} /></div>
          <Card><CardContent className="p-0 divide-y">
            {requests.map((r) => (
              <div key={r.id} className="p-3 flex items-center gap-3">
                <Badge>{r.blood_group}</Badge>
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.patients?.full_name ?? "—"} ({r.patients?.uhid ?? ""}) · {r.units}× {r.component}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd MMM HH:mm")} · {r.priority}</div>
                </div>
                <Badge variant={r.status === "issued" ? "outline" : r.status === "approved" ? "default" : "secondary"} className="capitalize">{r.status}</Badge>
                {r.status === "pending" && <Button size="sm" variant="outline" onClick={async () => { await supabase.from("blood_requests" as any).update({ status: "approved" }).eq("id", r.id); toast.success("Approved"); load(); }}>Approve</Button>}
                {r.status === "approved" && <Button size="sm" onClick={async () => { await supabase.from("blood_requests" as any).update({ status: "issued" }).eq("id", r.id); toast.success("Issued"); load(); }}>Issue</Button>}
              </div>
            ))}
            {requests.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No requests.</div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NewDonorDialog({ onCreated }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", blood_group: "O+", mobile: "", gender: "male" });
  const submit = async () => {
    if (!f.full_name) return toast.error("Name required");
    const { error } = await supabase.from("blood_donors" as any).insert({ ...f, donor_no: `BD-${Date.now().toString(36).toUpperCase()}` });
    if (error) return toast.error(error.message);
    toast.success("Donor added"); setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New Donor</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Register Donor</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full Name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Blood Group</Label>
              <Select value={f.blood_group} onValueChange={(v) => setF({ ...f, blood_group: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Mobile</Label><Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewInventoryDialog({ donors, onCreated }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ donor_id: "", blood_group: "O+", component: "Whole Blood", bag_no: "", volume_ml: "450", expiry_date: format(new Date(Date.now() + 35 * 86400000), "yyyy-MM-dd") });
  const submit = async () => {
    const { error } = await supabase.from("blood_inventory" as any).insert({
      donor_id: f.donor_id || null, blood_group: f.blood_group, component: f.component, bag_no: f.bag_no || null,
      volume_ml: Number(f.volume_ml) || null, expiry_date: f.expiry_date,
    });
    if (error) return toast.error(error.message);
    toast.success("Added to inventory"); setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Add Unit</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Blood Unit</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Donor</Label>
            <Select value={f.donor_id} onValueChange={(v) => setF({ ...f, donor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select donor (optional)" /></SelectTrigger>
              <SelectContent>{donors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name} ({d.blood_group})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Group</Label>
              <Select value={f.blood_group} onValueChange={(v) => setF({ ...f, blood_group: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Component</Label>
              <Select value={f.component} onValueChange={(v) => setF({ ...f, component: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMPONENTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Bag No</Label><Input value={f.bag_no} onChange={(e) => setF({ ...f, bag_no: e.target.value })} /></div>
            <div><Label>Volume (ml)</Label><Input type="number" value={f.volume_ml} onChange={(e) => setF({ ...f, volume_ml: e.target.value })} /></div>
            <div className="col-span-2"><Label>Expiry Date</Label><Input type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewRequestDialog({ patients, onCreated }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patient_id: "", blood_group: "O+", component: "PRBC", units: "1", priority: "routine", notes: "" });
  const submit = async () => {
    if (!f.patient_id) return toast.error("Patient required");
    const { error } = await supabase.from("blood_requests" as any).insert({ ...f, units: Number(f.units) || 1 });
    if (error) return toast.error(error.message);
    toast.success("Request created"); setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New Request</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Blood Request</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Group</Label>
              <Select value={f.blood_group} onValueChange={(v) => setF({ ...f, blood_group: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Component</Label>
              <Select value={f.component} onValueChange={(v) => setF({ ...f, component: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMPONENTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Units</Label><Input type="number" value={f.units} onChange={(e) => setF({ ...f, units: e.target.value })} /></div>
          </div>
          <div><Label>Priority</Label>
            <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["routine", "urgent", "emergency"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Submit</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
