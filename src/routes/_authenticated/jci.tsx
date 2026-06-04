import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Globe, Plus } from "lucide-react";
import { toast } from "sonner";
import { SimpleTable } from "@/components/simple-table";

export const Route = createFileRoute("/_authenticated/jci")({ component: JCIPage });

const CATS = ["IPSG","ACC","PFR","AOP","COP","ASC","MMU","PFE","QPS","PCI","GLD","FMS","SQE","MOI"];

function JCIPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ standard_code: "", standard_name: "", category: "IPSG", auditor: "", score: "", findings: "", recommendations: "", status: "open" });

  const load = () => (supabase.from("jci_audits" as any) as any).select("*").order("audit_date", { ascending: false }).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { error } = await (supabase.from("jci_audits" as any) as any).insert({ ...form, score: form.score ? parseFloat(form.score) : null });
    if (error) return toast.error(error.message);
    toast.success("Audit recorded"); setOpen(false); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Globe className="size-6 text-primary" /> JCI Compliance</h1>
          <p className="text-sm text-muted-foreground">International patient safety goals, audits & risk assessments.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Record audit</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>JCI Audit Entry</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Standard code</Label><Input value={form.standard_code} onChange={(e) => setForm({ ...form, standard_code: e.target.value })} /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Standard name</Label><Input value={form.standard_name} onChange={(e) => setForm({ ...form, standard_name: e.target.value })} /></div>
              <div><Label>Auditor</Label><Input value={form.auditor} onChange={(e) => setForm({ ...form, auditor: e.target.value })} /></div>
              <div><Label>Score (0–100)</Label><Input type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></div>
              <div className="col-span-2"><Label>Findings</Label><Textarea value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} /></div>
              <div className="col-span-2"><Label>Recommendations</Label><Textarea value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SimpleTable
        rows={rows}
        columns={[
          { header: "Category", cell: (r) => <Badge variant="outline">{r.category}</Badge> },
          { header: "Standard", cell: (r) => <div><div className="font-medium text-xs">{r.standard_code}</div><div className="text-xs text-muted-foreground">{r.standard_name}</div></div> },
          { header: "Date", cell: (r) => r.audit_date },
          { header: "Score", cell: (r) => <Badge variant={r.score >= 80 ? "default" : r.score >= 60 ? "secondary" : "destructive"}>{r.score ?? "—"}</Badge> },
          { header: "Status", cell: (r) => <Badge variant="secondary">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
