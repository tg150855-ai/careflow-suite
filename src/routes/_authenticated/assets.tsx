import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/assets")({ component: Assets });

const CATS = ["Medical Equipment", "OT Equipment", "Computers", "Printers", "Furniture", "Ambulances", "Lab Equipment", "Other"];
const STATUSES = ["active", "under_maintenance", "retired"];

function Assets() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Medical Equipment", serial_no: "", purchase_date: "", purchase_cost: 0, warranty_until: "", amc_until: "", department: "", location: "", status: "active" });

  async function load() {
    const { data } = await (supabase as any).from("assets").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.name) return toast.error("Name required");
    const { error } = await (supabase as any).from("assets").insert({ ...form, purchase_date: form.purchase_date || null, warranty_until: form.warranty_until || null, amc_until: form.amc_until || null } as any);
    if (error) return toast.error(error.message);
    toast.success("Asset added"); setOpen(false);
    setForm({ name: "", category: "Medical Equipment", serial_no: "", purchase_date: "", purchase_cost: 0, warranty_until: "", amc_until: "", department: "", location: "", status: "active" });
    load();
  }

  async function updateStatus(id: string, status: string) {
    await (supabase as any).from("assets").update({ status } as any).eq("id", id);
    load();
  }

  const totalValue = rows.reduce((s, r) => s + +(r.purchase_cost ?? 0), 0);
  const active = rows.filter((r) => r.status === "active").length;
  const maint = rows.filter((r) => r.status === "under_maintenance").length;
  const retired = rows.filter((r) => r.status === "retired").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Boxes className="size-6 text-primary" /> Asset Management</h1>
          <p className="text-sm text-muted-foreground">Track hospital equipment and assets.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Add Asset</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>New Asset</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Serial No</Label><Input value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} /></div>
              <div><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></div>
              <div><Label>Purchase Cost (₹)</Label><Input type="number" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: Number(e.target.value) })} /></div>
              <div><Label>Warranty Until</Label><Input type="date" value={form.warranty_until} onChange={(e) => setForm({ ...form, warranty_until: e.target.value })} /></div>
              <div><Label>AMC Until</Label><Input type="date" value={form.amc_until} onChange={(e) => setForm({ ...form, amc_until: e.target.value })} /></div>
              <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total Assets</div><div className="text-2xl font-semibold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-semibold text-emerald-600">{active}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Under Maintenance</div><div className="text-2xl font-semibold text-amber-600">{maint}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total Value</div><div className="text-2xl font-semibold">{fmtINR(totalValue)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All Assets ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Asset ID</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Department</TableHead><TableHead>Cost</TableHead><TableHead>AMC Until</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.asset_no}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell>{r.department ?? "—"}</TableCell>
                  <TableCell>{fmtINR(r.purchase_cost)}</TableCell>
                  <TableCell className="text-xs">{r.amc_until ? format(new Date(r.amc_until), "dd MMM yyyy") : "—"}</TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                      <SelectTrigger className="h-7 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No assets yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
