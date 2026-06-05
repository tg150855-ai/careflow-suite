import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { listRows, insertRow } from "@/lib/saas-crud";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subscriptions")({ component: SubsPage });

function SubsPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [invs, setInvs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState({ code: "", name: "", tier: "starter", monthly_price: 0, yearly_price: 0, user_limit: 10, storage_quota_gb: 10 });

  async function load() {
    setPlans(await listRows("subscription_plans", { order: "monthly_price", ascending: true }));
    setSubs(await listRows("subscriptions", { order: "created_at" }));
    setInvs(await listRows("saas_invoices", { order: "issued_at" }));
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader icon={CreditCard} title="Subscription Management" subtitle="Plans, active subscriptions, and SaaS invoices" />
      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="subs">Subscriptions</TabsTrigger>
          <TabsTrigger value="inv">Invoices</TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="space-y-3">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New Plan</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Plan</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Code</Label><Input value={plan.code} onChange={(e) => setPlan({ ...plan, code: e.target.value })} /></div>
                  <div><Label>Name</Label><Input value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} /></div>
                </div>
                <div><Label>Tier</Label><Input value={plan.tier} onChange={(e) => setPlan({ ...plan, tier: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Monthly Price</Label><Input type="number" value={plan.monthly_price} onChange={(e) => setPlan({ ...plan, monthly_price: +e.target.value })} /></div>
                  <div><Label>Yearly Price</Label><Input type="number" value={plan.yearly_price} onChange={(e) => setPlan({ ...plan, yearly_price: +e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>User Limit</Label><Input type="number" value={plan.user_limit} onChange={(e) => setPlan({ ...plan, user_limit: +e.target.value })} /></div>
                  <div><Label>Storage GB</Label><Input type="number" value={plan.storage_quota_gb} onChange={(e) => setPlan({ ...plan, storage_quota_gb: +e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={async () => { try { await insertRow("subscription_plans", plan); toast.success("Created"); setOpen(false); load(); } catch (e: any) { toast.error(e.message); } }} disabled={!plan.code || !plan.name}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <SimpleTable rows={plans} columns={[
            { header: "Plan", cell: (r) => <span className="font-medium">{r.name}</span> },
            { header: "Tier", cell: (r) => <Badge className="capitalize">{r.tier}</Badge> },
            { header: "Monthly", cell: (r) => inr(r.monthly_price) },
            { header: "Yearly", cell: (r) => inr(r.yearly_price) },
            { header: "Users", cell: (r) => r.user_limit },
            { header: "Storage", cell: (r) => `${r.storage_quota_gb} GB` },
          ]} />
        </TabsContent>
        <TabsContent value="subs"><SimpleTable rows={subs} columns={[
          { header: "Tenant", cell: (r) => r.tenant_id?.slice(0, 8) },
          { header: "Cycle", cell: (r) => r.billing_cycle },
          { header: "Amount", cell: (r) => inr(r.amount) },
          { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
          { header: "Auto-renew", cell: (r) => r.auto_renew ? "Yes" : "No" },
        ]} /></TabsContent>
        <TabsContent value="inv"><SimpleTable rows={invs} columns={[
          { header: "Invoice #", cell: (r) => r.invoice_no },
          { header: "Total", cell: (r) => inr(r.total) },
          { header: "Status", cell: (r) => <Badge variant={r.status === "paid" ? "default" : "secondary"}>{r.status}</Badge> },
          { header: "Issued", cell: (r) => new Date(r.issued_at).toLocaleDateString() },
        ]} /></TabsContent>
      </Tabs>
    </div>
  );
}
