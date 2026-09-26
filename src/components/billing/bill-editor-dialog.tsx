import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Plus,
  Trash2,
  Save,
  Printer,
  Pill,
  Share2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { inr } from "@/lib/format";
import { shareOnWhatsApp } from "@/lib/share";
import { SecureDeleteDialog } from "@/components/common/secure-delete-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";

export type BillLineItem = {
  id?: string;
  category: string;
  description: string;
  quantity: number;
  unit_price: number;
};

const CATEGORIES = [
  "Consultation",
  "Bed Charges",
  "Nursing",
  "Pharmacy",
  "Procedure",
  "Surgery / OT",
  "Lab",
  "Radiology",
  "Other",
];

const PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "insurance",
  "credit",
] as const;

export interface BillEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId?: string | null;
  /** Optional pre-filled visit to seed new OPD invoice */
  visit?: any;
  /** Optional pre-filled admission to seed new IPD invoice */
  admission?: any;
  patientId?: string | null;
  onSaved?: (billId: string) => void;
}

/**
 * Universal Bill Editor for OPD, IPD, and OT.
 * Provides line item editing, tax/discount calculation,
 * payment history viewing, WhatsApp sharing, printing, and secure deletion.
 */
export function BillEditorDialog({
  open,
  onOpenChange,
  billId,
  visit,
  admission,
  patientId,
  onSaved,
}: BillEditorDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [bill, setBill] = useState<any | null>(null);
  const [items, setItems] = useState<BillLineItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [gstPct, setGstPct] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [patient, setPatient] = useState<any | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [opdVisitId, setOpdVisitId] = useState<string | null>(null);
  const [admissionId, setAdmissionId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  // Payment recording state inside editor
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] =
    useState<typeof PAYMENT_METHODS[number]>("cash");
  const [payRef, setPayRef] = useState("");
  const [recordingPay, setRecordingPay] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        if (billId) {
          const [billRes, itemsRes, paymentsRes] = await Promise.all([
            supabase
              .from("bills")
              .select("*, patients(*), doctors(name)")
              .eq("id", billId)
              .single(),
            supabase
              .from("bill_items")
              .select("id, category, description, quantity, unit_price")
              .eq("bill_id", billId)
              .order("position"),
            supabase
              .from("payments")
              .select("*")
              .eq("bill_id", billId)
              .order("paid_at", { ascending: false }),
          ]);

          if (!active) return;
          const b = billRes.data;
          setBill(b);
          setPatient(b?.patients);
          setDoctorId(b?.doctor_id ?? null);
          setOpdVisitId(b?.opd_visit_id ?? null);
          setAdmissionId(b?.admission_id ?? null);
          setDiscount(Number(b?.discount ?? 0));
          setNotes(b?.notes ?? "");
          setPayments(paymentsRes.data ?? []);

          const loadedItems = (itemsRes.data ?? []).map((i: any) => ({
            id: i.id,
            category: i.category,
            description: i.description,
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
          }));
          setItems(loadedItems);

          const sub = loadedItems.reduce(
            (s, it) => s + it.quantity * it.unit_price,
            0
          );
          setGstPct(
            sub > 0 ? Math.round((Number(b?.gst ?? 0) / sub) * 100) : 0
          );
        } else if (visit) {
          const { data: p } = await supabase
            .from("patients")
            .select("*")
            .eq("id", visit.patient_id)
            .single();
          if (!active) return;
          setPatient(p);
          setDoctorId(visit.doctor_id);
          setOpdVisitId(visit.id);
          setAdmissionId(null);
          setBill(null);
          setPayments([]);
          setItems([
            {
              category: "Consultation",
              description: `Consultation - ${visit.doctors?.name ?? "Doctor"}`,
              quantity: 1,
              unit_price:
                Number(visit.doctors?.consultation_fee ?? 0) || 500,
            },
          ]);
        } else if (admission) {
          const { data: p } = await supabase
            .from("patients")
            .select("*")
            .eq("id", admission.patient_id)
            .single();
          if (!active) return;
          setPatient(p);
          setDoctorId(admission.doctor_id);
          setAdmissionId(admission.id);
          setOpdVisitId(null);
          setBill(null);
          setPayments([]);
          setItems([
            {
              category: "Bed Charges",
              description: `Bed Charge - ${admission.wards?.name ?? "Ward"}`,
              quantity: 1,
              unit_price:
                Number(admission.beds?.charge_per_day ?? 0) || 1000,
            },
          ]);
        } else if (patientId) {
          const { data: p } = await supabase
            .from("patients")
            .select("*")
            .eq("id", patientId)
            .single();
          if (!active) return;
          setPatient(p);
          setBill(null);
          setPayments([]);
          setItems([
            {
              category: "Consultation",
              description: "Hospital Service",
              quantity: 1,
              unit_price: 500,
            },
          ]);
        }
      } catch (err: any) {
        toast.error(err.message ?? "Failed to load bill");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [open, billId, visit, admission, patientId]);

  // Derived financials
  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0),
        0
      ),
    [items]
  );
  const gstAmt = useMemo(
    () => Math.max(0, (subtotal - discount) * (gstPct / 100)),
    [subtotal, discount, gstPct]
  );
  const total = useMemo(
    () => Math.max(0, subtotal - discount + gstAmt),
    [subtotal, discount, gstAmt]
  );
  const totalPaid = useMemo(
    () => payments.reduce((s, p) => s + Number(p.amount || 0), 0),
    [payments]
  );
  const pending = Math.max(0, total - totalPaid);

  useEffect(() => {
    setPayAmount(pending);
  }, [pending]);

  function updateItem(i: number, patch: Partial<BillLineItem>) {
    setItems((arr) =>
      arr.map((it, x) => (x === i ? { ...it, ...patch } : it))
    );
  }

  function addItem(cat = "Other") {
    setItems([
      ...items,
      { category: cat, description: "", quantity: 1, unit_price: 0 },
    ]);
  }

  function removeItem(i: number) {
    setItems(items.filter((_, x) => x !== i));
  }

  async function handleSave() {
    if (!patient) return;
    if (items.length === 0) {
      toast.error("Please add at least one bill item");
      return;
    }
    // Financial safety check: preventing total less than already paid amount
    if (totalPaid > 0 && total < totalPaid) {
      toast.error(
        `Total cannot be less than already collected payments (${inr(totalPaid)}). Adjust payments first.`
      );
      return;
    }

    setSaving(true);
    try {
      let targetId = billId;
      const status: "draft" | "partial" | "paid" =
        totalPaid >= total ? "paid" : totalPaid > 0 ? "partial" : "draft";

      const payload = {
        patient_id: patient.id,
        doctor_id: doctorId,
        opd_visit_id: opdVisitId,
        admission_id: admissionId,
        subtotal,
        discount,
        gst: gstAmt,
        total,
        paid: totalPaid,
        pending: Math.max(0, total - totalPaid),
        status,
        notes: notes || null,
      };

      if (targetId) {
        const { error: bErr } = await supabase
          .from("bills")
          .update(payload)
          .eq("id", targetId);
        if (bErr) throw bErr;

        // Replace bill items safely
        await supabase.from("bill_items").delete().eq("bill_id", targetId);
      } else {
        const { data: newBill, error: bErr } = await supabase
          .from("bills")
          .insert({ ...payload, created_by: user?.id })
          .select("id")
          .single();
        if (bErr) throw bErr;
        targetId = newBill.id;
      }

      const itemRows = items.map((it, idx) => ({
        bill_id: targetId!,
        category: it.category,
        description: it.description || it.category,
        quantity: it.quantity,
        unit_price: it.unit_price,
        amount: Number(it.quantity) * Number(it.unit_price),
        position: idx,
      }));

      const { error: iErr } = await supabase
        .from("bill_items")
        .insert(itemRows);
      if (iErr) throw iErr;

      toast.success(billId ? "Bill updated successfully" : "Bill created successfully");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["opd-bills"] });
      qc.invalidateQueries({ queryKey: ["adm-bills"] });
      qc.invalidateQueries({ queryKey: ["billing-center"] });
      qc.invalidateQueries({ queryKey: ["bill", targetId] });

      onSaved?.(targetId!);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save bill");
    } finally {
      setSaving(false);
    }
  }

  // Safe delete with linked payments check
  async function handleDelete() {
    if (!billId) return;

    if (totalPaid > 0) {
      toast.error(
        `Financial Safety Warning: This bill has ${payments.length} recorded payment(s) totaling ${inr(totalPaid)}. To protect accounting integrity, please refund or clear payments before deleting this bill.`
      );
      return;
    }

    try {
      await supabase.from("bill_items").delete().eq("bill_id", billId);
      const { error } = await supabase.from("bills").delete().eq("id", billId);
      if (error) throw error;

      toast.success("Bill deleted safely");
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["opd-bills"] });
      qc.invalidateQueries({ queryKey: ["adm-bills"] });
      qc.invalidateQueries({ queryKey: ["billing-center"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Delete failed");
    }
  }

  async function handleRecordPayment() {
    if (!billId) {
      toast.error("Please save the bill first before recording payment");
      return;
    }
    if (payAmount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setRecordingPay(true);
    try {
      const { error: pErr } = await supabase.from("payments").insert({
        bill_id: billId,
        amount: payAmount,
        method: payMethod,
        reference: payRef || null,
        created_by: user?.id,
      });
      if (pErr) throw pErr;

      const newTotalPaid = totalPaid + payAmount;
      const newPending = Math.max(0, total - newTotalPaid);
      const newStatus =
        newTotalPaid >= total
          ? "paid"
          : newTotalPaid > 0
          ? "partial"
          : "draft";

      await supabase
        .from("bills")
        .update({
          paid: newTotalPaid,
          pending: newPending,
          status: newStatus,
        })
        .eq("id", billId);

      toast.success("Payment recorded");
      setPayRef("");

      // Refetch
      const { data: updatedPayments } = await supabase
        .from("payments")
        .select("*")
        .eq("bill_id", billId)
        .order("paid_at", { ascending: false });
      setPayments(updatedPayments ?? []);

      qc.invalidateQueries({ queryKey: ["bill", billId] });
      qc.invalidateQueries({ queryKey: ["bills"] });
    } catch (err: any) {
      toast.error(err.message ?? "Payment failed");
    } finally {
      setRecordingPay(false);
    }
  }

  function handleWhatsAppShare() {
    if (!patient) return;
    const billNumber = bill?.bill_no ?? "New Bill";
    const billUrl = billId
      ? `${window.location.origin}/billing/${billId}`
      : undefined;
    const msg = `*Hospital Bill — ${billNumber}*\nPatient: ${patient.full_name} (${patient.uhid})\nTotal Amount: ${inr(total)}\nPaid: ${inr(totalPaid)}\nPending Balance: ${inr(pending)}\n\nThank you for choosing our hospital.`;
    shareOnWhatsApp(msg, billUrl, patient.mobile ?? undefined);
  }

  function handlePrint() {
    if (billId) {
      window.open(`/billing/${billId}`, "_blank");
    } else {
      window.print();
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6">
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="size-5 text-primary" />
                {billId ? `Edit Bill ${bill?.bill_no ?? ""}` : "Create Bill"}
              </DialogTitle>
              {bill?.status && (
                <Badge
                  variant={bill.status === "paid" ? "secondary" : "outline"}
                  className="capitalize"
                >
                  {bill.status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin mx-auto mb-2" />
              Loading bill details…
            </div>
          ) : !patient ? (
            <div className="py-8 text-center text-muted-foreground">
              No patient record found.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Patient header */}
              <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-muted/40 gap-3">
                <div>
                  <div className="font-semibold">{patient.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    UHID: {patient.uhid} · Mobile: {patient.mobile || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleWhatsAppShare}
                    className="text-emerald-700 hover:text-emerald-800"
                  >
                    <Share2 className="size-3.5 mr-1.5" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePrint}>
                    <Printer className="size-3.5 mr-1.5" /> Print Bill
                  </Button>
                  {billId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-3.5 mr-1.5" /> Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Bill Line Items
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addItem()}
                    className="h-8 text-xs"
                  >
                    <Plus className="size-3.5 mr-1" /> Add Item
                  </Button>
                </div>

                <div className="border rounded-xl divide-y overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 p-2.5 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="col-span-3">Category</div>
                    <div className="col-span-4">Description</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Rate (₹)</div>
                    <div className="col-span-1"></div>
                  </div>

                  {items.map((it, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 p-2 items-center text-sm"
                    >
                      <div className="col-span-3">
                        <Select
                          value={it.category}
                          onValueChange={(val) =>
                            updateItem(i, { category: val })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c} className="text-xs">
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-4">
                        <Input
                          className="h-8 text-xs"
                          placeholder="Description"
                          value={it.description}
                          onChange={(e) =>
                            updateItem(i, { description: e.target.value })
                          }
                        />
                      </div>

                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={1}
                          className="h-8 text-xs text-right tabular-nums"
                          value={it.quantity}
                          onChange={(e) =>
                            updateItem(i, {
                              quantity: Math.max(
                                1,
                                Number(e.target.value) || 1
                              ),
                            })
                          }
                        />
                      </div>

                      <div className="col-span-2">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 text-xs text-right tabular-nums"
                          value={it.unit_price}
                          onChange={(e) =>
                            updateItem(i, {
                              unit_price: Math.max(
                                0,
                                Number(e.target.value) || 0
                              ),
                            })
                          }
                        />
                      </div>

                      <div className="col-span-1 flex justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(i)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Adjustments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Internal Notes / Remarks
                  </Label>
                  <Textarea
                    rows={3}
                    placeholder="Notes or clinical references for this invoice..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-xs resize-none"
                  />
                </div>

                <div className="p-3 rounded-xl bg-muted/30 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">
                      {inr(subtotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Discount (₹)</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-7 w-28 text-right text-xs"
                      value={discount}
                      onChange={(e) =>
                        setDiscount(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">GST (%)</span>
                    <Input
                      type="number"
                      min={0}
                      className="h-7 w-28 text-right text-xs"
                      value={gstPct}
                      onChange={(e) =>
                        setGstPct(Math.max(0, Number(e.target.value) || 0))
                      }
                    />
                  </div>

                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Amount</span>
                    <span className="text-base text-primary tabular-nums">
                      {inr(total)}
                    </span>
                  </div>

                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Paid to Date</span>
                    <span className="tabular-nums">{inr(totalPaid)}</span>
                  </div>

                  <div className="border-t pt-1 flex justify-between font-bold text-amber-700">
                    <span>Pending Balance</span>
                    <span className="tabular-nums">{inr(pending)}</span>
                  </div>
                </div>
              </div>

              {/* Payments Section if bill exists */}
              {billId && (
                <div className="pt-3 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Payments & Receipts
                    </Label>
                    <span className="text-xs text-muted-foreground font-mono">
                      {payments.length} payment(s)
                    </span>
                  </div>

                  {pending > 0 && (
                    <div className="p-3 border rounded-xl bg-card grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Amount
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={pending}
                          value={payAmount}
                          onChange={(e) => setPayAmount(Number(e.target.value))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Method
                        </Label>
                        <Select
                          value={payMethod}
                          onValueChange={(v: any) => setPayMethod(v)}
                        >
                          <SelectTrigger className="h-8 text-xs capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((m) => (
                              <SelectItem
                                key={m}
                                value={m}
                                className="text-xs capitalize"
                              >
                                {m.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-4 space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Ref (Txn ID / Cheque)
                        </Label>
                        <Input
                          value={payRef}
                          onChange={(e) => setPayRef(e.target.value)}
                          placeholder="Optional reference"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Button
                          size="sm"
                          onClick={handleRecordPayment}
                          disabled={recordingPay || payAmount <= 0}
                          className="w-full h-8 text-xs"
                        >
                          {recordingPay ? "Saving…" : "Record"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {payments.length > 0 && (
                    <div className="divide-y border rounded-lg max-h-32 overflow-y-auto">
                      {payments.map((p) => (
                        <div
                          key={p.id}
                          className="p-2 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold capitalize">
                              {p.method.replace("_", " ")}
                            </span>
                            {p.reference && (
                              <span className="text-muted-foreground ml-2 font-mono">
                                ({p.reference})
                              </span>
                            )}
                            <div className="text-[10px] text-muted-foreground">
                              {format(
                                new Date(p.paid_at),
                                "dd MMM yyyy, HH:mm"
                              )}
                            </div>
                          </div>
                          <span className="font-bold tabular-nums text-emerald-700">
                            {inr(p.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="size-4 mr-1.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save className="size-4 mr-1.5" /> Save Bill
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Secure Delete Dialog */}
      <SecureDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        deleteLabel={`invoice ${bill?.bill_no ?? ""}`}
      />
    </>
  );
}
