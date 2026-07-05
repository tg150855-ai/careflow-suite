import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Boxes, Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtINR } from "@/lib/format";
import { format } from "date-fns";
import { ModuleActionBar } from "@/components/common/action-bar";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";
import { DayMonthYearTabs, useDateRange } from "@/components/common/date-range-tabs";
import { exportXlsx } from "@/lib/export";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/assets")({ component: Assets });

const CATS = ["Medical Equipment", "OT Equipment", "Computers", "Printers", "Furniture", "Ambulances", "Lab Equipment", "Other"];
const STATUSES = ["active", "under_maintenance", "retired"];

const EMPTY = { name: "", category: "Medical Equipment", serial_no: "", purchase_date: "", purchase_cost: 0, warranty_until: "", amc_until: "", department: "", location: "", status: "active" };

function Assets() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [search, setSearch] = useState("");
  const { range, preset, setPreset } = useDateRange("all");

  async function load() {
    const { data } = await (supabase as any).from("assets").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: any) {
    setEditing(r);
    setForm({
      name: r.name ?? "", category: r.category ?? "Medical Equipment", serial_no: r.serial_no ?? "",
      purchase_date: r.purchase_date ?? "", purchase_cost: r.purchase_cost ?? 0,
      warranty_until: r.warranty_until ?? "", amc_until: r.amc_until ?? "",
      department: r.department ?? "", location: r.location ?? "", status: r.status ?? "active",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name) return toast.error("Name required");
    const payload = { ...form, purchase_date: form.purchase_date || null, warranty_until: form.warranty_until || null, amc_until: form.amc_until || null };
    const { error } = editing
      ? await (supabase as any).from("assets").update(payload).eq("id", editing.id)
      : await (supabase as any).from("assets").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Asset updated" : "Asset added");
    setOpen(false); setEditing(null); setForm(EMPTY); load();
  }

  async function updateStatus(id: string, status: string) {
    await (supabase as any).from("assets").update({ status }).eq("id", id);
    load();
  }

  async function removeAsset(id: string) {
    const { error } = await (supabase as any).from("assets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Asset deleted"); load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (preset !== "all") {
        const created = r.created_at ? new Date(r.created_at) : null;
        if (!created || created < range.from || created > range.to) return false;
      }
      if (!q) return true;
      return [r.asset_no, r.name, r.category, r.department, r.location, r.serial_no]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q));
    });
  }, [rows, search, preset, range]);

  function exportRows() {
    exportXlsx(filtered.map((r) => ({
      "Asset No": r.asset_no, Name: r.name, Category: r.category, Department: r.department ?? "",
      Location: r.location ?? "", "Serial No": r.serial_no ?? "",
      "Purchase Date": r.purchase_date ?? "", "Purchase Cost": r.purchase_cost ?? 0,
      "Warranty Until": r.warranty_until ?? "", "AMC Until": r.amc_until ?? "", Status: r.status,
    })), `assets-${format(new Date(), "yyyyMMdd")}`);
  }

  const totalValue = filtered.reduce((s, r) => s + +(r.purchase_cost ?? 0), 0);
  const active = filtered.filter((r) => r.status === "active").length;
  const maint = filtered.filter((r) => r.status === "under_maintenance").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Boxes className="size-6 text-primary" /> Asset Management</h1>
          <p className="text-sm text-muted-foreground">Track hospital equipment and assets.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="size-4" /> Add Asset</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Asset" : "New Asset"}</DialogTitle></DialogHeader>
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
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total Assets</div><div className="text-2xl font-semibold">{filtered.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-semibold text-emerald-600">{active}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Under Maintenance</div><div className="text-2xl font-semibold text-amber-600">{maint}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Total Value</div><div className="text-2xl font-semibold">{fmtINR(totalValue)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>All Assets ({filtered.length})</CardTitle>
          <ModuleActionBar
            leading={<SearchBox value={search} onChange={setSearch} placeholder="Search asset no, name, department…" />}
            onAdd={openNew}
            onExport={exportRows}
            onPrint={() => window.print()}
            extra={<DayMonthYearTabs value={preset} onChange={(p) => setPreset(p)} />}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Asset ID</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Department</TableHead><TableHead>Cost</TableHead><TableHead>AMC Until</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => (
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
                  <TableCell className="text-right">
                    <RecordActions
                      size="icon"
                      deleteLabel={`asset ${r.asset_no ?? r.name}`}
                      onEdit={() => openEdit(r)}
                      onWhatsApp={() => shareOnWhatsApp(summarizeRecord("Asset", {
                        "Asset No": r.asset_no, Name: r.name, Category: r.category,
                        Department: r.department ?? "—", Location: r.location ?? "—",
                        Cost: fmtINR(r.purchase_cost), "AMC Until": r.amc_until ?? "—", Status: r.status,
                      }))}
                      onDelete={() => removeAsset(r.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No assets found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
