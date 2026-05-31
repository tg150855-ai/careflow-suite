import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Search, Download } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/audit")({ component: Audit });

function Audit() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    const { data } = await (supabase as any).from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => !q || r.action?.toLowerCase().includes(q.toLowerCase()) || r.entity?.toLowerCase().includes(q.toLowerCase()));

  function exportCsv() {
    const headers = ["timestamp", "action", "entity", "entity_id", "user_id"];
    const csv = [headers.join(","), ...filtered.map((r) => [r.created_at, r.action, r.entity, r.entity_id ?? "", r.user_id ?? ""].join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `audit-${Date.now()}.csv`; a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldAlert className="size-6 text-primary" /> Audit &amp; Compliance</h1>
          <p className="text-sm text-muted-foreground">Track all sensitive actions across the system.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Audit Trail ({filtered.length})</CardTitle>
          <div className="relative w-72"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search action / entity" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Entity ID</TableHead><TableHead>User</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{format(new Date(r.created_at), "dd MMM HH:mm:ss")}</TableCell>
                  <TableCell><Badge variant="outline">{r.action}</Badge></TableCell>
                  <TableCell className="font-medium">{r.entity}</TableCell>
                  <TableCell className="font-mono text-xs">{r.entity_id ? r.entity_id.slice(0, 8) : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.user_id ? r.user_id.slice(0, 8) : "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No audit entries yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
