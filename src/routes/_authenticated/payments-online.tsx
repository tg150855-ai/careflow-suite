import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Plus } from "lucide-react";
import { format } from "date-fns";
import { inr } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments-online")({ component: PayPage });

function PayPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", amount: "", method: "upi", purpose: "consultation" });

  async function load() {
    const sb = supabase as any;
    const { data } = await sb.from("online_payments").select("*, patients(full_name, uhid)").order("created_at", { ascending: false }).limit(100);
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  async function create() {
    if (!form.patient_id || !form.amount) return toast.error("Patient and amount required");
    const sb = supabase as any;
    const { error } = await sb.from("online_payments").insert({
      patient_id: form.patient_id,
      amount: parseFloat(form.amount),
      method: form.method,
      purpose: form.purpose,
      gateway: "razorpay",
      gateway_ref: `pay_${crypto.randomUUID().slice(0, 12)}`,
      status: "success",
      paid_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Payment recorded"); setOpen(false);
    setForm({ patient_id: "", amount: "", method: "upi", purpose: "consultation" }); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><CreditCard className="size-6 text-primary" /> Online Payments</h1>
          <p className="text-sm text-muted-foreground">UPI, Cards, Net Banking — advance, consultation, bill settlement.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-1" /> Record Payment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Online Payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Patient" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="debit_card">Debit Card</SelectItem>
                      <SelectItem value="netbanking">Net Banking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Purpose</Label>
                  <Select value={form.purpose} onValueChange={(v) => setForm({ ...form, purpose: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="advance">Advance</SelectItem>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="bill">Bill Settlement</SelectItem>
                      <SelectItem value="package">Health Package</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Record</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="pt-6">
        <Table>
          <TableHeader><TableRow><TableHead>Ref</TableHead><TableHead>Patient</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Purpose</TableHead><TableHead>Status</TableHead><TableHead>Paid</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No payments yet</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.gateway_ref}</TableCell>
                <TableCell>{r.patients?.full_name ?? "—"}</TableCell>
                <TableCell className="font-medium">{inr(r.amount)}</TableCell>
                <TableCell className="capitalize">{r.method.replace(/_/g, " ")}</TableCell>
                <TableCell className="capitalize">{r.purpose}</TableCell>
                <TableCell><Badge variant={r.status === "success" ? "default" : "outline"} className="capitalize">{r.status}</Badge></TableCell>
                <TableCell className="text-xs">{r.paid_at ? format(new Date(r.paid_at), "dd MMM HH:mm") : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
