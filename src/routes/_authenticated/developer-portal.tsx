import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Code2, Plus, BookOpen, Download, FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/developer-portal")({ component: DevPage });

function DevPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ company: "", website: "", contact_email: "" });

  async function load() { setRows(await listRows("developer_accounts", { order: "created_at" })); }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader icon={Code2} title="Developer Portal" subtitle="API docs, SDK downloads, sandbox & webhook testing"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New Developer</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register Developer</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Company</Label><Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
                <div><Label>Website</Label><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></div>
                <div><Label>Contact Email</Label><Input value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={async () => { try { await insertRow("developer_accounts", f); toast.success("Created"); setOpen(false); load(); } catch (e: any) { toast.error(e.message); } }} disabled={!f.contact_email}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {[
          { icon: BookOpen, label: "API Documentation", desc: "OpenAPI 3 specs for every product" },
          { icon: Download, label: "SDK Downloads", desc: "JavaScript, Python, PHP" },
          { icon: FlaskConical, label: "Sandbox", desc: "Test against synthetic data" },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><c.icon className="size-5 text-primary" /> {c.label}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{c.desc}</CardContent>
          </Card>
        ))}
      </div>
      <SimpleTable rows={rows} columns={[
        { header: "Company", cell: (r) => r.company ?? "—" },
        { header: "Email", cell: (r) => r.contact_email },
        { header: "Website", cell: (r) => r.website ?? "—" },
        { header: "Sandbox", cell: (r) => r.sandbox_enabled ? "Enabled" : "Disabled" },
        { header: "Status", cell: (r) => r.status },
      ]} />
    </div>
  );
}
