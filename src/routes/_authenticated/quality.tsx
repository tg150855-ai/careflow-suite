import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Plus } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

export const Route = createFileRoute("/_authenticated/quality")({ component: QualityPage });

const METRICS = ["mortality_rate","readmission_rate","infection_rate","surgical_outcome","avg_length_of_stay","patient_satisfaction"];

function QualityPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ metric: "mortality_rate", department: "", period: "", value: "", target: "" });

  const load = () => (supabase.from("quality_metrics" as any) as any).select("*").order("period", { ascending: true }).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { error } = await (supabase.from("quality_metrics" as any) as any).insert({ ...form, value: parseFloat(form.value), target: form.target ? parseFloat(form.target) : null });
    if (error) return toast.error(error.message);
    toast.success("Recorded"); setOpen(false); load();
  };

  const byMetric = (m: string) => rows.filter((r) => r.metric === m).map((r) => ({ period: r.period, value: r.value, target: r.target }));
  const latest = (m: string) => byMetric(m).slice(-1)[0]?.value ?? null;
  const byDept = (m: string) => {
    const map: any = {};
    rows.filter((r) => r.metric === m).forEach((r) => { if (r.department) map[r.department] = (map[r.department] ?? 0) + r.value; });
    return Object.entries(map).map(([department, value]) => ({ department, value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Activity className="size-6 text-primary" /> Clinical Quality Dashboard</h1>
          <p className="text-sm text-muted-foreground">Mortality, readmission, infection, surgical outcome & LOS trends.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Add metric</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Quality Metric</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Metric</Label>
                <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{METRICS.map((m) => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              <div><Label>Period</Label><Input type="date" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></div>
              <div><Label>Value</Label><Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div><Label>Target</Label><Input type="number" step="0.01" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {METRICS.map((m) => (
          <Card key={m}><CardContent className="pt-4">
            <div className="text-xs text-muted-foreground capitalize">{m.replace(/_/g, " ")}</div>
            <div className="text-2xl font-bold">{latest(m) ?? "—"}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="pt-4">
        <div className="text-sm font-semibold mb-2">Mortality rate trend</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={byMetric("mortality_rate")}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" />
            <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent></Card>

      <Card><CardContent className="pt-4">
        <div className="text-sm font-semibold mb-2">Infection rate by department</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byDept("infection_rate")}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="department" /><YAxis /><Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent></Card>
    </div>
  );
}
