import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Palette, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/branding")({ component: BrandingPage });

function BrandingPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [openB, setOpenB] = useState(false);
  const [openD, setOpenD] = useState(false);
  const [b, setB] = useState({ tenant_id: "", logo_url: "", primary_color: "#3b82f6", accent_color: "#10b981", login_title: "" });
  const [d, setD] = useState({ tenant_id: "", domain: "", domain_type: "subdomain" });

  async function load() {
    setBrands(await listRows("tenant_branding", { order: "created_at" }));
    setDomains(await listRows("tenant_domains", { order: "created_at" }));
  }
  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHeader icon={Palette} title="White Label & Domains" subtitle="Per-tenant branding, themes, and custom domains" />
      <Tabs defaultValue="brand">
        <TabsList><TabsTrigger value="brand">Branding</TabsTrigger><TabsTrigger value="dom">Domains</TabsTrigger></TabsList>
        <TabsContent value="brand" className="space-y-3">
          <Dialog open={openB} onOpenChange={setOpenB}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Add Branding</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tenant Branding</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Tenant ID</Label><Input value={b.tenant_id} onChange={(e) => setB({ ...b, tenant_id: e.target.value })} /></div>
                <div><Label>Logo URL</Label><Input value={b.logo_url} onChange={(e) => setB({ ...b, logo_url: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Primary</Label><Input type="color" value={b.primary_color} onChange={(e) => setB({ ...b, primary_color: e.target.value })} /></div>
                  <div><Label>Accent</Label><Input type="color" value={b.accent_color} onChange={(e) => setB({ ...b, accent_color: e.target.value })} /></div>
                </div>
                <div><Label>Login Title</Label><Input value={b.login_title} onChange={(e) => setB({ ...b, login_title: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={async () => { try { await insertRow("tenant_branding", b); toast.success("Saved"); setOpenB(false); load(); } catch (e: any) { toast.error(e.message); } }} disabled={!b.tenant_id}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <SimpleTable rows={brands} columns={[
            { header: "Tenant", cell: (r) => r.tenant_id?.slice(0, 8) },
            { header: "Primary", cell: (r) => <div className="flex items-center gap-2"><div className="size-4 rounded" style={{ background: r.primary_color }} />{r.primary_color}</div> },
            { header: "Accent", cell: (r) => <div className="flex items-center gap-2"><div className="size-4 rounded" style={{ background: r.accent_color }} />{r.accent_color}</div> },
            { header: "Theme", cell: (r) => r.theme },
          ]} />
        </TabsContent>
        <TabsContent value="dom" className="space-y-3">
          <Dialog open={openD} onOpenChange={setOpenD}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Add Domain</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tenant Domain</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Tenant ID</Label><Input value={d.tenant_id} onChange={(e) => setD({ ...d, tenant_id: e.target.value })} /></div>
                <div><Label>Domain</Label><Input value={d.domain} onChange={(e) => setD({ ...d, domain: e.target.value })} placeholder="hospitalA.medicore.com" /></div>
                <div><Label>Type</Label><Input value={d.domain_type} onChange={(e) => setD({ ...d, domain_type: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={async () => { try { await insertRow("tenant_domains", d); toast.success("Saved"); setOpenD(false); load(); } catch (e: any) { toast.error(e.message); } }} disabled={!d.tenant_id || !d.domain}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <SimpleTable rows={domains} columns={[
            { header: "Domain", cell: (r) => <code className="text-xs">{r.domain}</code> },
            { header: "Type", cell: (r) => r.domain_type },
            { header: "SSL", cell: (r) => r.ssl_enabled ? "Yes" : "No" },
            { header: "Status", cell: (r) => r.status },
          ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
