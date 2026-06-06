import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable, type Col } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Network } from "lucide-react";
import { listRows } from "@/lib/saas-crud";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/api-gateway")({ component: GatewayPage });

function GatewayPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listRows("integration_logs", { order: "created_at", limit: 200 }).then(setRows); }, []);

  const cols: Col<any>[] = [
    { header: "Time", cell: (r) => format(new Date(r.created_at), "dd MMM HH:mm") },
    { header: "Integration", cell: (r) => <Badge variant="outline">{r.integration_name}</Badge> },
    { header: "Endpoint", cell: (r) => <span className="text-xs font-mono">{r.endpoint}</span> },
    { header: "Method", cell: (r) => <Badge variant="secondary">{r.method}</Badge> },
    { header: "Status", cell: (r) => <Badge variant={(r.status_code >= 400) ? "destructive" : "secondary"}>{r.status_code}</Badge> },
    { header: "Duration", cell: (r) => r.duration_ms ? `${r.duration_ms}ms` : "—" },
  ];

  const errors = rows.filter((r) => r.status_code >= 400).length;
  const avgMs = rows.length ? Math.round(rows.reduce((a, b) => a + Number(b.duration_ms || 0), 0) / rows.length) : 0;
  const byIntegration = rows.reduce((acc: any, r) => { acc[r.integration_name] = (acc[r.integration_name] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-6">
      <PageHeader icon={Network} title="Enterprise API Gateway" subtitle="Centralized integrations with labs, insurance and government systems." />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total Calls (latest 200)" value={rows.length} />
        <Stat label="Error Rate" value={`${rows.length ? Math.round((errors / rows.length) * 100) : 0}%`} accent={errors > 0 ? "destructive" : undefined} />
        <Stat label="Avg Latency" value={`${avgMs}ms`} />
      </div>

      <Card><CardContent className="pt-5">
        <div className="font-semibold mb-3">Calls by Integration</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(byIntegration).map(([k, v]) => <Badge key={k} variant="outline">{k}: {v as number}</Badge>)}
          {Object.keys(byIntegration).length === 0 && <span className="text-sm text-muted-foreground">No integrations called yet.</span>}
        </div>
      </CardContent></Card>

      <SimpleTable rows={rows} columns={cols} empty="No integration calls logged yet." />
    </div>
  );
}

function Stat({ label, value, accent }: any) {
  return <div className="rounded-lg border bg-card p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-semibold mt-1 ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</div>
  </div>;
}
