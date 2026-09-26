import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Package, ChevronDown, ChevronRight, Layers, FileSpreadsheet, Trash2 } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { DataImportDialog, ImportColumn, ImportSummary } from "@/components/data-import-dialog";

export const Route = createFileRoute("/_authenticated/pharmacy/medicines")({ component: MedicinesPage });

function MedicinesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: meds = [] } = useQuery({
    queryKey: ["medicines", q],
    queryFn: async () => {
      let query = supabase.from("medicines").select("*, medicine_batches(id, batch_no, expiry_date, purchase_price, mrp, quantity)").eq("active", true).order("name").limit(200);
      if (q.length >= 2) query = query.or(`name.ilike.%${q}%,generic_name.ilike.%${q}%,manufacturer.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMed = useMutation({
    mutationFn: async (m: any) => {
      const { error } = await supabase.from("medicines").insert(m);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Medicine added"); qc.invalidateQueries({ queryKey: ["medicines"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBatch = useMutation({
    mutationFn: async (b: any) => {
      const { error } = await supabase.from("medicine_batches").insert(b);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Batch added"); qc.invalidateQueries({ queryKey: ["medicines"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const importColumns: ImportColumn[] = [
    { key: "Name", required: true, example: "Paracetamol 500mg" },
    { key: "Generic Name", example: "Acetaminophen", aliases: ["Generic", "Formula"] },
    { key: "Manufacturer", example: "Cipla", aliases: ["Brand", "Company"] },
    { key: "Unit", example: "strips", aliases: ["Form"] },
    { key: "GST", example: "12", aliases: ["Tax", "GST %"] },
    { key: "Min Stock", example: "10", aliases: ["Minimum Stock"] },
    { key: "Batch No", example: "BAT-102", aliases: ["Batch"] },
    { key: "Expiry", example: "2027-12-31", aliases: ["Expiry Date"] },
    { key: "MRP", example: "45", aliases: ["Price", "Retail Price"] },
    { key: "Quantity", example: "100", aliases: ["Stock", "Qty"] },
  ];

  const handleExcelImport = async (rows: Record<string, string>[]): Promise<ImportSummary> => {
    let inserted = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const r of rows) {
      const name = (r["name"] ?? r["Name"] ?? "").trim();
      if (!name) {
        skipped++;
        continue;
      }
      try {
        const { data: newMed, error: mErr } = await supabase.from("medicines").insert({
          name,
          generic_name: r["generic name"] ?? r["generic"] ?? null,
          manufacturer: r["manufacturer"] ?? r["brand"] ?? null,
          unit: r["unit"] ?? "pcs",
          gst_percent: Number(r["gst"] ?? r["tax"] ?? 12),
          minimum_stock: Number(r["min stock"] ?? r["minimum stock"] ?? 10),
          active: true,
        }).select("id").single();
        if (mErr) throw mErr;

        const batchNo = r["batch no"] ?? r["batch"];
        const qty = Number(r["quantity"] ?? r["stock"] ?? 0);
        if (newMed && (batchNo || qty > 0)) {
          await supabase.from("medicine_batches").insert({
            medicine_id: newMed.id,
            batch_no: batchNo || `B-${Date.now().toString().slice(-6)}`,
            expiry_date: r["expiry"] ?? r["expiry date"] ?? addDays(new Date(), 365).toISOString().slice(0, 10),
            mrp: Number(r["mrp"] ?? 0),
            purchase_price: Math.round(Number(r["mrp"] ?? 0) * 0.7),
            quantity: qty,
          });
        }
        inserted++;
      } catch (err: any) {
        failed++;
        errors.push(`${name}: ${err.message}`);
      }
    }
    qc.invalidateQueries({ queryKey: ["medicines"] });
    return { inserted, skipped, failed, errors };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/pharmacy"><ArrowLeft className="size-4" /></Link></Button>
          <div><h1 className="text-2xl font-semibold tracking-tight">Medicines</h1><p className="text-sm text-muted-foreground">{meds.length} items</p></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="size-4 mr-1.5" />Import Excel
          </Button>
          <BulkMedicineDialog onSaved={() => qc.invalidateQueries({ queryKey: ["medicines"] })} />
          <NewMedicineDialog onSubmit={(v) => createMed.mutate(v)} />
        </div>
      </div>

      <DataImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Bulk Import Medicines via Excel / CSV"
        templateName="Medicines_Bulk_Import.xlsx"
        columns={importColumns}
        onImport={handleExcelImport}
        helperText="Upload distributor or inventory sheets to add multiple medicines and initial batches at once."
      />

      <Card className="p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, generic or manufacturer..." className="h-11 bg-surface-muted border-transparent" />
      </Card>

      <Card className="overflow-hidden">
        <div className="divide-y">
          {meds.map((m: any) => {
            const totalStock = (m.medicine_batches ?? []).reduce((s: number, b: any) => s + b.quantity, 0);
            const isLow = totalStock > 0 && totalStock <= m.minimum_stock;
            const isOut = totalStock === 0;
            const isOpen = expanded === m.id;
            return (
              <div key={m.id}>
                <button onClick={() => setExpanded(isOpen ? null : m.id)} className="w-full flex items-center justify-between p-4 hover:bg-surface-muted text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown className="size-4 text-muted-foreground shrink-0" /> : <ChevronRight className="size-4 text-muted-foreground shrink-0" />}
                    <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Package className="size-4" /></div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{[m.generic_name, m.manufacturer].filter(Boolean).join(" · ")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right"><div className="text-sm font-medium tabular-nums">{totalStock} {m.unit}</div><div className="text-xs text-muted-foreground">Min {m.minimum_stock}</div></div>
                    {isOut ? <Badge variant="destructive">Out</Badge> : isLow ? <Badge variant="outline" className="border-warning text-warning-foreground">Low</Badge> : <Badge variant="secondary">In stock</Badge>}
                  </div>
                </button>
                {isOpen && (
                  <div className="bg-surface-muted/50 px-6 py-4 border-t">
                    <div className="flex items-center justify-between mb-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">Batches</div><BatchDialog medicineId={m.id} onSubmit={(b) => addBatch.mutate(b)} /></div>
                    {(m.medicine_batches ?? []).length === 0 ? <div className="text-sm text-muted-foreground py-4 text-center">No batches yet.</div> : (
                      <table className="w-full text-sm">
                        <thead><tr className="text-xs uppercase tracking-wider text-muted-foreground"><th className="text-left py-2">Batch</th><th className="text-left py-2">Expiry</th><th className="text-right py-2">Purchase</th><th className="text-right py-2">MRP</th><th className="text-right py-2">Qty</th></tr></thead>
                        <tbody className="divide-y">
                          {m.medicine_batches.map((b: any) => (
                            <tr key={b.id}><td className="py-2 font-mono text-xs">{b.batch_no}</td><td className="py-2">{format(new Date(b.expiry_date), "dd MMM yyyy")}</td><td className="py-2 text-right tabular-nums">{inr(b.purchase_price)}</td><td className="py-2 text-right tabular-nums">{inr(b.mrp)}</td><td className="py-2 text-right tabular-nums">{b.quantity}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {meds.length === 0 && <div className="p-12 text-center text-sm text-muted-foreground">No medicines. Click "New medicine" above.</div>}
        </div>
      </Card>
    </div>
  );
}

function NewMedicineDialog({ onSubmit }: { onSubmit: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", generic_name: "", manufacturer: "", unit: "pcs", gst_percent: 12, minimum_stock: 10 });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New medicine</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add medicine</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Generic name</Label><Input value={f.generic_name} onChange={(e) => setF({ ...f, generic_name: e.target.value })} /></div>
            <div><Label>Manufacturer</Label><Input value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Unit</Label><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
            <div><Label>GST %</Label><Input type="number" value={f.gst_percent} onChange={(e) => setF({ ...f, gst_percent: Number(e.target.value) })} /></div>
            <div><Label>Min stock</Label><Input type="number" value={f.minimum_stock} onChange={(e) => setF({ ...f, minimum_stock: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter><Button disabled={!f.name} onClick={() => { onSubmit(f); setOpen(false); setF({ name: "", generic_name: "", manufacturer: "", unit: "pcs", gst_percent: 12, minimum_stock: 10 }); }}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchDialog({ medicineId, onSubmit }: { medicineId: string; onSubmit: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ batch_no: "", expiry_date: "", purchase_price: 0, mrp: 0, quantity: 0 });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="size-3.5 mr-1" />Add batch</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add batch / purchase entry</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Batch no *</Label><Input value={f.batch_no} onChange={(e) => setF({ ...f, batch_no: e.target.value })} /></div>
            <div><Label>Expiry *</Label><Input type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Purchase ₹</Label><Input type="number" value={f.purchase_price} onChange={(e) => setF({ ...f, purchase_price: Number(e.target.value) })} /></div>
            <div><Label>MRP ₹</Label><Input type="number" value={f.mrp} onChange={(e) => setF({ ...f, mrp: Number(e.target.value) })} /></div>
            <div><Label>Quantity</Label><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter><Button disabled={!f.batch_no || !f.expiry_date} onClick={() => { onSubmit({ medicine_id: medicineId, ...f }); setOpen(false); setF({ batch_no: "", expiry_date: "", purchase_price: 0, mrp: 0, quantity: 0 }); }}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkMedicineDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([
    { name: "", generic_name: "", manufacturer: "", unit: "pcs", gst_percent: "12", minimum_stock: "10", batch_no: "", expiry_date: "", mrp: "", quantity: "" },
    { name: "", generic_name: "", manufacturer: "", unit: "pcs", gst_percent: "12", minimum_stock: "10", batch_no: "", expiry_date: "", mrp: "", quantity: "" },
    { name: "", generic_name: "", manufacturer: "", unit: "pcs", gst_percent: "12", minimum_stock: "10", batch_no: "", expiry_date: "", mrp: "", quantity: "" },
  ]);

  const addRows = (count = 1) => {
    const newItems = Array.from({ length: count }, () => ({
      name: "", generic_name: "", manufacturer: "", unit: "pcs", gst_percent: "12", minimum_stock: "10", batch_no: "", expiry_date: "", mrp: "", quantity: ""
    }));
    setRows((prev) => [...prev, ...newItems]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: string, val: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const handleSave = async () => {
    const valid = rows.filter((r) => r.name.trim().length > 0);
    if (!valid.length) {
      toast.error("Please enter at least one medicine name.");
      return;
    }

    setSaving(true);
    try {
      // 1. Bulk insert medicines
      const medsToInsert = valid.map((r) => ({
        name: r.name.trim(),
        generic_name: r.generic_name.trim() || null,
        manufacturer: r.manufacturer.trim() || null,
        unit: r.unit || "pcs",
        gst_percent: Number(r.gst_percent) || 0,
        minimum_stock: Number(r.minimum_stock) || 10,
        active: true,
      }));

      const { data: createdMeds, error: medErr } = await supabase
        .from("medicines")
        .insert(medsToInsert)
        .select("id, name");
      if (medErr) throw medErr;

      // 2. Insert batches for rows that specified batch details
      const batchesToInsert: any[] = [];
      (createdMeds ?? []).forEach((m, idx) => {
        const row = valid[idx];
        if (row && (row.batch_no || Number(row.quantity) > 0)) {
          batchesToInsert.push({
            medicine_id: m.id,
            batch_no: row.batch_no.trim() || `BAT-${Date.now().toString().slice(-6)}`,
            expiry_date: row.expiry_date || addDays(new Date(), 365).toISOString().slice(0, 10),
            mrp: Number(row.mrp) || 0,
            purchase_price: Math.round((Number(row.mrp) || 0) * 0.7),
            quantity: Number(row.quantity) || 0,
          });
        }
      });

      if (batchesToInsert.length > 0) {
        const { error: batchErr } = await supabase.from("medicine_batches").insert(batchesToInsert);
        if (batchErr) throw batchErr;
      }

      toast.success(`Successfully added ${valid.length} medicines!`);
      setOpen(false);
      setRows([
        { name: "", generic_name: "", manufacturer: "", unit: "pcs", gst_percent: "12", minimum_stock: "10", batch_no: "", expiry_date: "", mrp: "", quantity: "" },
        { name: "", generic_name: "", manufacturer: "", unit: "pcs", gst_percent: "12", minimum_stock: "10", batch_no: "", expiry_date: "", mrp: "", quantity: "" },
        { name: "", generic_name: "", manufacturer: "", unit: "pcs", gst_percent: "12", minimum_stock: "10", batch_no: "", expiry_date: "", mrp: "", quantity: "" },
      ]);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to add medicines in bulk");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Layers className="size-4 mr-1.5" />Bulk Add Medicines
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Bulk Add Medicines & Initial Stock
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Enter multiple medicines row-by-row. Batch number and stock quantity are optional.
          </p>
        </DialogHeader>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-y">
              <tr>
                <th className="py-2 px-1 text-left min-w-[150px]">Medicine Name *</th>
                <th className="py-2 px-1 text-left min-w-[120px]">Generic Name</th>
                <th className="py-2 px-1 text-left min-w-[100px]">Manufacturer</th>
                <th className="py-2 px-1 text-left w-20">Unit</th>
                <th className="py-2 px-1 text-left w-16">GST%</th>
                <th className="py-2 px-1 text-left w-20">Min Stk</th>
                <th className="py-2 px-1 text-left min-w-[90px]">Batch No</th>
                <th className="py-2 px-1 text-left min-w-[110px]">Expiry</th>
                <th className="py-2 px-1 text-left w-20">MRP (₹)</th>
                <th className="py-2 px-1 text-left w-20">Qty</th>
                <th className="py-2 px-1 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="p-1">
                    <Input
                      placeholder="e.g. Paracetamol"
                      value={r.name}
                      onChange={(e) => updateRow(i, "name", e.target.value)}
                      className="h-8 text-xs font-medium"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      placeholder="Generic"
                      value={r.generic_name}
                      onChange={(e) => updateRow(i, "generic_name", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      placeholder="Brand"
                      value={r.manufacturer}
                      onChange={(e) => updateRow(i, "manufacturer", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      placeholder="pcs"
                      value={r.unit}
                      onChange={(e) => updateRow(i, "unit", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={r.gst_percent}
                      onChange={(e) => updateRow(i, "gst_percent", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={r.minimum_stock}
                      onChange={(e) => updateRow(i, "minimum_stock", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      placeholder="Optional"
                      value={r.batch_no}
                      onChange={(e) => updateRow(i, "batch_no", e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="date"
                      value={r.expiry_date}
                      onChange={(e) => updateRow(i, "expiry_date", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      placeholder="0"
                      value={r.mrp}
                      onChange={(e) => updateRow(i, "mrp", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      placeholder="0"
                      value={r.quantity}
                      onChange={(e) => updateRow(i, "quantity", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                  <td className="p-1 text-center">
                    {rows.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(i)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addRows(1)}>
              <Plus className="size-3.5 mr-1" />Add Row
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addRows(5)}>
              + 5 Rows
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {rows.filter((r) => r.name.trim().length > 0).length} valid medicine(s) ready to insert
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving Medicines..." : "Save All Medicines"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

