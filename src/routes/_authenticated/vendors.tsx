import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ModuleActionBar } from "@/components/common/action-bar";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";
import { DayMonthYearTabs, useDateRange } from "@/components/common/date-range-tabs";
import { exportXlsx } from "@/lib/export";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/vendors")({ component: Vendors });

const CATS = ["Medicines", "Equipment", "Laboratory Supplies", "Consumables", "Services", "Other"];
const EMPTY = { name: "", category: "Medicines", gst_number: "", contact_person: "", phone: "", email: "", address: "", payment_terms: "Net 30" };

function Vendors() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [search, setSearch] = useState("");
  const { range, preset, setPreset } = useDateRange("all");

  async function load() {
    const { data } = await (supabase as any).from("vendors").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: any) {
    setEditing(r);
    setForm({
      name: r.name ?? "", category: r.category ?? "Medicines", gst_number: r.gst_number ?? "",
      contact_person: r.contact_person ?? "", phone: r.phone ?? "", email: r.email ?? "",
      address: r.address ?? "", payment_terms: r.payment_terms ?? "Net 30",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name) return toast.error("Name required");
    const { error } = editing
      ? await (supabase as any).from("vendors").update(form).eq("id", editing.id)
      : await (supabase as any).from("vendors").insert(form);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Vendor updated" : "Vendor added");
    setOpen(false); setEditing(null); setForm(EMPTY); load();
  }

  async function removeVendor(id: string) {
    const { error } = await (supabase as any).from("vendors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Vendor deleted"); load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (preset !== "all") {
        const created = r.created_at ? new Date(r.created_at) : null;
        if (!created || created < range.from || created > range.to) return false;
      }
      if (!q) return true;
      return [r.name, r.category, r.gst_number, r.contact_person, r.phone, r.email]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q));
    });
  }, [rows, search, preset, range]);

  function exportRows() {
    exportXlsx(filtered.map((r) => ({
      Name: r.name, Category: r.category, GST: r.gst_number ?? "",
      Contact: r.contact_person ?? "", Phone: r.phone ?? "", Email: r.email ?? "",
      "Payment Terms": r.payment_terms ?? "", Address: r.address ?? "",
      Active: r.active ? "Yes" : "No",
    })), `vendors-${format(new Date(), "yyyyMMdd")}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Truck className="size-6 text-primary" /> Vendor Management</h1>
          <p className="text-sm text-muted-foreground">Suppliers, contracts, and contacts.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="size-4" /> Add Vendor</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Vendor" : "New Vendor"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>GST Number</Label><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></div>
              <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Payment Terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>All Vendors ({filtered.length})</CardTitle>
          <ModuleActionBar
            leading={<SearchBox value={search} onChange={setSearch} placeholder="Search name, GST, contact…" />}
            onAdd={openNew}
            onExport={exportRows}
            onPrint={() => window.print()}
            extra={<DayMonthYearTabs value={preset} onChange={(p) => setPreset(p)} />}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>GST</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell className="font-mono text-xs">{r.gst_number ?? "—"}</TableCell>
                  <TableCell>{r.contact_person ?? "—"}</TableCell>
                  <TableCell>{r.phone ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.active ? "default" : "secondary"}>{r.active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <RecordActions
                      size="icon"
                      deleteLabel={`vendor ${r.name}`}
                      onEdit={() => openEdit(r)}
                      onWhatsApp={() => shareOnWhatsApp(summarizeRecord("Vendor", {
                        Name: r.name, Category: r.category, GST: r.gst_number ?? "—",
                        Contact: r.contact_person ?? "—", Phone: r.phone ?? "—",
                        Email: r.email ?? "—", "Payment Terms": r.payment_terms ?? "—",
                      }), undefined, r.phone ?? undefined)}
                      onDelete={() => removeVendor(r.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No vendors found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
