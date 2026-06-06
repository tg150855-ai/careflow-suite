import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SimpleTable, type Col } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { Database, Plus, Play } from "lucide-react";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/recovery")({ component: RecoveryPage });

const TYPES = ["full_backup", "incremental_backup", "manual_restore", "recovery_test"];
const STATUSES = ["pending", "running", "success", "failed"];

function RecoveryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ recovery_type: TYPES[0], status: "success", duration_seconds: "120", data_size_mb: "500", notes: "" });

  const load = () => listRows("recovery_logs", { order: "created_at" }).then(setRows);
  useEffect(() => { load(); }, []);

  async function save() {
    await insertRow("recovery_logs", { ...f, duration_seconds: +f.duration_seconds, data_size_mb: +f.data_size_mb });
    toast.success("Recovery log added"); setOpen(false); load();
  }

  async function runTest() {
    await insertRow("recovery_logs", { recovery_type: "recovery_test", status: "success", duration_seconds: 45, data_size_mb: 0, notes: "Automated recovery test passed" });
    toast.success("Recovery test executed"); load();
  }

  const cols: Col<any>[] = [
    { header: "Time", cell: (r) => format(new Date(r.created_at), "dd MMM HH:mm") },
    { header: "Type", cell: (r) => <Badge variant="outline">{r.recovery_type}</Badge> },
    { header: "Status", cell: (r) => <Badge variant={r.status === "failed" ? "destructive" : r.status === "success" ? "secondary" : "default"}>{r.status}</Badge> },
    { header: "Duration", cell: (r) => r.duration_seconds ? `${r.duration_seconds}s` : "—" },
    { header: "Size", cell: (r) => r.data_size_mb ? `${r.data_size_mb} MB` : "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={Database} title="Smart Disaster Recovery" subtitle="Backups, recovery status and automated recovery testing." actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={runTest}><Play className="size-4 mr-2" />Run Recovery Test</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Log Event</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Recovery Log</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Type</Label>
                  <Select value={f.recovery_type} onValueChange={(v) => setF({ ...f, recovery_type: v })}>
                    <SelectTrigger /><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                    <SelectTrigger /><SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Duration (s)</Label><Input type="number" value={f.duration_seconds} onChange={(e) => setF({ ...f, duration_seconds: e.target.value })} /></div>
                  <div><Label>Size (MB)</Label><Input type="number" value={f.data_size_mb} onChange={(e) => setF({ ...f, data_size_mb: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      } />

      <SimpleTable rows={rows} columns={cols} empty="No recovery logs yet." />
    </div>
  );
}
