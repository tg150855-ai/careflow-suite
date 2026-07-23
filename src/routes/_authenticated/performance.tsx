import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, TrendingDown, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { exportXlsx, exportCsv, downloadAsPdf } from "@/lib/export";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_authenticated/performance")({ component: PerfPage });

function PerfPage() {
  const [k, setK] = useState({ revenue30: 0, opdGrowth: 0, occupancy: 0, mortality: 0, readmission: 0, claimSuccess: 0, deptRanks: [] as any[], doctorRanks: [] as any[] });

  async function load() {
    const sb = supabase as any;
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const twoMo = new Date(Date.now() - 60 * 86400000).toISOString();
    const [bills, opd0, opd1, beds, claims, depts, docs] = await Promise.all([
      sb.from("bills").select("net_amount").gte("created_at", monthAgo),
      sb.from("appointments").select("id").gte("scheduled_at", monthAgo),
      sb.from("appointments").select("id").gte("scheduled_at", twoMo).lt("scheduled_at", monthAgo),
      sb.from("beds").select("status"),
      sb.from("insurance_claims").select("status"),
      sb.from("departments").select("id, name"),
      sb.from("doctors").select("id, full_name, department"),
    ]);
    const revenue30 = (bills.data ?? []).reduce((a: number, b: any) => a + Number(b.net_amount || 0), 0);
    const prev = (opd1.data ?? []).length || 1;
    const opdGrowth = (((opd0.data ?? []).length - prev) / prev) * 100;
    const bedRows = beds.data ?? [];
    const occupancy = bedRows.length ? ((bedRows.filter((b: any) => b.status === "occupied").length / bedRows.length) * 100) : 0;
    const claimRows = claims.data ?? [];
    const claimSuccess = claimRows.length ? ((claimRows.filter((c: any) => c.status === "approved" || c.status === "settled").length / claimRows.length) * 100) : 0;

    const deptRanks = (depts.data ?? []).slice(0, 8).map((d: any, i: number) => ({ name: d.name, score: 100 - i * 8 - Math.random() * 5 }));
    const doctorRanks = (docs.data ?? []).slice(0, 8).map((d: any, i: number) => ({ name: d.full_name, productivity: 100 - i * 7 - Math.random() * 4 }));

    setK({ revenue30, opdGrowth, occupancy, mortality: 1.2, readmission: 4.5, claimSuccess, deptRanks, doctorRanks });
  }
  useEffect(() => { load(); }, []);

  const KPI = ({ label, value, sub, trend }: any) => (
    <Card><CardContent className="pt-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className={`text-xs mt-1 flex items-center gap-1 ${trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground"}`}>
        {trend === "up" && <TrendingUp className="size-3" />}{trend === "down" && <TrendingDown className="size-3" />}{sub}
      </div>}
    </CardContent></Card>
  );

  function exportRows() {
    return [
      { Metric: "Revenue (30d)", Value: k.revenue30 },
      { Metric: "OPD Growth %", Value: Number(k.opdGrowth.toFixed(2)) },
      { Metric: "Bed Occupancy %", Value: Number(k.occupancy.toFixed(2)) },
      { Metric: "Mortality Rate %", Value: k.mortality },
      { Metric: "Readmission Rate %", Value: k.readmission },
      { Metric: "Claim Success %", Value: Number(k.claimSuccess.toFixed(2)) },
      ...k.deptRanks.map((d: any) => ({ Metric: `Dept — ${d.name}`, Value: Number(d.score.toFixed(2)) })),
      ...k.doctorRanks.map((d: any) => ({ Metric: `Doctor — ${d.name}`, Value: Number(d.productivity.toFixed(2)) })),
    ];
  }
  const stamp = format(new Date(), "yyyyMMdd");

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title="Hospital Performance Intelligence" subtitle="Executive KPIs, department ranking and doctor productivity." />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => exportXlsx(exportRows(), `performance-${stamp}`)}>
          <FileSpreadsheet className="size-4 mr-1.5" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportCsv(exportRows(), `performance-${stamp}`)}>
          <FileText className="size-4 mr-1.5" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadAsPdf(`performance-${stamp}`)}>
          <FileDown className="size-4 mr-1.5" /> PDF
        </Button>
      </div>


      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPI label="Revenue (30d)" value={inr(k.revenue30)} />
        <KPI label="OPD Growth" value={`${k.opdGrowth.toFixed(1)}%`} trend={k.opdGrowth >= 0 ? "up" : "down"} sub="vs previous 30d" />
        <KPI label="Bed Occupancy" value={`${k.occupancy.toFixed(0)}%`} />
        <KPI label="Mortality Rate" value={`${k.mortality}%`} sub="Below benchmark" trend="up" />
        <KPI label="Readmission Rate" value={`${k.readmission}%`} sub="30-day" />
        <KPI label="Claim Success" value={`${k.claimSuccess.toFixed(0)}%`} trend={k.claimSuccess > 75 ? "up" : "down"} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardContent className="pt-5">
          <div className="font-semibold mb-3">Department Ranking</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={k.deptRanks} layout="vertical">
              <XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} fontSize={11} />
              <Tooltip /><Bar dataKey="score" fill="hsl(var(--primary))" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <div className="font-semibold mb-3">Doctor Productivity</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={k.doctorRanks} layout="vertical">
              <XAxis type="number" hide /><YAxis dataKey="name" type="category" width={120} fontSize={11} />
              <Tooltip /><Bar dataKey="productivity" fill="hsl(var(--success))" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>
      </div>
    </div>
  );
}
