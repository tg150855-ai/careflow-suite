import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plug, Plus, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { listRows, insertRow } from "@/lib/saas-crud";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/api-marketplace")({ component: ApiPage });

function ApiPage() {
  const [prods, setProds] = useState<any[]>([]);
  const [keys, setKeys] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [openP, setOpenP] = useState(false);
  const [openK, setOpenK] = useState(false);
  const [prod, setProd] = useState({ code: "", name: "", category: "patient", base_path: "/api/", rate_limit_per_min: 60, price_per_1k: 0 });
  const [key, setKey] = useState({ name: "", rate_limit_per_min: 60, monthly_quota: 100000 });
  const [newKey, setNewKey] = useState<string | null>(null);

  async function load() {
    setProds(await listRows("api_products", { order: "created_at" }));
    setKeys(await listRows("api_keys", { order: "created_at" }));
    setLogs(await listRows("api_usage_logs", { order: "created_at", limit: 50 }));
  }
  useEffect(() => { load(); }, []);

  async function generateKey() {
    const raw = "mcr_" + crypto.randomUUID().replace(/-/g, "");
    const key_prefix = raw.slice(0, 8);
    const enc = new TextEncoder().encode(raw);
    const hashBuf = await crypto.subtle.digest("SHA-256", enc);
    const key_hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    try { await insertRow("api_keys", { ...key, key_prefix, key_hash, scopes: ["read"] }); setNewKey(raw); toast.success("Key generated — copy it now"); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div>
      <PageHeader icon={Plug} title="API Marketplace" subtitle="API products, tenant keys, and usage analytics" />
      <Tabs defaultValue="prods">
        <TabsList>
          <TabsTrigger value="prods">Products</TabsTrigger>
          <TabsTrigger value="keys">Keys</TabsTrigger>
          <TabsTrigger value="logs">Usage</TabsTrigger>
        </TabsList>
        <TabsContent value="prods" className="space-y-3">
          <Dialog open={openP} onOpenChange={setOpenP}>
            <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> New API Product</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>API Product</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Code</Label><Input value={prod.code} onChange={(e) => setProd({ ...prod, code: e.target.value })} /></div>
                  <div><Label>Name</Label><Input value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} /></div>
                </div>
                <div><Label>Category</Label><Input value={prod.category} onChange={(e) => setProd({ ...prod, category: e.target.value })} placeholder="patient, billing, lab..." /></div>
                <div><Label>Base Path</Label><Input value={prod.base_path} onChange={(e) => setProd({ ...prod, base_path: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Rate Limit / min</Label><Input type="number" value={prod.rate_limit_per_min} onChange={(e) => setProd({ ...prod, rate_limit_per_min: +e.target.value })} /></div>
                  <div><Label>Price / 1k calls</Label><Input type="number" step="0.01" value={prod.price_per_1k} onChange={(e) => setProd({ ...prod, price_per_1k: +e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={async () => { try { await insertRow("api_products", prod); toast.success("Created"); setOpenP(false); load(); } catch (e: any) { toast.error(e.message); } }} disabled={!prod.code || !prod.name}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <SimpleTable rows={prods} columns={[
            { header: "Code", cell: (r) => <code className="text-xs">{r.code}</code> },
            { header: "Name", cell: (r) => r.name },
            { header: "Category", cell: (r) => <Badge variant="outline">{r.category}</Badge> },
            { header: "Path", cell: (r) => <code className="text-xs">{r.base_path}</code> },
            { header: "Rate/min", cell: (r) => r.rate_limit_per_min },
          ]} />
        </TabsContent>
        <TabsContent value="keys" className="space-y-3">
          <Dialog open={openK} onOpenChange={(o) => { setOpenK(o); if (!o) setNewKey(null); }}>
            <DialogTrigger asChild><Button><KeyRound className="size-4 mr-1" /> Generate Key</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate API Key</DialogTitle></DialogHeader>
              {newKey ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Copy this key now. It will not be shown again.</p>
                  <code className="block p-3 bg-muted rounded text-xs break-all">{newKey}</code>
                </div>
              ) : (
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={key.name} onChange={(e) => setKey({ ...key, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Rate/min</Label><Input type="number" value={key.rate_limit_per_min} onChange={(e) => setKey({ ...key, rate_limit_per_min: +e.target.value })} /></div>
                    <div><Label>Monthly Quota</Label><Input type="number" value={key.monthly_quota} onChange={(e) => setKey({ ...key, monthly_quota: +e.target.value })} /></div>
                  </div>
                </div>
              )}
              <DialogFooter>{newKey ? <Button onClick={() => { setOpenK(false); setNewKey(null); }}>Done</Button> : <Button onClick={generateKey} disabled={!key.name}>Generate</Button>}</DialogFooter>
            </DialogContent>
          </Dialog>
          <SimpleTable rows={keys} columns={[
            { header: "Name", cell: (r) => r.name },
            { header: "Prefix", cell: (r) => <code className="text-xs">{r.key_prefix}…</code> },
            { header: "Rate", cell: (r) => `${r.rate_limit_per_min}/min` },
            { header: "Quota", cell: (r) => r.monthly_quota.toLocaleString() },
            { header: "Status", cell: (r) => <Badge>{r.status}</Badge> },
            { header: "Last Used", cell: (r) => r.last_used_at ? new Date(r.last_used_at).toLocaleString() : "—" },
          ]} />
        </TabsContent>
        <TabsContent value="logs"><SimpleTable rows={logs} empty="No API calls yet." columns={[
          { header: "Endpoint", cell: (r) => <code className="text-xs">{r.endpoint}</code> },
          { header: "Method", cell: (r) => r.method },
          { header: "Status", cell: (r) => <Badge variant={r.status_code && r.status_code < 400 ? "default" : "destructive"}>{r.status_code}</Badge> },
          { header: "Latency", cell: (r) => `${r.latency_ms}ms` },
          { header: "At", cell: (r) => new Date(r.created_at).toLocaleString() },
        ]} /></TabsContent>
      </Tabs>
    </div>
  );
}
