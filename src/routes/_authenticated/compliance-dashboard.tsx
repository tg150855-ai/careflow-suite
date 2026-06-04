import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Activity, AlertTriangle, ClipboardCheck } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

export const Route = createFileRoute("/_authenticated/compliance-dashboard")({ component: CDPage });

function CDPage() {
  const [qi, setQi] = useState<any[]>([]);
  const [jci, setJci] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);

  useEffect(() => {
    (supabase.from("quality_indicators" as any) as any).select("*").then(({ data }: any) => setQi(data ?? []));
    (supabase.from("jci_audits" as any) as any).select("*").then(({ data }: any) => setJci(data ?? []));
    (supabase.from("clinical_audits" as any) as any).select("*").then(({ data }: any) => setAudits(data ?? []));
    (supabase.from("incidents" as any) as any).select("*").then(({ data }: any) => setIncidents(data ?? []));
  }, []);

  const nabhPct = qi.length > 0 ? Math.round(qi.filter((q) => q.target && q.value >= q.target).length * 100 / qi.length) : 0;
  const jciPct = jci.length > 0 ? Math.round(jci.reduce((a, b) => a + (b.score ?? 0), 0) / jci.length) : 0;
  const cqs = audits.length > 0 ? Math.round(audits.reduce((a, b) => a + (b.compliance_pct ?? 0), 0) / audits.length) : 0;
  const openRisks = incidents.filter((i) => i.status !== "closed").length;

  const trend = (() => {
    const byMonth: Record<string, { nabh: number[]; jci: number[] }> = {};
    qi.forEach((q) => {
      const k = (q.period_end ?? "").slice(0, 7);
      if (!k) return;
      (byMonth[k] ??= { nabh: [], jci: [] }).nabh.push(q.value ?? 0);
    });
    jci.forEach((j) => {
      const k = (j.audit_date ?? "").slice(0, 7);
      if (!k) return;
      (byMonth[k] ??= { nabh: [], jci: [] }).jci.push(j.score ?? 0);
    });
    return Object.entries(byMonth).sort().map(([month, v]) => ({
      month,
      nabh: v.nabh.length ? Math.round(v.nabh.reduce((a, b) => a + b, 0) / v.nabh.length) : 0,
      jci: v.jci.length ? Math.round(v.jci.reduce((a, b) => a + b, 0) / v.jci.length) : 0,
    }));
  })();

  const riskByType = Object.entries(
    incidents.reduce((m: any, i) => { m[i.incident_type] = (m[i.incident_type] ?? 0) + 1; return m; }, {})
  ).map(([type, count]) => ({ type, count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="size-6 text-primary" /> Enterprise Compliance Dashboard</h1>
        <p className="text-sm text-muted-foreground">NABH, JCI, clinical quality & risk overview.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" /> NABH compliance</div><div className="text-2xl font-bold mt-1">{nabhPct}%</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="size-4" /> JCI score</div><div className="text-2xl font-bold mt-1">{jciPct}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ClipboardCheck className="size-4" /> Clinical quality</div><div className="text-2xl font-bold mt-1">{cqs}%</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="size-4" /> Open risks</div><div className="text-2xl font-bold mt-1 text-warning-foreground">{openRisks}</div></CardContent></Card>
      </div>

      <Card><CardContent className="pt-4">
        <div className="text-sm font-semibold mb-2">Compliance trends</div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip />
            <Line type="monotone" dataKey="nabh" name="NABH %" stroke="hsl(var(--primary))" />
            <Line type="monotone" dataKey="jci" name="JCI score" stroke="hsl(var(--muted-foreground))" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent></Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card><CardContent className="pt-4">
          <div className="text-sm font-semibold mb-2">Risk by incident type</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={riskByType}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="type" /><YAxis /><Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent></Card>

        <Card><CardContent className="pt-4">
          <div className="text-sm font-semibold mb-2">Recent audits</div>
          <div className="space-y-2">
            {audits.slice(0, 6).map((a) => (
              <div key={a.id} className="flex justify-between text-xs">
                <span className="capitalize">{a.audit_type?.replace(/_/g, " ")} — {a.scope}</span>
                <Badge variant={a.compliance_pct >= 90 ? "default" : a.compliance_pct >= 70 ? "secondary" : "destructive"}>{a.compliance_pct ?? "—"}%</Badge>
              </div>
            ))}
            {audits.length === 0 && <div className="text-xs text-muted-foreground">No audits yet.</div>}
          </div>
        </CardContent></Card>
      </div>
    </div>
  );
}
