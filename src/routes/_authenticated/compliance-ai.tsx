import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SimpleTable, type Col } from "@/components/simple-table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Plus } from "lucide-react";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/compliance-ai")({ component: ComplianceAIPage });

const STANDARDS = ["NABH", "JCI", "HIPAA", "ISO_9001"];

function ComplianceAIPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ standard: STANDARDS[0], area: "", score: "85", findings: "", action_items: "" });

  const load = () => listRows("compliance_assessments", { order: "assessed_at" }).then(setRows);
  useEffect(() => { load(); }, []);

  async function save() {
    if (!f.area) return toast.error("Area required");
    await insertRow("compliance_assessments", { ...f, score: +f.score, action_items: f.action_items.split("\n").filter(Boolean) });
    toast.success("Saved"); setOpen(false); load();
  }

  const cols: Col<any>[] = [
    { header: "Standard", cell: (r) => <Badge>{r.standard}</Badge> },
    { header: "Area", cell: (r) => r.area },
    { header: "Score", cell: (r) => <Badge variant={r.score >= 85 ? "secondary" : "destructive"}>{r.score}%</Badge> },
    { header: "Findings", cell: (r) => <span className="text-xs">{r.findings?.slice(0, 60)}</span> },
    { header: "Assessed", cell: (r) => format(new Date(r.assessed_at), "dd MMM yyyy") },
  ];

  const avgScore = rows.length ? Math.round(rows.reduce((a, b) => a + Number(b.score || 0), 0) / rows.length) : 0;

  return (
    <div className="space-y-6">
      <PageHeader icon={ShieldCheck} title="AI Quality & Compliance Assistant" subtitle="Automated NABH, JCI and quality scoring with corrective suggestions." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New Assessment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Compliance Assessment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Standard</Label>
                <Select value={f.standard} onValueChange={(v) => setF({ ...f, standard: v })}>
                  <SelectTrigger /><SelectContent>{STANDARDS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Area</Label><Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="e.g. Infection Control" /></div>
              <div><Label>Score (0-100)</Label><Input type="number" value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })} /></div>
              <div><Label>Findings</Label><Textarea value={f.findings} onChange={(e) => setF({ ...f, findings: e.target.value })} /></div>
              <div><Label>Action Items (one per line)</Label><Textarea value={f.action_items} onChange={(e) => setF({ ...f, action_items: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">Average Compliance Score</div><div className="text-2xl font-bold">{avgScore}%</div></div>
        <div className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">Assessments</div><div className="text-2xl font-bold">{rows.length}</div></div>
        <div className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">Below Threshold</div><div className="text-2xl font-bold text-destructive">{rows.filter((r) => r.score < 85).length}</div></div>
      </div>

      <SimpleTable rows={rows} columns={cols} empty="No compliance assessments yet." />
    </div>
  );
}
