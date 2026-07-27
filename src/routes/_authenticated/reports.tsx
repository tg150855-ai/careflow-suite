import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3, TrendingUp, TrendingDown, Users, BedDouble, Activity, Stethoscope,
  FileSpreadsheet, FileText, FileDown, IndianRupee, FlaskConical, Scan, Pill,
  Droplet, Scissors, Building2, ShieldCheck, UserCog, AlertTriangle,
} from "lucide-react";
import { inr } from "@/lib/format";
import { exportXlsx, exportCsv, downloadAsPdf } from "@/lib/export";
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear, subMonths } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar,
  CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { RouteGuard } from "@/components/route-guard";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <RouteGuard module="reports">
      <ReportsPage />
    </RouteGuard>
  ),
});

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#a855f7"];

type Preset = "today" | "yesterday" | "week" | "month" | "year" | "custom";

function computeRange(preset: Preset, customFrom?: string, customTo?: string) {
  const now = new Date();
  switch (preset) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "week": return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case "month": return { from: startOfMonth(now), to: endOfDay(now) };
    case "year": return { from: startOfYear(now), to: endOfDay(now) };
    case "custom": return {
      from: customFrom ? startOfDay(new Date(customFrom)) : startOfMonth(now),
      to: customTo ? endOfDay(new Date(customTo)) : endOfDay(now),
    };
  }
}

function previousRange(from: Date, to: Date) {
  const span = to.getTime() - from.getTime();
  return { from: new Date(from.getTime() - span - 1), to: new Date(from.getTime() - 1) };
}

function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(() => computeRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const prev = useMemo(() => previousRange(range.from, range.to), [range]);

  const [raw, setRaw] = useState<any>({
    bills: [], billItems: [], payments: [], patients: [], appointments: [], admissions: [],
    beds: [], claims: [], sales: [], labs: [], radiology: [], surg: [], emergency: [],
    donors: [], bloodInv: [], employees: [], doctors: [], medicines: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const sb = supabase as any;
      const [
        bills, billItems, payments, patients, appointments, admissions, beds,
        claims, sales, labs, radiology, surg, emergency, donors, bloodInv,
        employees, doctors, medicines,
      ] = await Promise.all([
        sb.from("bills").select("id,total,paid,net_amount,discount,status,payment_mode,bill_type,created_at"),
        sb.from("bill_items").select("category,amount,bill_id,created_at"),
        sb.from("payments").select("amount,method,created_at"),
        sb.from("patients").select("id,gender,city,dob,created_at,patient_type"),
        sb.from("appointments").select("id,status,scheduled_at,doctor_id,department,created_at"),
        sb.from("admissions").select("id,status,admitted_at,discharged_at,ward_id,created_at"),
        sb.from("beds").select("id,status,ward_id"),
        sb.from("insurance_claims").select("claim_amount,approved_amount,status,insurance_company_id,created_at"),
        sb.from("pharmacy_sales").select("total,created_at"),
        sb.from("lab_orders").select("id,total_amount,status,created_at,completed_at"),
        sb.from("radiology_orders").select("id,modality,status,priority,created_at,completed_at"),
        sb.from("surgeries").select("id,estimated_cost,status,priority,scheduled_at,started_at,ended_at,created_at"),
        sb.from("emergency_cases").select("id,status,triage_level,created_at"),
        sb.from("blood_donors").select("id,blood_group,created_at"),
        sb.from("blood_inventory").select("blood_group,units_available,status,expiry_date"),
        sb.from("employees").select("id,department,status"),
        sb.from("doctors").select("id,full_name,department"),
        sb.from("medicines").select("id,name,stock_qty,min_stock,unit_price,expiry_date"),
      ]);
      setRaw({
        bills: bills.data ?? [], billItems: billItems.data ?? [], payments: payments.data ?? [],
        patients: patients.data ?? [], appointments: appointments.data ?? [], admissions: admissions.data ?? [],
        beds: beds.data ?? [], claims: claims.data ?? [], sales: sales.data ?? [], labs: labs.data ?? [],
        radiology: radiology.data ?? [], surg: surg.data ?? [], emergency: emergency.data ?? [],
        donors: donors.data ?? [], bloodInv: bloodInv.data ?? [], employees: employees.data ?? [],
        doctors: doctors.data ?? [], medicines: medicines.data ?? [],
      });
      setLoading(false);
    })();
  }, []);

  const inR = (v: string | null | undefined, r = range) =>
    !!v && new Date(v) >= r.from && new Date(v) <= r.to;

  const m = useMemo(() => {
    const bills = raw.bills.filter((b: any) => inR(b.created_at));
    const billsPrev = raw.bills.filter((b: any) => inR(b.created_at, prev));
    const payments = raw.payments.filter((p: any) => inR(p.created_at));
    const patients = raw.patients.filter((p: any) => inR(p.created_at));
    const patientsPrev = raw.patients.filter((p: any) => inR(p.created_at, prev));
    const appts = raw.appointments.filter((a: any) => inR(a.scheduled_at ?? a.created_at));
    const apptsPrev = raw.appointments.filter((a: any) => inR(a.scheduled_at ?? a.created_at, prev));
    const admissions = raw.admissions.filter((a: any) => inR(a.admitted_at ?? a.created_at));
    const sales = raw.sales.filter((s: any) => inR(s.created_at));
    const labs = raw.labs.filter((l: any) => inR(l.created_at));
    const radiology = raw.radiology.filter((r: any) => inR(r.created_at));
    const surg = raw.surg.filter((s: any) => inR(s.created_at));
    const emergency = raw.emergency.filter((e: any) => inR(e.created_at));
    const claims = raw.claims.filter((c: any) => inR(c.created_at));

    const billIds = new Set(bills.map((b: any) => b.id));
    const billItems = raw.billItems.filter((i: any) => billIds.has(i.bill_id));

    const totalRev = bills.reduce((s: number, b: any) => s + Number(b.paid ?? 0), 0);
    const totalRevPrev = billsPrev.reduce((s: number, b: any) => s + Number(b.paid ?? 0), 0);
    const gross = bills.reduce((s: number, b: any) => s + Number(b.total ?? 0), 0);
    const netRev = bills.reduce((s: number, b: any) => s + Number(b.net_amount ?? b.total ?? 0), 0);
    const discount = bills.reduce((s: number, b: any) => s + Number(b.discount ?? 0), 0);
    const pendingBills = bills.reduce((s: number, b: any) => s + Math.max(0, Number(b.total ?? 0) - Number(b.paid ?? 0)), 0);
    const collected = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

    const catSum = (cats: string[]) =>
      billItems.filter((i: any) => cats.includes(String(i.category ?? "").toLowerCase()))
        .reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);

    const opdRev = catSum(["consultation", "opd"]);
    const ipdRev = catSum(["bed", "ipd", "admission", "room"]);
    const labRev = catSum(["lab", "laboratory", "test"]) + labs.reduce((s: number, l: any) => s + Number(l.total_amount ?? 0), 0);
    const radRev = catSum(["radiology", "imaging", "xray", "ct", "mri", "ultrasound"]);
    const pharmRev = sales.reduce((s: number, x: any) => s + Number(x.total ?? 0), 0);
    const otRev = surg.reduce((s: number, x: any) => s + Number(x.estimated_cost ?? 0), 0);
    const pkgRev = catSum(["package", "health_package"]);
    const procRev = catSum(["procedure"]);
    const icuRev = catSum(["icu"]);
    const bbRev = catSum(["blood", "blood_bank"]);

    const payModes: Record<string, number> = {};
    for (const p of payments) {
      const k = String(p.method ?? "other");
      payModes[k] = (payModes[k] ?? 0) + Number(p.amount ?? 0);
    }
    for (const b of bills) {
      if (b.payment_mode && Number(b.paid ?? 0) > 0 && !payments.length) {
        const k = String(b.payment_mode);
        payModes[k] = (payModes[k] ?? 0) + Number(b.paid);
      }
    }

    const opdPatients = appts.length;
    const ipdPatients = admissions.length;
    const activeAdmissions = raw.admissions.filter((a: any) => a.status === "active").length;
    const today = startOfDay(new Date()); const tEnd = endOfDay(new Date());
    const todaysAdmissions = raw.admissions.filter((a: any) => {
      const d = new Date(a.admitted_at ?? a.created_at); return d >= today && d <= tEnd;
    }).length;
    const todaysDischarges = raw.admissions.filter((a: any) => {
      if (!a.discharged_at) return false;
      const d = new Date(a.discharged_at); return d >= today && d <= tEnd;
    }).length;

    const totalBeds = raw.beds.length;
    const occupiedBeds = raw.beds.filter((b: any) => b.status === "occupied").length;
    const occ = totalBeds ? (occupiedBeds / totalBeds) * 100 : 0;

    const totalClaims = claims.reduce((s: number, c: any) => s + Number(c.claim_amount ?? 0), 0);
    const claimsApproved = claims.filter((c: any) => c.status === "approved" || c.status === "settled").length;
    const claimsPending = claims.filter((c: any) => c.status === "submitted" || c.status === "under_review").length;
    const claimsRejected = claims.filter((c: any) => c.status === "rejected").length;
    const outstandingIns = claims.reduce((s: number, c: any) =>
      s + Math.max(0, Number(c.claim_amount ?? 0) - Number(c.approved_amount ?? 0)), 0);

    const growth = (curr: number, p: number) => p === 0 ? (curr > 0 ? 100 : 0) : ((curr - p) / p) * 100;

    const days = Math.min(30, Math.max(7, Math.ceil((range.to.getTime() - range.from.getTime()) / 86400000) || 7));
    const trend = Array.from({ length: days }, (_, i) => {
      const day = subDays(new Date(), days - 1 - i);
      const key = format(day, "yyyy-MM-dd");
      const revenue = raw.bills.filter((b: any) => b.created_at?.startsWith(key))
        .reduce((s: number, b: any) => s + Number(b.paid ?? 0), 0);
      const pat = raw.patients.filter((p: any) => p.created_at?.startsWith(key)).length;
      return { date: format(day, "dd MMM"), revenue, patients: pat };
    });

    const genderDist = raw.patients.reduce((acc: Record<string, number>, p: any) => {
      const g = String(p.gender ?? "unknown"); acc[g] = (acc[g] ?? 0) + 1; return acc;
    }, {});
    const genderData = Object.entries(genderDist).map(([name, value]) => ({ name, value }));

    const ageGroups = { "0-18": 0, "19-35": 0, "36-55": 0, "56-75": 0, "75+": 0 };
    for (const p of raw.patients) {
      if (!p.dob) continue;
      const age = (Date.now() - new Date(p.dob).getTime()) / (365.25 * 86400000);
      if (age < 18) ageGroups["0-18"]++;
      else if (age < 36) ageGroups["19-35"]++;
      else if (age < 56) ageGroups["36-55"]++;
      else if (age < 76) ageGroups["56-75"]++;
      else ageGroups["75+"]++;
    }
    const ageData = Object.entries(ageGroups).map(([name, value]) => ({ name, value }));

    const cityCount: Record<string, number> = {};
    for (const p of raw.patients) { const c = p.city ?? "Unknown"; cityCount[c] = (cityCount[c] ?? 0) + 1; }
    const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    const apptStatus = { completed: 0, cancelled: 0, no_show: 0, pending: 0 };
    for (const a of appts) {
      if (a.status === "completed") apptStatus.completed++;
      else if (a.status === "cancelled") apptStatus.cancelled++;
      else if (a.status === "no_show") apptStatus.no_show++;
      else apptStatus.pending++;
    }

    const doctorPerf: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const d of raw.doctors) doctorPerf[d.id] = { name: d.full_name, count: 0, revenue: 0 };
    for (const a of appts) {
      if (a.doctor_id && doctorPerf[a.doctor_id]) doctorPerf[a.doctor_id].count++;
    }
    const topDoctors = Object.values(doctorPerf).filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count).slice(0, 10);

    const labStats = {
      total: labs.length,
      pending: labs.filter((l: any) => ["ordered", "sample_collected", "in_progress"].includes(l.status)).length,
      completed: labs.filter((l: any) => l.status === "completed").length,
    };
    const radStats = {
      total: radiology.length,
      pending: radiology.filter((r: any) => r.status !== "completed").length,
      completed: radiology.filter((r: any) => r.status === "completed").length,
      urgent: radiology.filter((r: any) => r.priority === "urgent" || r.priority === "stat").length,
    };
    const modalityDist: Record<string, number> = {};
    for (const r of radiology) { const k = String(r.modality ?? "Other"); modalityDist[k] = (modalityDist[k] ?? 0) + 1; }
    const modalityData = Object.entries(modalityDist).map(([name, value]) => ({ name, value }));

    const surgStats = {
      total: surg.length,
      emergency: surg.filter((s: any) => s.priority === "emergency").length,
      elective: surg.filter((s: any) => s.priority === "elective" || s.priority === "planned").length,
      pending: surg.filter((s: any) => s.status === "scheduled").length,
      completed: surg.filter((s: any) => s.status === "completed").length,
    };

    const bgDist: Record<string, number> = {};
    for (const b of raw.bloodInv) {
      const k = String(b.blood_group ?? "?"); bgDist[k] = (bgDist[k] ?? 0) + Number(b.units_available ?? 0);
    }
    const bgData = Object.entries(bgDist).map(([name, value]) => ({ name, value }));

    const bbStats = {
      available: raw.bloodInv.filter((b: any) => b.status === "available").reduce((s: number, b: any) => s + Number(b.units_available ?? 0), 0),
      issued: raw.bloodInv.filter((b: any) => b.status === "issued").length,
      reserved: raw.bloodInv.filter((b: any) => b.status === "reserved").length,
      expired: raw.bloodInv.filter((b: any) => b.expiry_date && new Date(b.expiry_date) < new Date()).length,
    };

    const lowStock = raw.medicines.filter((mm: any) => Number(mm.stock_qty ?? 0) <= Number(mm.min_stock ?? 0)).length;
    const expiring = raw.medicines.filter((mm: any) => {
      if (!mm.expiry_date) return false;
      const d = new Date(mm.expiry_date); const soon = new Date(Date.now() + 90 * 86400000);
      return d <= soon;
    }).length;
    const invValue = raw.medicines.reduce((s: number, mm: any) => s + Number(mm.stock_qty ?? 0) * Number(mm.unit_price ?? 0), 0);

    const empByDept: Record<string, number> = {};
    for (const e of raw.employees) { const k = e.department ?? "Unassigned"; empByDept[k] = (empByDept[k] ?? 0) + 1; }
    const empDeptData = Object.entries(empByDept).map(([name, value]) => ({ name, value }));

    return {
      kpi: {
        totalRev, totalRevGrowth: growth(totalRev, totalRevPrev),
        totalPatients: patients.length, patientsGrowth: growth(patients.length, patientsPrev.length),
        opdPatients, ipdPatients, emergency: emergency.length,
        activeAdmissions, todaysAdmissions, todaysDischarges,
        appointments: appts.length, apptsGrowth: growth(appts.length, apptsPrev.length),
        surgeries: surg.length, labs: labs.length, radiology: radiology.length,
        pharmSales: pharmRev, bloodTx: raw.donors.length,
        occ, occupiedBeds, totalBeds,
        pendingBills, collected, totalClaims, outstandingIns,
        employees: raw.employees.length, gross, netRev, discount,
      },
      revBreakdown: [
        { dept: "OPD", value: opdRev }, { dept: "IPD", value: ipdRev },
        { dept: "Laboratory", value: labRev }, { dept: "Radiology", value: radRev },
        { dept: "Pharmacy", value: pharmRev }, { dept: "OT", value: otRev },
        { dept: "ICU", value: icuRev }, { dept: "Blood Bank", value: bbRev },
        { dept: "Procedures", value: procRev }, { dept: "Packages", value: pkgRev },
      ].filter((x) => x.value > 0),
      payModeData: Object.entries(payModes).map(([name, value]) => ({ name, value })),
      trend, genderData, ageData, topCities, apptStatus, topDoctors,
      labStats, radStats, modalityData, surgStats, bgData, bbStats,
      pharm: { sales: pharmRev, lowStock, expiring, invValue },
      claims: { totalClaims, claimsApproved, claimsPending, claimsRejected, outstandingIns, count: claims.length },
      empDeptData,
    };
  }, [raw, range, prev]);

  const stamp = format(new Date(), "yyyyMMdd-HHmm");

  function exportAll(fmt: "xlsx" | "csv" | "pdf") {
    const kpiRows = Object.entries(m.kpi).map(([Metric, Value]) => ({ Metric, Value: typeof Value === "number" ? Number(Value.toFixed(2)) : Value }));
    if (fmt === "pdf") { downloadAsPdf(`reports-${stamp}`); return; }
    if (fmt === "csv") { exportCsv(kpiRows, `reports-kpi-${stamp}`); return; }
    exportXlsx({
      KPIs: kpiRows,
      "Revenue Breakdown": m.revBreakdown.map((r) => ({ Department: r.dept, Amount: r.value })),
      "Payment Modes": m.payModeData.map((p) => ({ Mode: p.name, Amount: p.value })),
      "Daily Trend": m.trend,
      "Top Doctors": m.topDoctors,
      "Age Distribution": m.ageData,
      "Top Cities": m.topCities,
      "Modality": m.modalityData,
      "Blood Groups": m.bgData,
      "Employees by Dept": m.empDeptData,
    }, `reports-full-${stamp}`);
  }

  const KPI = ({ icon: Icon, label, value, sub, trend, tone = "primary" }: any) => (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          {Icon && <Icon className="size-3" />} {label}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {sub != null && (
          <div className={`text-xs mt-1 flex items-center gap-1 ${
            trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground"
          }`}>
            {trend === "up" && <TrendingUp className="size-3" />}
            {trend === "down" && <TrendingDown className="size-3" />}
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Reports & Analytics"
        subtitle="Live hospital business intelligence — revenue, patients, operations & finance."
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
                <TabsTrigger value="year">This Year</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
            {preset === "custom" && (
              <>
                <div className="grid gap-1"><Label className="text-xs">From</Label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-40" /></div>
                <div className="grid gap-1"><Label className="text-xs">To</Label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-40" /></div>
              </>
            )}
            <div className="ml-auto flex items-center gap-2 no-print">
              <Badge variant="outline" className="text-xs">
                {format(range.from, "dd MMM yyyy")} — {format(range.to, "dd MMM yyyy")}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => exportAll("xlsx")}><FileSpreadsheet className="size-4 mr-1.5" /> Excel</Button>
              <Button size="sm" variant="outline" onClick={() => exportAll("csv")}><FileText className="size-4 mr-1.5" /> CSV</Button>
              <Button size="sm" variant="outline" onClick={() => exportAll("pdf")}><FileDown className="size-4 mr-1.5" /> PDF</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading analytics…</CardContent></Card>}

      {/* Executive KPIs */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Executive Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <KPI icon={IndianRupee} label="Total Revenue" value={inr(m.kpi.totalRev)}
            sub={`${m.kpi.totalRevGrowth >= 0 ? "+" : ""}${m.kpi.totalRevGrowth.toFixed(1)}% vs prev`}
            trend={m.kpi.totalRevGrowth >= 0 ? "up" : "down"} />
          <KPI icon={Users} label="Total Patients" value={m.kpi.totalPatients}
            sub={`${m.kpi.patientsGrowth >= 0 ? "+" : ""}${m.kpi.patientsGrowth.toFixed(1)}%`}
            trend={m.kpi.patientsGrowth >= 0 ? "up" : "down"} />
          <KPI icon={Stethoscope} label="OPD (Appointments)" value={m.kpi.opdPatients}
            sub={`${m.kpi.apptsGrowth >= 0 ? "+" : ""}${m.kpi.apptsGrowth.toFixed(1)}%`}
            trend={m.kpi.apptsGrowth >= 0 ? "up" : "down"} />
          <KPI icon={BedDouble} label="IPD Admissions" value={m.kpi.ipdPatients} />
          <KPI icon={AlertTriangle} label="Emergency" value={m.kpi.emergency} />
          <KPI icon={Activity} label="Active Admissions" value={m.kpi.activeAdmissions} />
          <KPI label="Today Admissions" value={m.kpi.todaysAdmissions} />
          <KPI label="Today Discharges" value={m.kpi.todaysDischarges} />
          <KPI icon={Scissors} label="Surgeries" value={m.kpi.surgeries} />
          <KPI icon={FlaskConical} label="Lab Tests" value={m.kpi.labs} />
          <KPI icon={Scan} label="Radiology" value={m.kpi.radiology} />
          <KPI icon={Pill} label="Pharmacy Sales" value={inr(m.kpi.pharmSales)} />
          <KPI icon={Droplet} label="Blood Donors" value={m.kpi.bloodTx} />
          <KPI icon={BedDouble} label="Bed Occupancy" value={`${m.kpi.occ.toFixed(0)}%`}
            sub={`${m.kpi.occupiedBeds}/${m.kpi.totalBeds}`} />
          <KPI label="Pending Bills" value={inr(m.kpi.pendingBills)} trend="down" />
          <KPI label="Collected" value={inr(m.kpi.collected)} trend="up" />
          <KPI icon={ShieldCheck} label="Insurance Claims" value={inr(m.kpi.totalClaims)} />
          <KPI label="Outstanding Ins." value={inr(m.kpi.outstandingIns)} />
          <KPI icon={UserCog} label="Employees" value={m.kpi.employees} />
          <KPI label="Gross Revenue" value={inr(m.kpi.gross)} />
          <KPI label="Discounts" value={inr(m.kpi.discount)} />
          <KPI label="Net Revenue" value={inr(m.kpi.netRev)} />
        </div>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="doctors">Doctors</TabsTrigger>
          <TabsTrigger value="lab">Lab</TabsTrigger>
          <TabsTrigger value="radiology">Radiology</TabsTrigger>
          <TabsTrigger value="pharmacy">Pharmacy</TabsTrigger>
          <TabsTrigger value="blood">Blood Bank</TabsTrigger>
          <TabsTrigger value="surgery">OT / Surgery</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="insurance">Insurance</TabsTrigger>
          <TabsTrigger value="beds">Beds</TabsTrigger>
          <TabsTrigger value="hr">HR</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={m.trend}>
                  <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} />
                  <Tooltip formatter={(v: any) => inr(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Revenue by Department</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={m.revBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="dept" fontSize={10} angle={-20} textAnchor="end" height={60} /><YAxis fontSize={11} />
                  <Tooltip formatter={(v: any) => inr(v)} />
                  <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <Card className="lg:col-span-2"><CardHeader><CardTitle>Revenue by Payment Mode</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={m.payModeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(d: any) => `${d.name}: ${inr(d.value)}`}>
                    {m.payModeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => inr(v)} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="patients" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle>New Registrations Trend</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={m.trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} />
                  <Tooltip /><Line type="monotone" dataKey="patients" stroke="#8b5cf6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Gender Distribution</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={m.genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {m.genderData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Age Group Distribution</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={m.ageData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} />
                  <Tooltip /><Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Top Cities</CardTitle></CardHeader><CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={m.topCities} layout="vertical">
                  <XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} fontSize={11} />
                  <Tooltip /><Bar dataKey="value" fill="#06b6d4" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <KPI label="Completed" value={m.apptStatus.completed} />
            <KPI label="Cancelled" value={m.apptStatus.cancelled} />
            <KPI label="No Show" value={m.apptStatus.no_show} />
            <KPI label="Pending" value={m.apptStatus.pending} />
          </div>
          <Card><CardHeader><CardTitle>Appointment Status</CardTitle></CardHeader><CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={Object.entries(m.apptStatus).map(([name, value]) => ({ name, value }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} />
                <Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="doctors" className="mt-4">
          <Card><CardHeader><CardTitle>Top Performing Doctors (by consultations)</CardTitle></CardHeader><CardContent>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={m.topDoctors} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis dataKey="name" type="category" width={160} fontSize={11} />
                <Tooltip /><Bar dataKey="count" fill="#10b981" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="lab" className="mt-4">
          <div className="grid md:grid-cols-3 gap-3 mb-4">
            <KPI label="Total Tests" value={m.labStats.total} />
            <KPI label="Pending" value={m.labStats.pending} />
            <KPI label="Completed" value={m.labStats.completed} />
          </div>
        </TabsContent>

        <TabsContent value="radiology" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <KPI label="Total" value={m.radStats.total} />
            <KPI label="Pending" value={m.radStats.pending} />
            <KPI label="Completed" value={m.radStats.completed} />
            <KPI label="Urgent" value={m.radStats.urgent} />
          </div>
          <Card><CardHeader><CardTitle>Modality Breakdown</CardTitle></CardHeader><CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={m.modalityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {m.modalityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pharmacy" className="mt-4">
          <div className="grid md:grid-cols-4 gap-3">
            <KPI label="Sales" value={inr(m.pharm.sales)} />
            <KPI label="Low Stock Items" value={m.pharm.lowStock} trend="down" />
            <KPI label="Expiring (90d)" value={m.pharm.expiring} trend="down" />
            <KPI label="Inventory Value" value={inr(m.pharm.invValue)} />
          </div>
        </TabsContent>

        <TabsContent value="blood" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-4 gap-3">
            <KPI label="Available Units" value={m.bbStats.available} />
            <KPI label="Issued" value={m.bbStats.issued} />
            <KPI label="Reserved" value={m.bbStats.reserved} />
            <KPI label="Expired" value={m.bbStats.expired} trend="down" />
          </div>
          <Card><CardHeader><CardTitle>Blood Group Distribution</CardTitle></CardHeader><CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={m.bgData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} />
                <Tooltip /><Bar dataKey="value" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="surgery" className="mt-4">
          <div className="grid md:grid-cols-5 gap-3">
            <KPI label="Total" value={m.surgStats.total} />
            <KPI label="Emergency" value={m.surgStats.emergency} />
            <KPI label="Elective" value={m.surgStats.elective} />
            <KPI label="Pending" value={m.surgStats.pending} />
            <KPI label="Completed" value={m.surgStats.completed} />
          </div>
        </TabsContent>

        <TabsContent value="finance" className="mt-4">
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
            <KPI label="Gross Revenue" value={inr(m.kpi.gross)} />
            <KPI label="Discounts" value={inr(m.kpi.discount)} />
            <KPI label="Net Revenue" value={inr(m.kpi.netRev)} />
            <KPI label="Collected" value={inr(m.kpi.collected)} trend="up" />
            <KPI label="Pending Bills" value={inr(m.kpi.pendingBills)} trend="down" />
            <KPI label="Insurance Claims" value={inr(m.kpi.totalClaims)} />
            <KPI label="Outstanding Ins." value={inr(m.kpi.outstandingIns)} trend="down" />
          </div>
        </TabsContent>

        <TabsContent value="insurance" className="mt-4">
          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <KPI label="Total Claims" value={m.claims.count} />
            <KPI label="Approved" value={m.claims.claimsApproved} trend="up" />
            <KPI label="Pending" value={m.claims.claimsPending} />
            <KPI label="Rejected" value={m.claims.claimsRejected} trend="down" />
          </div>
        </TabsContent>

        <TabsContent value="beds" className="mt-4">
          <div className="grid md:grid-cols-3 gap-3">
            <KPI icon={BedDouble} label="Occupied" value={m.kpi.occupiedBeds} />
            <KPI label="Available" value={m.kpi.totalBeds - m.kpi.occupiedBeds} />
            <KPI label="Occupancy %" value={`${m.kpi.occ.toFixed(1)}%`} />
          </div>
        </TabsContent>

        <TabsContent value="hr" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <KPI icon={UserCog} label="Total Employees" value={m.kpi.employees} />
            <KPI icon={Building2} label="Departments" value={m.empDeptData.length} />
          </div>
          <Card><CardHeader><CardTitle>Employees by Department</CardTitle></CardHeader><CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={m.empDeptData} layout="vertical">
                <XAxis type="number" fontSize={11} />
                <YAxis dataKey="name" type="category" width={140} fontSize={11} />
                <Tooltip /><Bar dataKey="value" fill="#8b5cf6" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
