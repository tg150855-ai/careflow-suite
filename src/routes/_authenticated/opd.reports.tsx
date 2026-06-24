import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileBarChart, CalendarDays, Stethoscope, IndianRupee, Download, TrendingUp,
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";

export const Route = createFileRoute("/_authenticated/opd/reports")({ component: OpdReports });

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#ec4899"];

function OpdReports() {
  const [days, setDays] = useState<number>(7);
  const [doctorFilter, setDoctorFilter] = useState<string>("all");

  const from = useMemo(() => startOfDay(subDays(new Date(), days - 1)).toISOString(), [days]);
  const to = useMemo(() => endOfDay(new Date()).toISOString(), []);

  const { data: doctors = [] } = useQuery({
    queryKey: ["opd-rep-doctors"],
    queryFn: async () => (await supabase.from("doctors").select("id, name, specialization").order("name")).data ?? [],
  });

  const { data: appts = [] } = useQuery({
    queryKey: ["opd-rep-appts", from, to, doctorFilter],
    queryFn: async () => {
      let q = supabase.from("appointments")
        .select("id, scheduled_at, status, doctor_id, patient_id, doctors(name)")
        .gte("scheduled_at", from).lte("scheduled_at", to);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      return (await q).data ?? [];
    },
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["opd-rep-visits", from, to, doctorFilter],
    queryFn: async () => {
      let q = supabase.from("opd_visits")
        .select("id, created_at, doctor_id, patient_id, diagnosis, doctors(name)")
        .gte("created_at", from).lte("created_at", to);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      return (await q).data ?? [];
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["opd-rep-bills", from, to, doctorFilter],
    queryFn: async () => {
      let q = supabase.from("bills")
        .select("id, total, paid, pending, status, created_at, doctor_id, opd_visit_id, patients(full_name, uhid), doctors(name)")
        .gte("created_at", from).lte("created_at", to)
        .not("opd_visit_id", "is", null);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      return (await q).data ?? [];
    },
  });

  // Aggregates
  const stats = useMemo(() => {
    const revenue = bills.reduce((s, b: any) => s + Number(b.total ?? 0), 0);
    const collected = bills.reduce((s, b: any) => s + Number(b.paid ?? 0), 0);
    const pending = bills.reduce((s, b: any) => s + Number(b.pending ?? 0), 0);
    const completed = appts.filter((a: any) => a.status === "completed").length;
    const cancelled = appts.filter((a: any) => a.status === "cancelled").length;
    const uniquePatients = new Set(visits.map((v: any) => v.patient_id)).size;
    return {
      appointments: appts.length,
      visits: visits.length,
      completed, cancelled,
      uniquePatients, revenue, collected, pending,
      conversion: appts.length ? Math.round((completed / appts.length) * 100) : 0,
    };
  }, [appts, visits, bills]);

  // Daily series
  const series = useMemo(() => {
    const dayRange = eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() });
    return dayRange.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const a = appts.filter((x: any) => format(new Date(x.scheduled_at), "yyyy-MM-dd") === key).length;
      const v = visits.filter((x: any) => format(new Date(x.created_at), "yyyy-MM-dd") === key).length;
      const r = bills.filter((x: any) => format(new Date(x.created_at), "yyyy-MM-dd") === key)
        .reduce((s, x: any) => s + Number(x.total ?? 0), 0);
      return { date: format(d, "dd MMM"), appointments: a, visits: v, revenue: Math.round(r) };
    });
  }, [appts, visits, bills, days]);

  // By doctor
  const byDoctor = useMemo(() => {
    const map = new Map<string, { name: string; visits: number; revenue: number }>();
    visits.forEach((v: any) => {
      const name = v.doctors?.name ?? "—";
      const cur = map.get(name) ?? { name, visits: 0, revenue: 0 };
      cur.visits += 1; map.set(name, cur);
    });
    bills.forEach((b: any) => {
      const name = b.doctors?.name ?? "—";
      const cur = map.get(name) ?? { name, visits: 0, revenue: 0 };
      cur.revenue += Number(b.total ?? 0); map.set(name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.visits - a.visits).slice(0, 8);
  }, [visits, bills]);

  // Status breakdown
  const statusBreak = useMemo(() => {
    const counts: Record<string, number> = {};
    appts.forEach((a: any) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [appts]);

  // Top diagnoses
  const topDiagnoses = useMemo(() => {
    const counts: Record<string, number> = {};
    visits.forEach((v: any) => {
      const d = (v.diagnosis ?? "").trim();
      if (!d) return;
      counts[d] = (counts[d] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [visits]);

  function exportCsv() {
    const rows = [
      ["bill_no_or_id", "date", "patient", "uhid", "doctor", "total", "paid", "pending", "status"],
      ...bills.map((b: any) => [
        b.id, format(new Date(b.created_at), "yyyy-MM-dd HH:mm"),
        b.patients?.full_name ?? "", b.patients?.uhid ?? "",
        b.doctors?.name ?? "", b.total, b.paid, b.pending, b.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `opd-bills-${format(new Date(), "yyyyMMdd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center"><FileBarChart className="size-4 text-primary" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">OPD reports</h1>
            <p className="text-xs text-muted-foreground">Footfall · doctor productivity · revenue</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Range</Label>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Today</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="All doctors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-3.5 mr-1.5" />Export CSV
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={CalendarDays} label="Appointments" value={stats.appointments} hint={`${stats.completed} completed · ${stats.cancelled} cancelled`} />
        <Kpi icon={Stethoscope} label="Consultations" value={stats.visits} hint={`${stats.uniquePatients} unique patients`} />
        <Kpi icon={IndianRupee} label="Revenue" value={`₹${stats.revenue.toLocaleString("en-IN")}`} hint={`₹${stats.collected.toLocaleString("en-IN")} collected`} />
        <Kpi icon={TrendingUp} label="Conversion" value={`${stats.conversion}%`} hint={`Pending ₹${stats.pending.toLocaleString("en-IN")}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">Daily footfall &amp; revenue</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="l" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="r" orientation="right" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="l" type="monotone" dataKey="appointments" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line yAxisId="l" type="monotone" dataKey="visits" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Status */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Appointment status</h2>
          {statusBreak.length === 0 ? (
            <p className="text-xs text-muted-foreground py-10 text-center">No data.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreak} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {statusBreak.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Doctor productivity */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Doctor productivity</h2>
          {byDoctor.length === 0 ? (
            <p className="text-xs text-muted-foreground py-10 text-center">No data.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDoctor} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="visits" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Top diagnoses */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Top diagnoses</h2>
          {topDiagnoses.length === 0 ? (
            <p className="text-xs text-muted-foreground py-10 text-center">No diagnoses recorded.</p>
          ) : (
            <div className="space-y-1.5">
              {topDiagnoses.map((d, i) => {
                const max = topDiagnoses[0].value || 1;
                return (
                  <div key={d.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate pr-2">{d.name}</span>
                      <Badge variant="secondary" className="rounded-full">{d.value}</Badge>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Recent bills */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent OPD invoices</h2>
          <Badge variant="secondary" className="rounded-full">{bills.length}</Badge>
        </div>
        {bills.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No invoices in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium py-2">Date</th>
                  <th className="text-left font-medium py-2">Patient</th>
                  <th className="text-left font-medium py-2">Doctor</th>
                  <th className="text-right font-medium py-2">Total</th>
                  <th className="text-right font-medium py-2">Paid</th>
                  <th className="text-right font-medium py-2">Pending</th>
                  <th className="text-left font-medium py-2 pl-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.slice(0, 15).map((b: any) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 text-xs text-muted-foreground">{format(new Date(b.created_at), "dd MMM HH:mm")}</td>
                    <td className="py-2">
                      <div className="font-medium">{b.patients?.full_name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{b.patients?.uhid}</div>
                    </td>
                    <td className="py-2 text-xs">{b.doctors?.name ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">₹{Number(b.total).toFixed(0)}</td>
                    <td className="py-2 text-right tabular-nums">₹{Number(b.paid).toFixed(0)}</td>
                    <td className="py-2 text-right tabular-nums">{Number(b.pending) > 0 ? <span className="text-amber-700 dark:text-amber-400">₹{Number(b.pending).toFixed(0)}</span> : "—"}</td>
                    <td className="py-2 pl-3"><span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-muted">{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />{label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}
