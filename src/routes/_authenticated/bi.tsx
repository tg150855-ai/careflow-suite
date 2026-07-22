import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, BedDouble, Activity } from "lucide-react";
import { fmtINR } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subDays } from "date-fns";
import { DayMonthYearTabs, useDateRange } from "@/components/common/date-range-tabs";

export const Route = createFileRoute("/_authenticated/bi")({ component: BI });

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function BI() {
  const [raw, setRaw] = useState<any>({ bills: [], patients: [], beds: [], claims: [], sales: [], labs: [], surg: [] });
  const { range, preset, setPreset } = useDateRange("month");

  useEffect(() => {
    (async () => {
      const [bills, patients, beds, claims, sales, labs, surg] = await Promise.all([
        (supabase as any).from("bills").select("total,paid,created_at,bill_items(category,amount)"),
        (supabase as any).from("patients").select("id,created_at"),
        (supabase as any).from("beds").select("status"),
        (supabase as any).from("insurance_claims").select("claim_amount,approved_amount,status,created_at"),
        (supabase as any).from("pharmacy_sales").select("total,created_at"),
        (supabase as any).from("lab_orders").select("total_amount,created_at"),
        (supabase as any).from("surgeries").select("estimated_cost,created_at"),
      ]);
      setRaw({
        bills: bills.data ?? [], patients: patients.data ?? [], beds: beds.data ?? [],
        claims: claims.data ?? [], sales: sales.data ?? [], labs: labs.data ?? [], surg: surg.data ?? [],
      });
    })();
  }, []);

  const inRange = (v?: string) => {
    if (preset === "all" || !v) return preset === "all";
    const d = new Date(v);
    return d >= range.from && d <= range.to;
  };
  const anyRange = (v?: string) => preset === "all" ? true : inRange(v);

  const { kpis, revTrend, deptPerf } = useMemo(() => {
    const bills = raw.bills.filter((b: any) => anyRange(b.created_at));
    const sales = raw.sales.filter((b: any) => anyRange(b.created_at));
    const labs = raw.labs.filter((b: any) => anyRange(b.created_at));
    const surg = raw.surg.filter((b: any) => anyRange(b.created_at));
    const claims = raw.claims.filter((b: any) => anyRange(b.created_at));
    const patients = raw.patients.filter((b: any) => anyRange(b.created_at));

    const totalRev = bills.reduce((s: number, b: any) => s + +(b.paid ?? 0), 0);
    const opd = bills.reduce((s: number, b: any) => s + (b.bill_items ?? []).filter((i: any) => i.category === "consultation").reduce((x: number, i: any) => x + +i.amount, 0), 0);
    const ipd = bills.reduce((s: number, b: any) => s + (b.bill_items ?? []).filter((i: any) => ["bed","ipd","admission"].includes((i.category ?? "").toLowerCase())).reduce((x: number, i: any) => x + +i.amount, 0), 0);
    const pharm = sales.reduce((s: number, x: any) => s + +x.total, 0);
    const lab = labs.reduce((s: number, x: any) => s + +x.total_amount, 0);
    const ot = surg.reduce((s: number, x: any) => s + +(x.estimated_cost ?? 0), 0);
    const totalBeds = raw.beds.length;
    const occupied = raw.beds.filter((b: any) => b.status === "occupied").length;
    const claimsAmt = claims.reduce((s: number, c: any) => s + +c.claim_amount, 0);
    const claimsSettled = claims.filter((c: any) => c.status === "settled").length;

    const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), "yyyy-MM-dd"));
    const revTrend = days.map((d) => ({
      date: format(new Date(d), "dd MMM"),
      revenue: raw.bills.filter((b: any) => b.created_at?.startsWith(d)).reduce((s: number, b: any) => s + +(b.paid ?? 0), 0),
    }));

    const deptPerf = [
      { dept: "OPD", value: opd },
      { dept: "IPD", value: ipd },
      { dept: "Pharmacy", value: pharm },
      { dept: "Laboratory", value: lab },
      { dept: "OT", value: ot },
    ];

    return {
      kpis: { totalRev, opd, ipd, pharm, lab, ot, patients: patients.length, occ: totalBeds ? (occupied / totalBeds) * 100 : 0, totalBeds, occupied, claims: claimsAmt, claimsSettled },
      revTrend, deptPerf,
    };
  }, [raw, preset, range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><BarChart3 className="size-6 text-primary" /> Executive BI Dashboard</h1>
          <p className="text-sm text-muted-foreground">Hospital-wide performance and operational intelligence.</p>
        </div>
        <DayMonthYearTabs value={preset} onChange={(p) => setPreset(p)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="md:col-span-2 lg:col-span-2 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3" /> Total Revenue</div>
            <div className="text-3xl font-bold text-primary">{fmtINR(kpis.totalRev)}</div>
          </CardContent>
        </Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">OPD</div><div className="text-xl font-semibold">{fmtINR(kpis.opd)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">IPD</div><div className="text-xl font-semibold">{fmtINR(kpis.ipd)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Pharmacy</div><div className="text-xl font-semibold">{fmtINR(kpis.pharm)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Lab</div><div className="text-xl font-semibold">{fmtINR(kpis.lab)}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="size-3" /> Total Patients</div><div className="text-2xl font-semibold">{kpis.patients}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><BedDouble className="size-3" /> Bed Occupancy</div><div className="text-2xl font-semibold">{kpis.occ.toFixed(0)}%</div><div className="text-xs text-muted-foreground">{kpis.occupied}/{kpis.totalBeds}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="size-3" /> OT Revenue</div><div className="text-2xl font-semibold">{fmtINR(kpis.ot)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Insurance Claims</div><div className="text-2xl font-semibold">{fmtINR(kpis.claims)}</div><Badge variant="outline" className="mt-1">{kpis.claimsSettled} settled</Badge></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>7-Day Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtINR(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Department Performance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptPerf}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="dept" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtINR(v)} />
                <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={deptPerf.filter((d) => d.value > 0)} dataKey="value" nameKey="dept" cx="50%" cy="50%" outerRadius={100} label={(d) => d.dept}>
                  {deptPerf.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmtINR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
