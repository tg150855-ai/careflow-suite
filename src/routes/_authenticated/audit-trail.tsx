import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History } from "lucide-react";
import { format } from "date-fns";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/audit-trail")({ component: ATPage });

function ATPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<any>(null);

  useEffect(() => {
    (supabase.from("enterprise_audit_logs" as any) as any).select("*").order("created_at", { ascending: false }).limit(500).then(({ data }: any) => setRows(data ?? []));
  }, []);
  const filtered = rows.filter((r) => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><History className="size-6 text-primary" /> Advanced Audit Trail</h1>
        <p className="text-sm text-muted-foreground">Login, data access, updates, prescription & billing changes — tamper-resistant log.</p>
      </div>
      <Input placeholder="Search action / entity / user…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <SimpleTable
        rows={filtered}
        columns={[
          { header: "Time", cell: (r) => <span className="text-xs">{format(new Date(r.created_at), "dd MMM HH:mm:ss")}</span> },
          { header: "User", cell: (r) => <span className="text-xs">{r.user_email ?? r.user_id?.slice(0, 8) ?? "—"}</span> },
          { header: "Action", cell: (r) => <Badge variant="outline">{r.action}</Badge> },
          { header: "Entity", cell: (r) => <span className="text-xs">{r.entity} {r.entity_id ? `#${r.entity_id.slice(0, 8)}` : ""}</span> },
          { header: "IP", cell: (r) => <span className="text-xs">{r.ip_address ?? "—"}</span> },
          { header: "Diff", cell: (r) => (r.before || r.after) && <button className="text-xs text-primary" onClick={() => setOpen(r)}>View</button> },
        ]}
      />

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {open && <>
            <DialogHeader><DialogTitle>{open.action} · {open.entity}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Card><CardContent className="pt-4"><div className="font-semibold mb-1">Before</div><pre className="overflow-auto max-h-72">{JSON.stringify(open.before, null, 2)}</pre></CardContent></Card>
              <Card><CardContent className="pt-4"><div className="font-semibold mb-1">After</div><pre className="overflow-auto max-h-72">{JSON.stringify(open.after, null, 2)}</pre></CardContent></Card>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
