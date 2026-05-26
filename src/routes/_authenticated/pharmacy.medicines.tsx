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
import { ArrowLeft, Plus, Package, ChevronDown, ChevronRight } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/pharmacy/medicines")({ component: MedicinesPage });

function MedicinesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/pharmacy"><ArrowLeft className="size-4" /></Link></Button>
          <div><h1 className="text-2xl font-semibold tracking-tight">Medicines</h1><p className="text-sm text-muted-foreground">{meds.length} items</p></div>
        </div>
        <NewMedicineDialog onSubmit={(v) => createMed.mutate(v)} />
      </div>

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
