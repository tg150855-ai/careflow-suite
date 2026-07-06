import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileBarChart, BedDouble, LogOut, ArrowLeftRight, Skull, IndianRupee, Download, Printer, Share2, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { format, startOfDay, endOfDay, subDays, startOfMonth, startOfYear, eachDayOfInterval, eachMonthOfInterval } from "date-fns";
import { exportXlsx } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/ipd/reports")({ component: IpdReports });

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#ec4899"];
type Range = "today" | "7d" | "month" | "ytd" | "year";

function rangeBounds(r: Range) {
  const now = new Date();
  switch (r) {
    case "today": return { from: startOfDay(now), to: endOfDay(now), bucket: "day" as const };
    case "7d":    return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), bucket: "day" as const };
    case "month": return { from: startOfMonth(now), to: endOfDay(now), bucket: "day" as const };
    case "ytd":   return { from: startOfYear(now), to: endOfDay(now), bucket: "month" as const };
    case "year":  return { from: startOfDay(subDays(now, 365)), to: endOfDay(now), bucket: "month" as const };
  }
}

function IpdReports() {
  const [range, setRange] = useState<Range>("month");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [wardFilter, setWardFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { from, to, bucket } = useMemo(() => rangeBounds(range), [range]);
  const fromISO = from.toISOString(); const toISO = to.toISOString();

  const { data: doctors = [] } = useQuery({ queryKey: ["ipd-rep-doctors"], queryFn: async () => (await supabase.from("doctors").select("id, name").order("name")).data ?? [] });
  const { data: wards = [] } = useQuery({ queryKey: ["ipd-rep-wards"], queryFn: async () => (await supabase.from("wards").select("id, name, type").order("name")).data ?? [] });

  const { data: admissions = [] } = useQuery({
    queryKey: ["ipd-rep-adm", fromISO, toISO, doctorFilter, wardFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from("admissions")
        .select("id, admission_no, admitted_at, discharged_at, status, doctor_id, ward_id, bed_id, patient_id, is_emergency, patients(full_name, uhid), doctors(name), wards(name, type), beds(bed_number, charge_per_day)")
        .gte("admitted_at", fromISO).lte("admitted_at", toISO);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      if (wardFilter !== "all") q = q.eq("ward_id", wardFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      return (await q).data ?? [];
    },
  });

  const { data: discharges = [] } = useQuery({
    queryKey: ["ipd-rep-disch", fromISO, toISO],
    queryFn: async () => (await supabase.from("discharge_summaries").select("id, discharge_date, admission_id, admissions(admission_no, patient_id, doctor_id, ward_id, patients(full_name, uhid), doctors(name), wards(name))").gte("discharge_date", fromISO).lte("discharge_date", toISO)).data ?? [],
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ["ipd-rep-trans", fromISO, toISO],
    queryFn: async () => (await supabase.from("bed_transfers").select("id, transferred_at, reason, admission_id, from_ward:from_ward_id(name), to_ward:to_ward_id(name), from_bed:from_bed_id(bed_number), to_bed:to_bed_id(bed_number), admissions(admission_no, patients(full_name, uhid))").gte("transferred_at", fromISO).lte("transferred_at", toISO).order("transferred_at", { ascending: false })).data ?? [],
  });

  const { data: deaths = [] } = useQuery({
    queryKey: ["ipd-rep-deaths", fromISO, toISO],
    queryFn: async () => (await supabase.from("death_register").select("id, died_at, cause_of_death, certifying_doctor_name, patients(full_name, uhid), admissions(admission_no)").gte("died_at", fromISO).lte("died_at", toISO).order("died_at", { ascending: false })).data ?? [],
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["ipd-rep-bills", fromISO, toISO, doctorFilter],
    queryFn: async () => {
      let q = supabase.from("bills")
        .select("id, bill_no, total, paid, pending, status, created_at, doctor_id, admission_id, patients(full_name, uhid), doctors(name)")
        .gte("created_at", fromISO).lte("created_at", toISO)
        .not("admission_id", "is", null);
      if (doctorFilter !== "all") q = q.eq("doctor_id", doctorFilter);
      return (await q).data ?? [];
    },
  });

  const { data: bedSnapshot = [] } = useQuery({
    queryKey: ["ipd-rep-bed-snap"],
    queryFn: async () => (await supabase.from("beds").select("id, status, ward_id, wards(name, type)")).data ?? [],
  });

  const stats = useMemo(() => {
    const revenue = bills.reduce((s, b: any) => s + Number(b.total ?? 0), 0);
    const collected = bills.reduce((s, b: any) => s + Number(b.paid ?? 0), 0);
    const pending = bills.reduce((s, b: any) => s + Number(b.pending ?? 0), 0);
    const occ = bedSnapshot.filter((b: any) => b.status === "occupied").length;
    const total = bedSnapshot.length || 1;
    return {
      admissions: admissions.length,
      discharges: discharges.length,
      transfers: transfers.length,
      deaths: deaths.length,
      occupancyPct: Math.round((occ / total) * 100),
      occupiedBeds: occ, totalBeds: bedSnapshot.length,
      revenue, collected, pending,
    };
  }, [admissions, discharges, transfers, deaths, bills, bedSnapshot]);

  const series = useMemo(() => {
    if (bucket === "day") {
      const dayRange = eachDayOfInterval({ start: from, end: to });
      return dayRange.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        return {
          date: format(d, "dd MMM"),
          admissions: admissions.filter((x: any) => format(new Date(x.admitted_at), "yyyy-MM-dd") === key).length,
          discharges: discharges.filter((x: any) => x.discharge_date && format(new Date(x.discharge_date), "yyyy-MM-dd") === key).length,
          revenue: Math.round(bills.filter((x: any) => format(new Date(x.created_at), "yyyy-MM-dd") === key).reduce((s, x: any) => s + Number(x.total ?? 0), 0)),
        };
      });
    }
    const months = eachMonthOfInterval({ start: from, end: to });
    return months.map((m) => {
      const key = format(m, "yyyy-MM");
      return {
        date: format(m, "MMM yy"),
        admissions: admissions.filter((x: any) => format(new Date(x.admitted_at), "yyyy-MM") === key).length,
        discharges: discharges.filter((x: any) => x.discharge_date && format(new Date(x.discharge_date), "yyyy-MM") === key).length,
        revenue: Math.round(bills.filter((x: any) => format(new Date(x.created_at), "yyyy-MM") === key).reduce((s, x: any) => s + Number(x.total ?? 0), 0)),
      };
    });
  }, [bucket, from, to, admissions, discharges, bills]);

  const byWard = useMemo(() => {
    const map = new Map<string, number>();
    admissions.forEach((a: any) => { const k = a.wards?.name ?? "—"; map.set(k, (map.get(k) ?? 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [admissions]);

  const statusBreak = useMemo(() => {
    const counts: Record<string, number> = {};
    admissions.forEach((a: any) => { counts[a.status] = (counts[a.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [admissions]);

  function buildAllSheets() {
    return {
      Admissions: admissions.map((a: any) => ({
        AdmissionNo: a.admission_no, Patient: a.patients?.full_name, UHID: a.patients?.uhid,
        Doctor: a.doctors?.name, Ward: a.wards?.name, Bed: a.beds?.bed_number,
        AdmittedAt: format(new Date(a.admitted_at), "yyyy-MM-dd HH:mm"),
        DischargedAt: a.discharged_at ? format(new Date(a.discharged_at), "yyyy-MM-dd HH:mm") : "",
        Status: a.status, Emergency: a.is_emergency ? "Yes" : "No",
      })),
      Discharges: discharges.map((d: any) => ({
        AdmissionNo: d.admissions?.admission_no, Patient: d.admissions?.patients?.full_name, UHID: d.admissions?.patients?.uhid,
        Doctor: d.admissions?.doctors?.name, Ward: d.admissions?.wards?.name,
        DischargeDate: d.discharge_date ? format(new Date(d.discharge_date), "yyyy-MM-dd HH:mm") : "",
      })),
      Transfers: transfers.map((t: any) => ({
        TransferredAt: format(new Date(t.transferred_at), "yyyy-MM-dd HH:mm"),
        AdmissionNo: t.admissions?.admission_no, Patient: t.admissions?.patients?.full_name, UHID: t.admissions?.patients?.uhid,
        FromWard: t.from_ward?.name, FromBed: t.from_bed?.bed_number,
        ToWard: t.to_ward?.name, ToBed: t.to_bed?.bed_number, Reason: t.reason,
      })),
      Deaths: deaths.map((d: any) => ({
        Date: format(new Date(d.died_at), "yyyy-MM-dd HH:mm"),
        Patient: d.patients?.full_name, UHID: d.patients?.uhid,
        AdmissionNo: d.admissions?.admission_no, Cause: d.cause_of_death, CertifiedBy: d.certifying_doctor_name,
      })),
      Billing: bills.map((b: any) => ({
        BillNo: b.bill_no, Date: format(new Date(b.created_at), "yyyy-MM-dd HH:mm"),
        Patient: b.patients?.full_name, UHID: b.patients?.uhid, Doctor: b.doctors?.name,
        Total: Number(b.total), Paid: Number(b.paid), Pending: Number(b.pending), Status: b.status,
      })),
    };
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const sheets = buildAllSheets();
    Object.entries(sheets).forEach(([name, rows]) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: "No data" }]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, `ipd-report-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`);
  }

  function exportCsv() {
    const sheets = buildAllSheets();
    const lines: string[] = [];
    Object.entries(sheets).forEach(([name, rows]) => {
      lines.push(`# ${name}`);
      if (!rows.length) { lines.push("(no data)"); lines.push(""); return; }
      const headers = Object.keys(rows[0]);
      lines.push(headers.join(","));
      rows.forEach((r) => lines.push(headers.map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`).join(",")));
      lines.push("");
    });
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `ipd-report-${format(new Date(), "yyyyMMdd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function shareWhatsApp() {
    const text =
      `*IPD Report* (${format(from, "dd MMM")} – ${format(to, "dd MMM yyyy")})\n` +
      `Admissions: ${stats.admissions}\nDischarges: ${stats.discharges}\nTransfers: ${stats.transfers}\nDeaths: ${stats.deaths}\n` +
      `Bed occupancy: ${stats.occupiedBeds}/${stats.totalBeds} (${stats.occupancyPct}%)\n` +
      `Revenue: ₹${stats.revenue.toLocaleString("en-IN")} · Collected ₹${stats.collected.toLocaleString("en-IN")} · Pending ₹${stats.pending.toLocaleString("en-IN")}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/ipd"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center"><FileBarChart className="size-4 text-primary" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">IPD reports</h1>
            <p className="text-xs text-muted-foreground">Admissions · discharges · transfers · occupancy · revenue</p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">Range</Label>
            <Select value={range} onValueChange={(v) => setRange(v as Range)}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
                <SelectItem value="year">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={doctorFilter} onValueChange={setDoctorFilter}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="All doctors" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={wardFilter} onValueChange={setWardFilter}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All wards" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All wards</SelectItem>
              {wards.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="All status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {["active", "discharged", "transferred", "absconded"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-3.5 mr-1.5" />Print</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-3.5 mr-1.5" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="size-3.5 mr-1.5" />Excel</Button>
          <Button variant="outline" size="sm" onClick={shareWhatsApp}><Share2 className="size-3.5 mr-1.5" />Share</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={BedDouble} label="Admissions" value={stats.admissions} />
        <Kpi icon={LogOut} label="Discharges" value={stats.discharges} />
        <Kpi icon={ArrowLeftRight} label="Transfers" value={stats.transfers} />
        <Kpi icon={Skull} label="Deaths" value={stats.deaths} />
        <Kpi icon={BedDouble} label="Bed occupancy" value={`${stats.occupancyPct}%`} hint={`${stats.occupiedBeds}/${stats.totalBeds} beds`} />
        <Kpi icon={IndianRupee} label="Revenue" value={`₹${stats.revenue.toLocaleString("en-IN")}`} hint={`Pending ₹${stats.pending.toLocaleString("en-IN")}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">Admissions, discharges &amp; revenue</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="l" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="r" orientation="right" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="l" type="monotone" dataKey="admissions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line yAxisId="l" type="monotone" dataKey="discharges" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Admissions by status</h2>
          {statusBreak.length === 0 ? <p className="text-xs text-muted-foreground py-10 text-center">No data.</p> : (
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
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Admissions by ward</h2>
          {byWard.length === 0 ? <p className="text-xs text-muted-foreground py-10 text-center">No data.</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byWard} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent transfers</h2>
            <Badge variant="secondary" className="rounded-full">{transfers.length}</Badge>
          </div>
          <div className="space-y-2 text-sm max-h-72 overflow-auto">
            {transfers.slice(0, 8).map((t: any) => (
              <div key={t.id} className="flex items-start gap-2 border-b last:border-0 pb-2 last:pb-0">
                <div className="text-xs text-muted-foreground w-24 shrink-0">{format(new Date(t.transferred_at), "dd MMM HH:mm")}</div>
                <div className="flex-1">
                  <div className="text-xs"><span className="font-medium">{t.admissions?.patients?.full_name}</span> · {t.from_ward?.name ?? "—"}/Bed {t.from_bed?.bed_number ?? "—"} → {t.to_ward?.name ?? "—"}/Bed {t.to_bed?.bed_number ?? "—"}</div>
                  {t.reason && <div className="text-[11px] text-muted-foreground">{t.reason}</div>}
                </div>
              </div>
            ))}
            {transfers.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">No transfers in range.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">IPD invoices</h2>
          <Badge variant="secondary" className="rounded-full">{bills.length}</Badge>
        </div>
        {bills.length === 0 ? <p className="text-xs text-muted-foreground py-6 text-center">No invoices in this range.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left font-medium py-2">Bill #</th>
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
                {bills.slice(0, 20).map((b: any) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{b.bill_no}</td>
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" />{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}
