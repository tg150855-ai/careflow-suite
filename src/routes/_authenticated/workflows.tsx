import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Workflow, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workflows")({ component: WfPage });

function WfPage() {
  const [wfs, setWfs] = useState<any[]>([]);
  const [inst, setInst] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: "", name: "", category: "approval", definition: '{"steps":[{"name":"submit"},{"name":"manager_approval"},{"name":"finance_approval"}]}' });

  async function load() {
    setWfs(await listRows("workflows", { order: "created_at" }));
    setInst(await listRows("workflow_instances", { order: "created_at" }));
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader icon={Workflow} title="Workflow Engine" subtitle="Configurable approvals: admission, insurance, purchase, leave" />
      <Tabs defaultValue="wf">
        <TabsList><TabsTrigger value="wf">Workflows</TabsTrigger><TabsTrigger value="ins">Instances</TabsTrigger></TabsList>
        <TabsContent value="wf" className="space-y-3">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New Workflow</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New Workflow</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
                  <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                </div>
                <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
                <div><Label>Definition (JSON)</Label><Textarea rows={6} value={f.definition} onChange={(e) => setF({ ...f, definition: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={async () => { try { const def = JSON.parse(f.definition); await insertRow("workflows", { ...f, definition: def }); toast.success("Created"); setOpen(false); load(); } catch (e: any) { toast.error(e.message); } }} disabled={!f.code || !f.name}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <SimpleTable rows={wfs} columns={[
            { header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
            { header: "Name", cell: (r) => r.name },
            { header: "Category", cell: (r) => <Badge>{r.category}</Badge> },
            { header: "Steps", cell: (r) => r.definition?.steps?.length ?? 0 },
            { header: "Active", cell: (r) => r.active ? "Yes" : "No" },
          ]} />
        </TabsContent>
        <TabsContent value="ins"><SimpleTable rows={inst} columns={[
          { header: "Workflow", cell: (r) => r.workflow_id?.slice(0, 8) },
          { header: "Ref", cell: (r) => `${r.reference_type ?? "—"}` },
          { header: "Current Step", cell: (r) => r.current_step ?? "—" },
          { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
        ]} /></TabsContent>
      </Tabs>
    </div>
  );
}
