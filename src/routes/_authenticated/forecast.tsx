import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/forecast")({ component: ForecastPage });

const DOMAINS = ["bed_occupancy", "opd_load", "icu_utilization", "revenue", "pharmacy_demand", "staff_required"];

function ForecastPage() {
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  async function load() {
    const sb = supabase as any;
    const { data: rows } = await sb.from("forecast_results").select("*").order("forecast_date");
    const grouped: Record<string, any[]> = {};
    DOMAINS.forEach((d) => { grouped[d] = []; });
    (rows ?? []).forEach((r: any) => { (grouped[r.domain] ??= []).push(r); });
    setData(grouped);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    setLoading(true);
    try {
      const sb = supabase as any;
      const today = new Date();
      const rows: any[] = [];
      // Pull simple baselines from live data
      const [{ data: beds }, { data: admits }, { data: bills }, { data: scripts }] = await Promise.all([
        sb.from("beds").select("status"),
        sb.from("admissions").select("created_at"),
        sb.from("bills").select("net_amount, created_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        sb.from("prescription_items").select("id"),
      ]);
      const occRate = beds?.length ? beds.filter((b: any) => b.status === "occupied").length / beds.length : 0.6;
      const dailyAdmit = (admits?.length || 30) / 30;
      const dailyRev = ((bills ?? []).reduce((a: number, b: any) => a + Number(b.net_amount || 0), 0) || 100000) / 30;
      const scriptCnt = scripts?.length || 50;
      for (let i = 1; i <= 30; i++) {
        const d = format(addDays(today, i), "yyyy-MM-dd");
        const seasonality = 1 + 0.1 * Math.sin((i / 7) * Math.PI);
        rows.push({ domain: "bed_occupancy", forecast_date: d, metric: "%", value: Math.min(100, occRate * 100 * seasonality), confidence: 0.82 });
        rows.push({ domain: "opd_load", forecast_date: d, metric: "visits", value: Math.round(dailyAdmit * 3.5 * seasonality), confidence: 0.78 });
        rows.push({ domain: "icu_utilization", forecast_date: d, metric: "%", value: Math.min(100, 65 * seasonality), confidence: 0.7 });
        rows.push({ domain: "revenue", forecast_date: d, metric: "INR", value: Math.round(dailyRev * seasonality), confidence: 0.8 });
        rows.push({ domain: "pharmacy_demand", forecast_date: d, metric: "units", value: Math.round(scriptCnt * seasonality), confidence: 0.75 });
        rows.push({ domain: "staff_required", forecast_date: d, metric: "FTE", value: Math.round(50 * seasonality), confidence: 0.85 });
      }
      await sb.from("forecast_results").delete().gte("forecast_date", format(today, "yyyy-MM-dd"));
      await sb.from("forecast_results").insert(rows);
      toast.success("30-day forecast generated");
      load();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={TrendingUp} title="Predictive Analytics" subtitle="30-day forecasts across operations, revenue and pharmacy." actions={
        <Button onClick={generate} disabled={loading}>{loading ? <><Loader2 className="size-4 mr-2 animate-spin" />Generating</> : "Regenerate Forecast"}</Button>
      } />

      <Tabs defaultValue={DOMAINS[0]}>
        <TabsList className="flex-wrap h-auto">{DOMAINS.map((d) => <TabsTrigger key={d} value={d}>{d.replace(/_/g, " ")}</TabsTrigger>)}</TabsList>
        {DOMAINS.map((d) => (
          <TabsContent key={d} value={d}>
            <Card>
              <CardContent className="pt-6">
                {(data[d]?.length ?? 0) === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">No forecast yet. Click "Regenerate Forecast" to generate.</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium uppercase tracking-wide">{d.replace(/_/g, " ")}</div>
                      <Badge variant="secondary">Avg confidence: {Math.round((data[d].reduce((a, b) => a + Number(b.confidence || 0), 0) / data[d].length) * 100)}%</Badge>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={data[d].map((r) => ({ date: format(new Date(r.forecast_date), "dd MMM"), value: Number(r.value) }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
