import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    (supabase.from("privacy_logs" as any) as any).select("*").order("created_at", { ascending: false }).limit(500).then(({ data }: any) => setRows(data ?? []));
  }, []);
  const filtered = rows.filter((r) => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const todayCount = rows.filter((r) => new Date(r.created_at).toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="size-6 text-primary" /> Data Governance & Privacy</h1>
        <p className="text-sm text-muted-foreground">Patient consent enforcement, access monitoring, masked PII, retention.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Today</div><div className="text-2xl font-bold">{todayCount}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Logged total</div><div className="text-2xl font-bold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Unique users</div><div className="text-2xl font-bold">{new Set(rows.map((r) => r.user_id)).size}</div></CardContent></Card>
      </div>

      <Input placeholder="Search action / resource…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <SimpleTable
        rows={filtered}
        columns={[
          { header: "Time", cell: (r) => <span className="text-xs">{format(new Date(r.created_at), "dd MMM HH:mm")}</span> },
          { header: "User", cell: (r) => <code className="text-xs">{r.user_id?.slice(0, 8) ?? "—"}</code> },
          { header: "Action", cell: (r) => <Badge variant="outline">{r.action}</Badge> },
          { header: "Resource", cell: (r) => <span className="text-xs">{r.resource ?? "—"}</span> },
          { header: "IP", cell: (r) => <span className="text-xs">{r.ip_address ?? "—"}</span> },
        ]}
        empty="No privacy access events captured yet."
      />
    </div>
  );
}
