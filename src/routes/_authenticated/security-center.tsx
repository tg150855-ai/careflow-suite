import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable, type Col } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { listRows } from "@/lib/saas-crud";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/security-center")({ component: SecPage });

function SecPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { listRows("security_monitoring", { order: "created_at", limit: 200 }).then(setRows); }, []);

  const cols: Col<any>[] = [
    { header: "Time", cell: (r) => format(new Date(r.created_at), "dd MMM HH:mm") },
    { header: "Event", cell: (r) => <Badge variant="outline">{r.event_type}</Badge> },
    { header: "User", cell: (r) => r.user_id?.slice(0, 8) ?? "—" },
    { header: "IP", cell: (r) => r.ip_address ?? "—" },
    { header: "Severity", cell: (r) => <Badge variant={r.severity === "high" || r.severity === "critical" ? "destructive" : "secondary"}>{r.severity}</Badge> },
    { header: "Risk", cell: (r) => Number(r.risk_score ?? 0).toFixed(1) },
  ];

  const high = rows.filter((r) => r.severity === "high" || r.severity === "critical").length;

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldAlert} title="Advanced Security Center" subtitle="Monitor user activity, suspicious access and audit risks." />

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Total Events (200 latest)</div><div className="text-2xl font-bold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">High Severity</div><div className="text-2xl font-bold text-destructive">{high}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Failed Logins</div><div className="text-2xl font-bold">{rows.filter((r) => r.event_type === "failed_login").length}</div></CardContent></Card>
      </div>

      <SimpleTable rows={rows} columns={cols} empty="No security events recorded." />
    </div>
  );
}
