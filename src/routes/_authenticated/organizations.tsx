import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Network, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/organizations")({ component: OrgPage });

function OrgPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [openOrg, setOpenOrg] = useState(false);
  const [openReg, setOpenReg] = useState(false);
  const [org, setOrg] = useState({ name: "", org_type: "hospital_chain", contact_email: "", country: "India" });
  const [reg, setReg] = useState({ name: "", organization_id: "", country: "India", state: "" });

  async function load() {
    setOrgs(await listRows("organizations", { order: "created_at" }));
    setRegions(await listRows("regions", { order: "created_at" }));
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader icon={Network} title="Organisations & Regions" subtitle="Hospital chain hierarchy: Organisation → Region → Hospital → Department" />
      <Tabs defaultValue="orgs">
        <TabsList><TabsTrigger value="orgs">Organisations</TabsTrigger><TabsTrigger value="regions">Regions</TabsTrigger></TabsList>
        <TabsContent value="orgs" className="space-y-3">
          <Dialog open={openOrg} onOpenChange={setOpenOrg}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New Organisation</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Organisation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></div>
                <div><Label>Type</Label><Input value={org.org_type} onChange={(e) => setOrg({ ...org, org_type: e.target.value })} /></div>
                <div><Label>Contact Email</Label><Input value={org.contact_email} onChange={(e) => setOrg({ ...org, contact_email: e.target.value })} /></div>
                <div><Label>Country</Label><Input value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={async () => { try { await insertRow("organizations", org); toast.success("Created"); setOpenOrg(false); load(); } catch (e: any) { toast.error(e.message); } }} disabled={!org.name}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <SimpleTable rows={orgs} columns={[
            { header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
            { header: "Type", cell: (r) => r.org_type },
            { header: "Country", cell: (r) => r.country ?? "—" },
            { header: "Status", cell: (r) => r.status },
          ]} />
        </TabsContent>
        <TabsContent value="regions" className="space-y-3">
          <Dialog open={openReg} onOpenChange={setOpenReg}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New Region</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Region</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Region Name</Label><Input value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} /></div>
                <div><Label>Organisation ID</Label><Input value={reg.organization_id} onChange={(e) => setReg({ ...reg, organization_id: e.target.value })} placeholder="UUID from organisations" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Country</Label><Input value={reg.country} onChange={(e) => setReg({ ...reg, country: e.target.value })} /></div>
                  <div><Label>State</Label><Input value={reg.state} onChange={(e) => setReg({ ...reg, state: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={async () => { try { await insertRow("regions", reg); toast.success("Created"); setOpenReg(false); load(); } catch (e: any) { toast.error(e.message); } }} disabled={!reg.name || !reg.organization_id}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <SimpleTable rows={regions} columns={[
            { header: "Region", cell: (r) => r.name },
            { header: "Country", cell: (r) => r.country ?? "—" },
            { header: "State", cell: (r) => r.state ?? "—" },
          ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
