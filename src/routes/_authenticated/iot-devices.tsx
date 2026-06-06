import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable, type Col } from "@/components/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Activity, Cpu } from "lucide-react";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/iot-devices")({ component: IotPage });

const TYPES = ["patient_monitor", "ecg", "ventilator", "glucometer", "pulse_oximeter", "smart_bed"];

function IotPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ device_name: "", device_type: TYPES[0], serial_no: "", location: "" });

  async function load() {
    setDevices(await listRows("iot_devices", { order: "created_at" }));
    setReadings(await listRows("device_readings", { order: "recorded_at", limit: 50 }));
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!f.device_name) return toast.error("Device name required");
    await insertRow("iot_devices", { ...f, last_seen_at: new Date().toISOString() });
    toast.success("Device registered");
    setOpen(false); setF({ device_name: "", device_type: TYPES[0], serial_no: "", location: "" });
    load();
  }

  const cols: Col<any>[] = [
    { header: "Device", cell: (r) => <div className="font-medium">{r.device_name}</div> },
    { header: "Type", cell: (r) => <Badge variant="outline">{r.device_type}</Badge> },
    { header: "Serial", cell: (r) => r.serial_no ?? "—" },
    { header: "Location", cell: (r) => r.location ?? "—" },
    { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
    { header: "Last Seen", cell: (r) => r.last_seen_at ? format(new Date(r.last_seen_at), "dd MMM HH:mm") : "—" },
  ];

  const alerts = readings.filter((r) => r.is_alert).length;

  return (
    <div className="space-y-6">
      <PageHeader icon={Cpu} title="IoT Device Integration" subtitle="Connect medical devices and capture real-time readings." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Add Device</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register IoT Device</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={f.device_name} onChange={(e) => setF({ ...f, device_name: e.target.value })} /></div>
              <div><Label>Type</Label>
                <Select value={f.device_type} onValueChange={(v) => setF({ ...f, device_type: v })}>
                  <SelectTrigger /><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Serial No.</Label><Input value={f.serial_no} onChange={(e) => setF({ ...f, serial_no: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Devices" value={devices.length} />
        <Stat label="Active" value={devices.filter((d) => d.status === "active").length} />
        <Stat label="Active Alerts" value={alerts} accent={alerts > 0 ? "destructive" : undefined} />
      </div>

      <div><h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Activity className="size-4" /> Registered Devices</h2><SimpleTable rows={devices} columns={cols} empty="No devices registered yet." /></div>
    </div>
  );
}

function Stat({ label, value, accent }: any) {
  return <div className="rounded-lg border bg-card p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold mt-1 ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</div>
  </div>;
}
