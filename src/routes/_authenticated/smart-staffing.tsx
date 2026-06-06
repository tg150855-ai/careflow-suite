import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SimpleTable, type Col } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { Users, Plus } from "lucide-react";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/smart-staffing")({ component: StaffingPage });

function StaffingPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ department: "", forecast_date: format(new Date(), "yyyy-MM-dd"), required_doctors: "5", required_nurses: "10", required_support: "5", workload_score: "0.7", notes: "" });

  const load = () => listRows("staffing_forecasts", { order: "forecast_date" }).then(setRows);
  useEffect(() => { load(); }, []);

  async function save() {
    if (!f.department) return toast.error("Department required");
    await insertRow("staffing_forecasts", { ...f, required_doctors: +f.required_doctors, required_nurses: +f.required_nurses, required_support: +f.required_support, workload_score: +f.workload_score });
    toast.success("Saved"); setOpen(false); load();
  }

  const cols: Col<any>[] = [
    { header: "Department", cell: (r) => <div className="font-medium">{r.department}</div> },
    { header: "Date", cell: (r) => format(new Date(r.forecast_date), "dd MMM yyyy") },
    { header: "Doctors", cell: (r) => r.required_doctors },
    { header: "Nurses", cell: (r) => r.required_nurses },
    { header: "Support", cell: (r) => r.required_support },
    { header: "Workload", cell: (r) => <Badge variant={r.workload_score > 0.8 ? "destructive" : "secondary"}>{Math.round(r.workload_score * 100)}%</Badge> },
  ];

  const overload = rows.filter((r) => r.workload_score > 0.85).length;

  return (
    <div className="space-y-6">
      <PageHeader icon={Users} title="Smart Staffing" subtitle="Optimize workforce allocation across departments." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Add Forecast</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Staffing Forecast</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Department</Label><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></div>
              <div><Label>Date</Label><Input type="date" value={f.forecast_date} onChange={(e) => setF({ ...f, forecast_date: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Doctors</Label><Input type="number" value={f.required_doctors} onChange={(e) => setF({ ...f, required_doctors: e.target.value })} /></div>
                <div><Label>Nurses</Label><Input type="number" value={f.required_nurses} onChange={(e) => setF({ ...f, required_nurses: e.target.value })} /></div>
                <div><Label>Support</Label><Input type="number" value={f.required_support} onChange={(e) => setF({ ...f, required_support: e.target.value })} /></div>
              </div>
              <div><Label>Workload (0-1)</Label><Input type="number" step="0.1" value={f.workload_score} onChange={(e) => setF({ ...f, workload_score: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      {overload > 0 && <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">⚠️ {overload} departments showing overtime risk (workload &gt; 85%)</div>}

      <SimpleTable rows={rows} columns={cols} empty="No staffing forecasts yet." />
    </div>
  );
}
