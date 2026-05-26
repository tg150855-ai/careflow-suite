import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Search, User } from "lucide-react";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/billing/new")({ component: NewBill });

type Item = { id: string; category: string; description: string; quantity: number; unit_price: number };
const CATEGORIES = ["Consultation", "Procedure", "Pharmacy", "Lab", "Room", "Other"];
const METHODS = ["cash", "upi", "card", "bank_transfer", "insurance", "credit"] as const;

function NewBill() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patientQ, setPatientQ] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patient, setPatient] = useState<any | null>(null);
  const [items, setItems] = useState<Item[]>([{ id: crypto.randomUUID(), category: "Consultation", description: "Doctor consultation", quantity: 1, unit_price: 500 }]);
  const [discount, setDiscount] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [method, setMethod] = useState<typeof METHODS[number]>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const { data: patients = [] } = useQuery({
    queryKey: ["patient-search", patientQ],
    enabled: patientQ.length >= 2 && !patientId,
    queryFn: async () => {
      const term = `%${patientQ}%`;
      const { data } = await supabase.from("patients").select("id, full_name, uhid, mobile, gender, dob").or(`full_name.ilike.${term},mobile.ilike.${term},uhid.ilike.${term}`).limit(8);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!patientId) { setPatient(null); return; }
    supabase.from("patients").select("*").eq("id", patientId).single().then(({ data }) => setPatient(data));
  }, [patientId]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
    const afterDisc = Math.max(0, subtotal - Number(discount));
    const gst = (afterDisc * Number(gstPercent)) / 100;
    const total = afterDisc + gst;
    const pending = Math.max(0, total - Number(paidAmount));
    return { subtotal, gst, total, pending };
  }, [items, discount, gstPercent, paidAmount]);

  const save = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error("Select a patient");
      if (items.length === 0) throw new Error("Add at least one item");
      const status = totals.pending === 0 ? "paid" : Number(paidAmount) > 0 ? "partial" : "draft";
      const { data: bill, error } = await supabase.from("bills").insert({
        patient_id: patientId,
        subtotal: totals.subtotal, discount, gst: totals.gst, total: totals.total,
        paid: paidAmount, pending: totals.pending, status, notes, created_by: user?.id ?? null,
      }).select("id, bill_no").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("bill_items").insert(items.map((it, idx) => ({
        bill_id: bill.id, category: it.category, description: it.description,
        quantity: it.quantity, unit_price: it.unit_price, amount: it.quantity * it.unit_price, position: idx,
      })));
      if (e2) throw e2;
      if (Number(paidAmount) > 0) {
        const { error: e3 } = await supabase.from("payments").insert({
          bill_id: bill.id, amount: paidAmount, method, reference: reference || null, created_by: user?.id ?? null,
        });
        if (e3) throw e3;
      }
      return bill;
    },
    onSuccess: (b) => { toast.success(`Bill ${b.bill_no} created`); navigate({ to: "/billing/$id", params: { id: b.id } }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function updateItem(id: string, patch: Partial<Item>) {
    setItems((arr) => arr.map((i) => i.id === id ? { ...i, ...patch } : i));
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/billing"><ArrowLeft className="size-4" /></Link></Button>
        <div><h1 className="text-2xl font-semibold tracking-tight">New bill</h1><p className="text-sm text-muted-foreground">Create invoice with charges and payment</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Patient</h2>
            {!patient ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input autoFocus value={patientQ} onChange={(e) => setPatientQ(e.target.value)} placeholder="Search by name, mobile or UHID..." className="pl-9" />
                </div>
                {patientQ.length >= 2 && (
                  <div className="border rounded-xl divide-y max-h-64 overflow-y-auto">
                    {patients.length === 0 && <div className="p-4 text-sm text-muted-foreground">No patients found.</div>}
                    {patients.map((p: any) => (
                      <button key={p.id} onClick={() => { setPatientId(p.id); setPatientQ(""); }} className="w-full text-left p-3 hover:bg-surface-muted flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">{p.full_name.slice(0,2).toUpperCase()}</div>
                        <div className="min-w-0 flex-1"><div className="text-sm font-medium truncate">{p.full_name}</div><div className="text-xs text-muted-foreground">{p.uhid} · {p.mobile}</div></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-muted">
                <div className="flex items-center gap-3"><div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><User className="size-4" /></div>
                  <div><div className="font-medium">{patient.full_name}</div><div className="text-xs text-muted-foreground">{patient.uhid} · {patient.mobile} · {patient.gender}</div></div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setPatientId(null); setPatient(null); }}>Change</Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Charges</h2>
              <Button variant="outline" size="sm" onClick={() => setItems([...items, { id: crypto.randomUUID(), category: "Other", description: "", quantity: 1, unit_price: 0 }])}><Plus className="size-3.5 mr-1" />Add item</Button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-2"><div className="col-span-3">Category</div><div className="col-span-4">Description</div><div className="col-span-1 text-right">Qty</div><div className="col-span-2 text-right">Rate</div><div className="col-span-1 text-right">Amount</div><div className="col-span-1" /></div>
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                  <Select value={it.category} onValueChange={(v) => updateItem(it.id, { category: v })}>
                    <SelectTrigger className="col-span-3 h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="col-span-4 h-10" value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Description" />
                  <Input className="col-span-1 h-10 text-right tabular-nums" type="number" min={0} step="0.01" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })} />
                  <Input className="col-span-2 h-10 text-right tabular-nums" type="number" min={0} step="0.01" value={it.unit_price} onChange={(e) => updateItem(it.id, { unit_price: Number(e.target.value) })} />
                  <div className="col-span-1 text-right tabular-nums text-sm">{inr(it.quantity * it.unit_price)}</div>
                  <Button variant="ghost" size="icon" className="col-span-1 text-muted-foreground hover:text-destructive" onClick={() => setItems(items.filter(i => i.id !== it.id))}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6"><Label htmlFor="notes" className="mb-2 block">Notes</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional billing notes..." rows={3} /></Card>
        </div>

        <Card className="p-6 h-fit lg:sticky lg:top-20 space-y-4">
          <h2 className="font-semibold">Summary</h2>
          <Row label="Subtotal" value={inr(totals.subtotal)} />
          <div className="space-y-1"><Label className="text-xs">Discount (₹)</Label><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
          <div className="space-y-1"><Label className="text-xs">GST %</Label><Input type="number" min={0} max={28} value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value))} /></div>
          <Row label="GST" value={inr(totals.gst)} />
          <div className="border-t pt-3"><Row label="Total" value={inr(totals.total)} bold /></div>
          <div className="border-t pt-3 space-y-3">
            <div className="space-y-1"><Label className="text-xs">Paid amount</Label><Input type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label className="text-xs">Payment method</Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {method !== "cash" && <div className="space-y-1"><Label className="text-xs">Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn ID / cheque no." /></div>}
            <Row label="Pending" value={inr(totals.pending)} tone={totals.pending > 0 ? "warning" : "success"} />
          </div>
          <Button className="w-full" size="lg" disabled={save.isPending || !patientId || items.length === 0} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save bill"}</Button>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "warning" | "success" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${bold ? "text-lg font-semibold" : ""} ${tone === "warning" ? "text-warning-foreground" : tone === "success" ? "text-success" : ""}`}>{value}</span>
    </div>
  );
}
