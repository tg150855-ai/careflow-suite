import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Receipt, Plus, Trash2, Save, Printer, Pill, Search, IndianRupee,
  CheckCircle2, Clock, FileText,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/opd/billing")({ component: BillingPage });

type LineItem = {
  id?: string;
  category: string;
  description: string;
  quantity: number;
  unit_price: number;
};
const DEFAULT_FEE = 500;
const CATEGORIES = ["Consultation", "Pharmacy", "Procedure", "Lab", "Other"];
const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer", "insurance", "credit"] as const;

function startOfDayIso() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }

function BillingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [draftVisit, setDraftVisit] = useState<any | null>(null); // unbilled visit selected for new bill

  const { data: bills = [] } = useQuery({
    queryKey: ["opd-bills"],
    queryFn: async () => {
      const { data } = await supabase.from("bills")
        .select("id, bill_no, total, paid, pending, status, created_at, patient_id, opd_visit_id, patients(full_name, uhid), doctors(name)")
        .gte("created_at", startOfDayIso())
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 20000,
  });

  const { data: unbilled = [] } = useQuery({
    queryKey: ["opd-unbilled-visits"],
    queryFn: async () => {
      const { data: visits } = await supabase.from("opd_visits")
        .select("id, created_at, patient_id, doctor_id, diagnosis, patients(full_name, uhid), doctors(name)")
        .gte("created_at", startOfDayIso())
        .order("created_at", { ascending: false })
        .limit(50);
      if (!visits?.length) return [];
      const { data: existing } = await supabase.from("bills")
        .select("opd_visit_id")
        .in("opd_visit_id", visits.map((v) => v.id));
      const billed = new Set((existing ?? []).map((b: any) => b.opd_visit_id));
      return visits.filter((v) => !billed.has(v.id));
    },
    refetchInterval: 20000,
  });

  const filteredBills = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return bills;
    return bills.filter((b: any) =>
      b.bill_no?.toLowerCase().includes(s) ||
      b.patients?.full_name?.toLowerCase().includes(s) ||
      b.patients?.uhid?.toLowerCase().includes(s));
  }, [bills, search]);

  const filteredUnbilled = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return unbilled;
    return unbilled.filter((v: any) =>
      v.patients?.full_name?.toLowerCase().includes(s) ||
      v.patients?.uhid?.toLowerCase().includes(s));
  }, [unbilled, search]);

  const closeEditor = () => { setSelectedBillId(null); setDraftVisit(null); };
  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ["opd-bills"] });
    qc.invalidateQueries({ queryKey: ["opd-unbilled-visits"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center"><Receipt className="size-4 text-primary" /></div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">OPD billing</h1>
            <p className="text-xs text-muted-foreground">Generate invoices · record payments</p>
          </div>
        </div>
        <div className="ml-auto relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice / patient" className="h-9 pl-8 w-[240px]" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left: unbilled + bills */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Awaiting billing</h2>
              <Badge variant="secondary" className="rounded-full">{filteredUnbilled.length}</Badge>
            </div>
            {filteredUnbilled.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">All visits billed.</p>
            ) : (
              <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1">
                {filteredUnbilled.map((v: any) => (
                  <button key={v.id} onClick={() => { setSelectedBillId(null); setDraftVisit(v); }}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition ${draftVisit?.id === v.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{v.patients?.full_name}</span>
                      <Clock className="size-3.5 text-amber-600 shrink-0" />
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{v.patients?.uhid}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{v.doctors?.name} · {format(new Date(v.created_at), "HH:mm")}</div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Today's invoices</h2>
              <Badge variant="secondary" className="rounded-full">{filteredBills.length}</Badge>
            </div>
            {filteredBills.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No invoices yet today.</p>
            ) : (
              <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                {filteredBills.map((b: any) => (
                  <button key={b.id} onClick={() => { setDraftVisit(null); setSelectedBillId(b.id); }}
                    className={`w-full text-left rounded-lg border px-3 py-2 transition ${selectedBillId === b.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">{b.bill_no}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="font-medium text-sm truncate mt-0.5">{b.patients?.full_name}</div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground font-mono">{b.patients?.uhid}</span>
                      <span className="text-xs font-semibold">₹{Number(b.total).toFixed(0)}</span>
                    </div>
                    {Number(b.pending) > 0 && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">Pending ₹{Number(b.pending).toFixed(0)}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Editor */}
        <div className="xl:col-span-8">
          {selectedBillId ? (
            <BillEditor key={selectedBillId} billId={selectedBillId} userId={user?.id} onSaved={onSaved} onClose={closeEditor} />
          ) : draftVisit ? (
            <BillEditor key={`draft-${draftVisit.id}`} visit={draftVisit} userId={user?.id} onSaved={(id) => { onSaved(); setDraftVisit(null); setSelectedBillId(id); }} onClose={closeEditor} />
          ) : (
            <EmptyEditor />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyEditor() {
  return (
    <Card className="p-12 text-center">
      <div className="size-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
        <Receipt className="size-5 text-muted-foreground" />
      </div>
      <h2 className="text-base font-semibold">Pick a visit or invoice</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Select an unbilled visit on the left to generate a fresh invoice, or open an existing invoice to record payments.
      </p>
    </Card>
  );
}

function BillEditor({ billId, visit, userId, onSaved, onClose }: { billId?: string; visit?: any; userId?: string; onSaved: (id: string) => void; onClose: () => void }) {
  const [bill, setBill] = useState<any | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [gstPct, setGstPct] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [patient, setPatient] = useState<any | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [opdVisitId, setOpdVisitId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing or seed from visit
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (billId) {
          const { data: b } = await supabase.from("bills")
            .select("*, patients(*), doctors(name)")
            .eq("id", billId).single();
          const { data: bi } = await supabase.from("bill_items")
            .select("id, category, description, quantity, unit_price")
            .eq("bill_id", billId).order("position");
          setBill(b);
          setPatient(b?.patients);
          setDoctorId(b?.doctor_id);
          setOpdVisitId(b?.opd_visit_id);
          setDiscount(Number(b?.discount ?? 0));
          const sub = (bi ?? []).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
          setGstPct(sub > 0 ? Math.round((Number(b?.gst ?? 0) / sub) * 100) : 0);
          setNotes(b?.notes ?? "");
          setItems((bi ?? []).map((i: any) => ({
            id: i.id, category: i.category, description: i.description,
            quantity: Number(i.quantity), unit_price: Number(i.unit_price),
          })));
        } else if (visit) {
          const { data: p } = await supabase.from("patients").select("*").eq("id", visit.patient_id).single();
          setPatient(p);
          setDoctorId(visit.doctor_id);
          setOpdVisitId(visit.id);
          setItems([{ category: "Consultation", description: `Consultation - ${visit.doctors?.name ?? "Doctor"}`, quantity: 1, unit_price: DEFAULT_FEE }]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [billId, visit?.id]); // eslint-disable-line

  const subtotal = useMemo(() => items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0), [items]);
  const gstAmt = useMemo(() => Math.max(0, (subtotal - discount) * (gstPct / 100)), [subtotal, discount, gstPct]);
  const total = useMemo(() => Math.max(0, subtotal - discount + gstAmt), [subtotal, discount, gstAmt]);

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((arr) => arr.map((it, x) => x === i ? { ...it, ...patch } : it));
  }
  function addItem(cat = "Other") { setItems([...items, { category: cat, description: "", quantity: 1, unit_price: 0 }]); }

  async function pullPrescription() {
    if (!opdVisitId) { toast.error("No visit linked"); return; }
    const { data: rx } = await supabase.from("prescriptions").select("id").eq("opd_visit_id", opdVisitId).maybeSingle();
    if (!rx) { toast.info("No prescription found"); return; }
    const { data: rxItems } = await supabase.from("prescription_items")
      .select("medicine_name, dosage, duration_days").eq("prescription_id", rx.id).order("position");
    if (!rxItems?.length) { toast.info("Prescription has no items"); return; }
    const added: LineItem[] = rxItems.map((it: any) => ({
      category: "Pharmacy",
      description: `${it.medicine_name}${it.dosage ? ` (${it.dosage})` : ""}${it.duration_days ? ` × ${it.duration_days}d` : ""}`,
      quantity: it.duration_days ?? 1,
      unit_price: 0,
    }));
    setItems((arr) => [...arr, ...added]);
    toast.success(`Added ${added.length} medicines`);
  }

  async function save() {
    if (!patient) return;
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      let id = billId;
      const payload = {
        patient_id: patient.id,
        doctor_id: doctorId,
        opd_visit_id: opdVisitId,
        subtotal,
        discount,
        gst: gstAmt,
        total,
        pending: total - Number(bill?.paid ?? 0),
        status: (Number(bill?.paid ?? 0) >= total ? "paid" : (Number(bill?.paid ?? 0) > 0 ? "partial" : "draft")) as "draft" | "partial" | "paid",
        notes: notes || null,
      };
      if (id) {
        const { error } = await supabase.from("bills").update(payload).eq("id", id);
        if (error) throw error;
        await supabase.from("bill_items").delete().eq("bill_id", id);
      } else {
        const { data, error } = await supabase.from("bills").insert({ ...payload, created_by: userId, paid: 0 }).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      const { error: e2 } = await supabase.from("bill_items").insert(items.map((it, idx) => ({
        bill_id: id!,
        category: it.category,
        description: it.description || it.category,
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: Number(it.quantity) * Number(it.unit_price),
        position: idx,
      })));
      if (e2) throw e2;
      toast.success(billId ? "Invoice updated" : "Invoice created");
      onSaved(id!);
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="p-8 text-sm text-muted-foreground">Loading…</Card>;
  if (!patient) return <Card className="p-8 text-sm text-muted-foreground">No patient found.</Card>;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-start gap-3 pb-3 border-b">
          <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
            {patient.full_name?.split(" ").map((n: string) => n[0]).slice(0,2).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold truncate">{patient.full_name}</h2>
              <span className="text-xs text-muted-foreground font-mono">{patient.uhid}</span>
              {bill?.bill_no && <Badge variant="outline" className="font-mono text-[10px]">{bill.bill_no}</Badge>}
              {bill?.status && <StatusBadge status={bill.status} />}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {bill?.doctors?.name ?? visit?.doctors?.name ?? "—"} · {bill?.created_at ? format(new Date(bill.created_at), "dd MMM HH:mm") : "New invoice"}
            </div>
          </div>
          <div className="flex gap-2">
            {opdVisitId && (
              <Button variant="outline" size="sm" onClick={pullPrescription}>
                <Pill className="size-3.5 mr-1.5" />Add Rx items
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>

        {/* Line items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Items</Label>
            <Button size="sm" variant="ghost" onClick={() => addItem()}><Plus className="size-3.5 mr-1" />Add item</Button>
          </div>
          <div className="grid grid-cols-12 gap-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <div className="col-span-3">Category</div>
            <div className="col-span-5">Description</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-1"></div>
          </div>
          {items.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center border rounded-lg">No items yet.</div>
          ) : items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Select value={it.category} onValueChange={(v) => updateItem(i, { category: v })}>
                <SelectTrigger className="h-9 text-sm col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Description" className="h-9 text-sm col-span-5" />
              <Input type="number" value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} className="h-9 text-sm text-right col-span-1" />
              <Input type="number" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })} className="h-9 text-sm text-right col-span-2" />
              <Button variant="ghost" size="icon" className="size-9 col-span-1 justify-self-end" onClick={() => setItems(items.filter((_, x) => x !== i))}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {/* Totals & notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="resize-none text-sm" placeholder="Internal note for this invoice" />
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Subtotal" value={subtotal} />
            <div className="flex items-center justify-between gap-2">
              <Label className="text-muted-foreground">Discount (₹)</Label>
              <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="h-8 w-28 text-right text-sm" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-muted-foreground">GST (%)</Label>
              <Input type="number" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))} className="h-8 w-28 text-right text-sm" />
            </div>
            <Row label="GST amount" value={gstAmt} muted />
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-semibold tabular-nums">₹{total.toFixed(2)}</span>
            </div>
            {bill && (
              <>
                <Row label="Paid" value={Number(bill.paid ?? 0)} muted />
                <Row label="Pending" value={Math.max(0, total - Number(bill.paid ?? 0))} highlight />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t">
          {billId && (
            <Button variant="outline" onClick={() => window.open(`/prescriptions/${billId}/print`, "_blank")}>
              <Printer className="size-4 mr-2" />Print
            </Button>
          )}
          <Button onClick={save} disabled={saving}>
            <Save className="size-4 mr-2" />{billId ? "Update invoice" : "Create invoice"}
          </Button>
        </div>
      </Card>

      {billId && bill && <PaymentsPanel bill={bill} total={total} userId={userId} onChanged={() => onSaved(billId)} />}
    </div>
  );
}

function PaymentsPanel({ bill, total, userId, onChanged }: { bill: any; total: number; userId?: string; onChanged: () => void }) {
  const { data: payments = [], refetch } = useQuery({
    queryKey: ["bill-payments", bill.id],
    queryFn: async () => (await supabase.from("payments").select("*").eq("bill_id", bill.id).order("paid_at", { ascending: false })).data ?? [],
  });
  const paid = useMemo(() => payments.reduce((s: number, p: any) => s + Number(p.amount), 0), [payments]);
  const pending = Math.max(0, total - paid);

  const [amount, setAmount] = useState<number>(pending);
  const [method, setMethod] = useState<typeof PAYMENT_METHODS[number]>("cash");
  const [reference, setReference] = useState("");
  const [recording, setRecording] = useState(false);

  useEffect(() => { setAmount(pending); }, [pending]);

  async function record() {
    if (amount <= 0) { toast.error("Enter an amount"); return; }
    setRecording(true);
    try {
      const { error } = await supabase.from("payments").insert({
        bill_id: bill.id, amount, method, reference: reference || null, created_by: userId,
      });
      if (error) throw error;
      const newPaid = paid + amount;
      const newPending = Math.max(0, total - newPaid);
      const newStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "draft";
      await supabase.from("bills").update({ paid: newPaid, pending: newPending, status: newStatus }).eq("id", bill.id);
      toast.success("Payment recorded");
      setReference("");
      refetch();
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? "Could not record payment");
    } finally {
      setRecording(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <IndianRupee className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Payments</h2>
        <Badge variant="outline" className="ml-auto">Pending ₹{pending.toFixed(2)}</Badge>
      </div>

      {pending > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <div className="md:col-span-3 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="h-9 text-sm" />
          </div>
          <div className="md:col-span-3 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4 space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Reference (txn id / cheque)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-9 text-sm" />
          </div>
          <Button onClick={record} disabled={recording} className="md:col-span-2">
            <CheckCircle2 className="size-4 mr-2" />Record
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 py-2">
          <CheckCircle2 className="size-4" />Fully paid.
        </div>
      )}

      <div className="border-t pt-3">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 block">History</Label>
        {payments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="space-y-1">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span className="capitalize">{p.method.replace("_", " ")}</span>
                  {p.reference && <span className="text-xs text-muted-foreground font-mono">· {p.reference}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{format(new Date(p.paid_at), "dd MMM HH:mm")}</span>
                  <span className="font-semibold tabular-nums">₹{Number(p.amount).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value, muted, highlight }: { label: string; value: number; muted?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""} ${highlight ? "text-amber-700 dark:text-amber-400 font-medium" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">₹{value.toFixed(2)}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-foreground",
    partial: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };
  return <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-muted"}`}>{status}</span>;
}
