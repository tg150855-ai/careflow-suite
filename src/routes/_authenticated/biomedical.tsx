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
import { Wrench, Plus } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/biomedical")({ component: BiomedPage });

function BiomedPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [logFor, setLogFor] = useState<any>(null);

  const load = () => {
    supabase.from("biomedical_assets" as any).select("*, maintenance_logs(id, log_date, type, next_due_date)")
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => setAssets(data ?? []));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Wrench className="size-6 text-primary" /> Biomedical Equipment</h1>
          <p className="text-sm text-muted-foreground">Equipment registry, warranty, AMC and maintenance schedules.</p>
        </div>
        <NewAssetDialog onCreated={load} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Assets" value={assets.length} />
        <Stat label="AMC Expiring (30d)" value={assets.filter((a) => a.amc_expiry && differenceInDays(new Date(a.amc_expiry), new Date()) < 30 && differenceInDays(new Date(a.amc_expiry), new Date()) >= 0).length} />
        <Stat label="Service Due" value={assets.filter((a) => a.next_service_date && differenceInDays(new Date(a.next_service_date), new Date()) <= 7).length} />
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {assets.map((a) => (
            <div key={a.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{a.name} <Badge variant="outline" className="ml-2">{a.category ?? "—"}</Badge></div>
                <div className="text-xs text-muted-foreground">
                  {a.manufacturer ?? "—"} · SN: {a.serial_number ?? "—"} · {a.location ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Warranty: {a.warranty_expiry ? format(new Date(a.warranty_expiry), "dd MMM yyyy") : "—"} · AMC: {a.amc_expiry ? format(new Date(a.amc_expiry), "dd MMM yyyy") : "—"} · Next Service: {a.next_service_date ? format(new Date(a.next_service_date), "dd MMM yyyy") : "—"}
                </div>
              </div>
              <Badge variant="outline" className="capitalize">{a.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => setLogFor(a)}>Log Maintenance</Button>
            </div>
          ))}
          {assets.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No equipment registered.</div>}
        </CardContent>
      </Card>

      <MaintDialog asset={logFor} onClose={() => { setLogFor(null); load(); }} />
    </div>
  );
}

function Stat({ label, value }: any) {
  return <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-semibold tabular-nums mt-1">{value}</div></CardContent></Card>;
}

function NewAssetDialog({ onCreated }: any) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", category: "MRI Machine", manufacturer: "", serial_number: "", location: "", warranty_expiry: "", amc_expiry: "", next_service_date: "" });
  const submit = async () => {
    if (!f.name) return toast.error("Name required");
    const { error } = await supabase.from("biomedical_assets" as any).insert({
      ...f, asset_no: `BME-${Date.now().toString(36).toUpperCase()}`,
      warranty_expiry: f.warranty_expiry || null, amc_expiry: f.amc_expiry || null, next_service_date: f.next_service_date || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Asset added"); setOpen(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New Asset</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Register Equipment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Category</Label>
              <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["MRI Machine", "CT Scanner", "X-Ray Machine", "Ventilator", "Dialysis Machine", "Ultrasound", "ECG", "Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Manufacturer</Label><Input value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></div>
            <div><Label>Serial Number</Label><Input value={f.serial_number} onChange={(e) => setF({ ...f, serial_number: e.target.value })} /></div>
            <div className="col-span-2"><Label>Location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
            <div><Label>Warranty Expiry</Label><Input type="date" value={f.warranty_expiry} onChange={(e) => setF({ ...f, warranty_expiry: e.target.value })} /></div>
            <div><Label>AMC Expiry</Label><Input type="date" value={f.amc_expiry} onChange={(e) => setF({ ...f, amc_expiry: e.target.value })} /></div>
            <div className="col-span-2"><Label>Next Service Date</Label><Input type="date" value={f.next_service_date} onChange={(e) => setF({ ...f, next_service_date: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintDialog({ asset, onClose }: any) {
  const [f, setF] = useState({ type: "preventive", performed_by: "", description: "", cost: "", next_due_date: "" });
  const submit = async () => {
    const { error } = await supabase.from("maintenance_logs" as any).insert({
      asset_id: asset.id, type: f.type, performed_by: f.performed_by || null, description: f.description || null,
      cost: Number(f.cost) || 0, next_due_date: f.next_due_date || null,
    });
    if (error) return toast.error(error.message);
    if (f.next_due_date) await supabase.from("biomedical_assets" as any).update({ next_service_date: f.next_due_date }).eq("id", asset.id);
    toast.success("Logged"); onClose();
  };
  if (!asset) return null;
  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Maintenance — {asset.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Type</Label>
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["preventive", "breakdown", "calibration", "amc_visit"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Performed By</Label><Input value={f.performed_by} onChange={(e) => setF({ ...f, performed_by: e.target.value })} /></div>
            <div><Label>Cost (₹)</Label><Input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></div>
          </div>
          <div><Label>Description</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><Label>Next Due Date</Label><Input type="date" value={f.next_due_date} onChange={(e) => setF({ ...f, next_due_date: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Save Log</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
