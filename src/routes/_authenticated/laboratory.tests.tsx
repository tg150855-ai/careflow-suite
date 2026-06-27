import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { ModuleActionBar } from "@/components/common/action-bar";
import { SearchBox } from "@/components/common/search-box";
import { exportCsv, printPage, downloadAsPdf } from "@/lib/export";
import { shareOnWhatsApp } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/laboratory/tests")({ component: LabTests });

function LabTests() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: tests = [] } = useQuery({
    queryKey: ["lab-tests", q],
    queryFn: async () => {
      let query = supabase.from("lab_tests").select("*").eq("active", true).order("name").limit(200);
      if (q.length >= 2) query = query.or(`name.ilike.%${q}%,department.ilike.%${q}%,code.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (t: any) => { const { error } = await supabase.from("lab_tests").insert(t); if (error) throw error; },
    onSuccess: () => { toast.success("Test added"); qc.invalidateQueries({ queryKey: ["lab-tests"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/laboratory"><ArrowLeft className="size-4" /></Link></Button>
          <div><h1 className="text-2xl font-semibold tracking-tight">Lab tests catalog</h1><p className="text-sm text-muted-foreground">{tests.length} tests</p></div>
        </div>
        <NewTestDialog onSubmit={(v) => create.mutate(v)} />
      </div>

      <ModuleActionBar
        leading={<SearchBox value={q} onChange={setQ} placeholder="Search by name, department or code…" />}
        onExport={() => exportCsv(tests as any[], `lab-tests-${Date.now()}`)}
        onPrint={printPage}
        onDownloadReport={() => downloadAsPdf(`Lab-tests`)}
        onWhatsAppShare={() => shareOnWhatsApp(`Lab tests catalog (${tests.length} active tests)`)}
        onSettings={() => toast.info("Lab settings coming soon")}
      />

      <Card>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-xs uppercase tracking-wider text-muted-foreground"><th className="text-left p-4">Name</th><th className="text-left p-4">Code</th><th className="text-left p-4">Department</th><th className="text-right p-4">Price</th><th className="text-right p-4">TAT (h)</th></tr></thead>
          <tbody className="divide-y">
            {tests.map((t: any) => (<tr key={t.id} className="hover:bg-surface-muted"><td className="p-4 font-medium">{t.name}</td><td className="p-4 font-mono text-xs">{t.code ?? "—"}</td><td className="p-4">{t.department ?? "—"}</td><td className="p-4 text-right tabular-nums">{inr(t.price)}</td><td className="p-4 text-right tabular-nums">{t.turnaround_hours}</td></tr>))}
            {tests.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-sm text-muted-foreground">No tests yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function NewTestDialog({ onSubmit }: { onSubmit: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", code: "", department: "", price: 0, turnaround_hours: 24 });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New test</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add lab test</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
            <div><Label>Department</Label><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} placeholder="Pathology / Radiology" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price ₹</Label><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></div>
            <div><Label>TAT hours</Label><Input type="number" value={f.turnaround_hours} onChange={(e) => setF({ ...f, turnaround_hours: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter><Button disabled={!f.name} onClick={() => { onSubmit({ ...f, code: f.code || null, department: f.department || null }); setOpen(false); setF({ name: "", code: "", department: "", price: 0, turnaround_hours: 24 }); }}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
