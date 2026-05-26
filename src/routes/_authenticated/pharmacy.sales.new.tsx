import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Search, Trash2 } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/pharmacy/sales/new")({ component: NewSale });

type Line = { id: string; medicine_id: string; batch_id: string; medicine_name: string; quantity: number; unit_price: number; gst_percent: number; max: number };
const METHODS = ["cash", "upi", "card", "bank_transfer", "insurance"] as const;

function NewSale() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientQ, setPatientQ] = useState("");
  const [patient, setPatient] = useState<any | null>(null);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<typeof METHODS[number]>("cash");

  const { data: medResults = [] } = useQuery({
    queryKey: ["med-search", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from("medicines")
        .select("id, name, generic_name, gst_percent, medicine_batches(id, batch_no, expiry_date, mrp, quantity)")
        .or(`name.ilike.%${search}%,generic_name.ilike.%${search}%`).limit(8);
      return data ?? [];
    },
  });

  const { data: patientResults = [] } = useQuery({
    queryKey: ["pat-search", patientQ],
    enabled: patientQ.length >= 2 && !patientId,
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id, full_name, uhid, mobile").or(`full_name.ilike.%${patientQ}%,mobile.ilike.%${patientQ}%,uhid.ilike.%${patientQ}%`).limit(6);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!patientId) { setPatient(null); return; }
    supabase.from("patients").select("id, full_name, uhid, mobile").eq("id", patientId).single().then(({ data }) => setPatient(data));
  }, [patientId]);

  function addMed(m: any) {
    const fresh = (m.medicine_batches ?? []).filter((b: any) => b.quantity > 0).sort((a: any, b: any) => a.expiry_date.localeCompare(b.expiry_date))[0];
    if (!fresh) { toast.error("No stock available"); return; }
    setLines((arr) => [...arr, { id: crypto.randomUUID(), medicine_id: m.id, batch_id: fresh.id, medicine_name: m.name, quantity: 1, unit_price: Number(fresh.mrp), gst_percent: Number(m.gst_percent), max: fresh.quantity }]);
    setSearch("");
  }

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const afterDisc = Math.max(0, subtotal - discount);
    const gst = lines.reduce((s, l) => s + (l.quantity * l.unit_price * l.gst_percent) / 100, 0);
    const total = afterDisc + gst;
    return { subtotal, gst, total };
  }, [lines, discount]);

  const save = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) throw new Error("Add at least one medicine");
      for (const l of lines) if (l.quantity > l.max) throw new Error(`${l.medicine_name}: only ${l.max} in stock`);
      const { data: sale, error } = await supabase.from("pharmacy_sales").insert({
        patient_id: patientId, subtotal: totals.subtotal, gst: totals.gst, discount, total: totals.total,
        payment_method: method, created_by: user?.id ?? null,
      }).select("id, invoice_no").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("pharmacy_sale_items").insert(lines.map((l) => ({
        sale_id: sale.id, medicine_id: l.medicine_id, batch_id: l.batch_id, medicine_name: l.medicine_name,
        quantity: l.quantity, unit_price: l.unit_price, gst_percent: l.gst_percent,
        amount: l.quantity * l.unit_price * (1 + l.gst_percent / 100),
      })));
      if (e2) throw e2;
      // Deduct stock from batches
      for (const l of lines) {
        const newQty = l.max - l.quantity;
        await supabase.from("medicine_batches").update({ quantity: newQty }).eq("id", l.batch_id);
      }
      return sale;
    },
    onSuccess: (s) => { toast.success(`Sale ${s.invoice_no} saved`); navigate({ to: "/pharmacy" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/pharmacy"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-2xl font-semibold tracking-tight">New pharmacy sale</h1><p className="text-sm text-muted-foreground">Counter sale with stock deduction</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-6">
            <h2 className="font-semibold mb-3">Patient (optional)</h2>
            {!patient ? (
              <div className="space-y-3">
                <Input value={patientQ} onChange={(e) => setPatientQ(e.target.value)} placeholder="Search patient or leave blank for walk-in..." />
                {patientResults.length > 0 && (
                  <div className="border rounded-xl divide-y">
                    {patientResults.map((p: any) => (
                      <button key={p.id} onClick={() => { setPatientId(p.id); setPatientQ(""); }} className="w-full text-left p-2.5 hover:bg-surface-muted text-sm flex items-center justify-between"><span>{p.full_name}</span><span className="text-xs text-muted-foreground">{p.uhid} · {p.mobile}</span></button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted">
                <div><div className="font-medium">{patient.full_name}</div><div className="text-xs text-muted-foreground">{patient.uhid} · {patient.mobile}</div></div>
                <Button variant="ghost" size="sm" onClick={() => { setPatientId(null); }}>Walk-in</Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-3">Add medicines</h2>
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicine by name or generic..." className="pl-9 h-11" />
            </div>
            {search.length >= 2 && medResults.length > 0 && (
              <div className="mt-2 border rounded-xl divide-y max-h-64 overflow-y-auto">
                {medResults.map((m: any) => {
                  const stock = (m.medicine_batches ?? []).reduce((s: number, b: any) => s + b.quantity, 0);
                  return (
                    <button key={m.id} onClick={() => addMed(m)} disabled={stock === 0} className="w-full text-left p-3 hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between">
                      <div><div className="text-sm font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{m.generic_name}</div></div>
                      <div className="text-xs text-muted-foreground">Stock: {stock}</div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 space-y-2">
              {lines.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">No items added.</div>}
              {lines.length > 0 && (
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-2"><div className="col-span-5">Medicine</div><div className="col-span-2 text-right">Qty</div><div className="col-span-2 text-right">Rate</div><div className="col-span-2 text-right">Amount</div><div className="col-span-1" /></div>
              )}
              {lines.map((l) => (
                <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5"><div className="text-sm font-medium truncate">{l.medicine_name}</div><div className="text-[11px] text-muted-foreground">Max: {l.max} · GST {l.gst_percent}%</div></div>
                  <Input className="col-span-2 h-10 text-right tabular-nums" type="number" min={1} max={l.max} value={l.quantity} onChange={(e) => setLines(lines.map(x => x.id === l.id ? { ...x, quantity: Number(e.target.value) } : x))} />
                  <Input className="col-span-2 h-10 text-right tabular-nums" type="number" min={0} value={l.unit_price} onChange={(e) => setLines(lines.map(x => x.id === l.id ? { ...x, unit_price: Number(e.target.value) } : x))} />
                  <div className="col-span-2 text-right tabular-nums text-sm">{inr(l.quantity * l.unit_price * (1 + l.gst_percent / 100))}</div>
                  <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground hover:text-destructive" onClick={() => setLines(lines.filter(x => x.id !== l.id))}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-6 h-fit lg:sticky lg:top-20 space-y-4">
          <h2 className="font-semibold">Summary</h2>
          <Row label="Subtotal" value={inr(totals.subtotal)} />
          <div className="space-y-1"><Label className="text-xs">Discount (₹)</Label><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
          <Row label="GST" value={inr(totals.gst)} />
          <div className="border-t pt-3"><Row label="Total" value={inr(totals.total)} bold /></div>
          <div className="space-y-1"><Label className="text-xs">Payment method</Label>
            <Select value={method} onValueChange={(v: any) => setMethod(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_"," ")}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button className="w-full" size="lg" disabled={save.isPending || lines.length === 0} onClick={() => save.mutate()}><Plus className="size-4 mr-2" />{save.isPending ? "Saving…" : "Complete sale"}</Button>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className={`tabular-nums ${bold ? "text-lg font-semibold" : ""}`}>{value}</span></div>;
}
