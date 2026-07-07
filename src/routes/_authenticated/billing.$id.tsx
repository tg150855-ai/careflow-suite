import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Printer, Plus, Receipt } from "lucide-react";
import { format } from "date-fns";
import { inr } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { PrintHeader } from "@/components/print-header";

export const Route = createFileRoute("/_authenticated/billing/$id")({ component: BillView });

const METHODS = ["cash", "upi", "card", "bank_transfer", "insurance", "credit"] as const;

function BillView() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<typeof METHODS[number]>("cash");
  const [reference, setReference] = useState("");

  const { data } = useQuery({
    queryKey: ["bill", id],
    queryFn: async () => {
      const [bill, items, payments] = await Promise.all([
        supabase.from("bills").select("*, patients(full_name, uhid, mobile, gender, dob, address_line, city), doctors(name, specialization)").eq("id", id).single(),
        supabase.from("bill_items").select("*").eq("bill_id", id).order("position"),
        supabase.from("payments").select("*").eq("bill_id", id).order("paid_at"),
      ]);
      if (bill.error) throw bill.error;
      return { bill: bill.data, items: items.data ?? [], payments: payments.data ?? [] };
    },
  });

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!data) return;
      if (amount <= 0) throw new Error("Enter amount");
      const newPaid = Number(data.bill.paid) + amount;
      const newPending = Math.max(0, Number(data.bill.total) - newPaid);
      const status = newPending === 0 ? "paid" : "partial";
      const { error: e1 } = await supabase.from("payments").insert({ bill_id: id, amount, method, reference: reference || null, created_by: user?.id ?? null });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("bills").update({ paid: newPaid, pending: newPending, status }).eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => { toast.success("Payment recorded"); setOpen(false); setAmount(0); setReference(""); qc.invalidateQueries({ queryKey: ["bill", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const { bill, items, payments } = data;

  return (
    <div className="space-y-6 max-w-5xl print:max-w-none">
      <div className="flex items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon"><Link to="/billing"><ArrowLeft className="size-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bill {bill.bill_no}</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(bill.created_at), "dd MMM yyyy · HH:mm")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Number(bill.pending) > 0 && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Record payment</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>Amount</Label><Input type="number" min={0} max={Number(bill.pending)} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /><div className="text-xs text-muted-foreground mt-1">Pending: {inr(bill.pending)}</div></div>
                  <div><Label>Method</Label><Select value={method} onValueChange={(v: any) => setMethod(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_"," ")}</SelectItem>)}</SelectContent></Select></div>
                  {method !== "cash" && <div><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Txn ID / cheque no." /></div>}
                </div>
                <DialogFooter><Button disabled={recordPayment.isPending} onClick={() => recordPayment.mutate()}>{recordPayment.isPending ? "Saving…" : "Save payment"}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-2" />Print</Button>
        </div>
      </div>

      <Card className="p-8 print:shadow-none print:border-0">
        <PrintHeader
          title="OPD Consultation Bill"
          documentNo={bill.bill_no}
          timestamp={bill.created_at}
          rightSlot={<Badge variant={bill.status === "paid" ? "secondary" : "outline"} className="capitalize">{bill.status}</Badge>}
        />


        <div className="grid grid-cols-2 gap-8 py-6 border-b text-sm">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Patient</div>
            <div className="font-medium">{bill.patients?.full_name}</div>
            <div className="text-muted-foreground">{bill.patients?.uhid}</div>
            <div className="text-muted-foreground">{bill.patients?.mobile}</div>
            {bill.patients?.address_line && <div className="text-muted-foreground text-xs mt-1">{[bill.patients.address_line, bill.patients.city].filter(Boolean).join(", ")}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Date</div>
            <div>{format(new Date(bill.created_at), "dd MMM yyyy")}</div>
            <div className="text-muted-foreground text-xs">{format(new Date(bill.created_at), "HH:mm")}</div>
          </div>
        </div>

        <table className="w-full text-sm my-6">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-2">#</th>
              <th className="text-left py-2">Category</th>
              <th className="text-left py-2">Description</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Rate</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i) => (
              <tr key={it.id} className="border-b">
                <td className="py-3 text-muted-foreground">{i + 1}</td>
                <td className="py-3">{it.category}</td>
                <td className="py-3">{it.description}</td>
                <td className="py-3 text-right tabular-nums">{it.quantity}</td>
                <td className="py-3 text-right tabular-nums">{inr(it.unit_price)}</td>
                <td className="py-3 text-right tabular-nums">{inr(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <Row label="Subtotal" value={inr(bill.subtotal)} />
            <Row label="Discount" value={`- ${inr(bill.discount)}`} />
            <Row label="GST" value={inr(bill.gst)} />
            <div className="border-t pt-2"><Row label="Total" value={inr(bill.total)} bold /></div>
            <Row label="Paid" value={inr(bill.paid)} />
            <div className="border-t pt-2"><Row label="Pending" value={inr(bill.pending)} bold /></div>
          </div>
        </div>

        {payments.length > 0 && (
          <div className="mt-8 border-t pt-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2"><Receipt className="size-3.5" />Payments</div>
            <div className="space-y-1.5 text-sm">
              {payments.map((p: any) => (
                <div key={p.id} className="flex justify-between">
                  <div><span className="capitalize">{p.method.replace("_"," ")}</span>{p.reference && <span className="text-muted-foreground ml-2">· {p.reference}</span>}</div>
                  <div className="text-muted-foreground">{format(new Date(p.paid_at), "dd MMM HH:mm")} · <span className="tabular-nums text-foreground">{inr(p.amount)}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className={`tabular-nums ${bold ? "font-semibold text-base" : ""}`}>{value}</span></div>;
}
