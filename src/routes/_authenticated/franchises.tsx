import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/franchises")({ component: FranchisePage });

function FranchisePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", license_no: "", license_expires_at: "", revenue_share_percent: 10, contact_email: "" });

  async function load() { setRows(await listRows("franchises", { order: "created_at" })); }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader icon={Store} title="Franchise Management" subtitle="Registration, licensing, revenue share, compliance"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Register Franchise</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register Franchise</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>License #</Label><Input value={f.license_no} onChange={(e) => setF({ ...f, license_no: e.target.value })} /></div>
                  <div><Label>Expires</Label><Input type="date" value={f.license_expires_at} onChange={(e) => setF({ ...f, license_expires_at: e.target.value })} /></div>
                </div>
                <div><Label>Revenue Share %</Label><Input type="number" value={f.revenue_share_percent} onChange={(e) => setF({ ...f, revenue_share_percent: +e.target.value })} /></div>
                <div><Label>Contact Email</Label><Input value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={async () => { try { await insertRow("franchises", { ...f, license_expires_at: f.license_expires_at || null }); toast.success("Registered"); setOpen(false); load(); } catch (e: any) { toast.error(e.message); } }} disabled={!f.name}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <SimpleTable rows={rows} columns={[
        { header: "Franchise", cell: (r) => <span className="font-medium">{r.name}</span> },
        { header: "License", cell: (r) => r.license_no ?? "—" },
        { header: "Expires", cell: (r) => r.license_expires_at ?? "—" },
        { header: "Rev Share", cell: (r) => `${r.revenue_share_percent}%` },
        { header: "Compliance", cell: (r) => `${r.compliance_score}%` },
        { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
      ]} />
    </div>
  );
}
