import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tenants")({ component: TenantsPage });

function TenantsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ hospital_name: "", org_type: "multi_specialty", subscription_plan: "starter", user_limit: 25, storage_quota_gb: 50 });

  async function load() { setRows(await listRows("tenants", { order: "created_at" })); }
  useEffect(() => { load(); }, []);

  async function save() {
    try { await insertRow("tenants", form); toast.success("Tenant created"); setOpen(false); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div>
      <PageHeader icon={Building2} title="Tenants" subtitle="Hospitals onboarded to the MediCore SaaS platform"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New Tenant</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Onboard Tenant</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Hospital Name</Label><Input value={form.hospital_name} onChange={(e) => setForm({ ...form, hospital_name: e.target.value })} /></div>
                <div><Label>Organisation Type</Label>
                  <Select value={form.org_type} onValueChange={(v) => setForm({ ...form, org_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinic">Clinic</SelectItem>
                      <SelectItem value="diagnostic">Diagnostic Center</SelectItem>
                      <SelectItem value="multi_specialty">Multi-Specialty</SelectItem>
                      <SelectItem value="hospital_chain">Hospital Chain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Plan</Label>
                  <Select value={form.subscription_plan} onValueChange={(v) => setForm({ ...form, subscription_plan: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter Clinic</SelectItem>
                      <SelectItem value="small">Small Hospital</SelectItem>
                      <SelectItem value="multi">Multi-Specialty</SelectItem>
                      <SelectItem value="enterprise">Enterprise Chain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>User limit</Label><Input type="number" value={form.user_limit} onChange={(e) => setForm({ ...form, user_limit: +e.target.value })} /></div>
                  <div><Label>Storage (GB)</Label><Input type="number" value={form.storage_quota_gb} onChange={(e) => setForm({ ...form, storage_quota_gb: +e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={save} disabled={!form.hospital_name}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <SimpleTable
        rows={rows}
        columns={[
          { header: "Hospital", cell: (r) => <span className="font-medium">{r.hospital_name}</span> },
          { header: "Type", cell: (r) => <Badge variant="outline" className="capitalize">{r.org_type.replace("_"," ")}</Badge> },
          { header: "Plan", cell: (r) => <Badge className="capitalize">{r.subscription_plan}</Badge> },
          { header: "Status", cell: (r) => <Badge variant={r.status === "active" ? "default" : "secondary"} className="capitalize">{r.status}</Badge> },
          { header: "Users", cell: (r) => r.user_limit },
          { header: "Storage", cell: (r) => `${r.storage_quota_gb} GB` },
        ]}
        empty="No tenants yet. Click 'New Tenant' to onboard a hospital."
      />
    </div>
  );
}
