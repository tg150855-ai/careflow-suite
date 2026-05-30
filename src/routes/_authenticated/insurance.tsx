import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/insurance")({ component: InsurancePage });

function InsurancePage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", patient_insurance_id: "", claim_amount: 0, pre_auth_no: "", notes: "" });
  const [patIns, setPatIns] = useState<any[]>([]);

  async function load() {
    const [c, co, p] = await Promise.all([
      (supabase as any).from("insurance_claims").select("*").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("insurance_companies").select("*").eq("active", true),
      supabase.from("patients").select("id,full_name,uhid").limit(200),
    ]);
    setClaims(c.data ?? []);
    setCompanies(co.data ?? []);
    setPatients(p.data ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!form.patient_id) { setPatIns([]); return; }
    (supabase as any).from("patient_insurance").select("id,policy_number,company_id,coverage_limit").eq("patient_id", form.patient_id).then(({ data }) => setPatIns(data ?? []));
  }, [form.patient_id]);

  async function submit() {
    if (!form.patient_id || !form.claim_amount) return toast.error("Patient & amount required");
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await (supabase as any).from("insurance_claims").insert({
      patient_id: form.patient_id,
      patient_insurance_id: form.patient_insurance_id || null,
      claim_amount: form.claim_amount,
      pre_auth_no: form.pre_auth_no || null,
      notes: form.notes,
      status: "draft",
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Claim drafted");
    setOpen(false);
    setForm({ patient_id: "", patient_insurance_id: "", claim_amount: 0, pre_auth_no: "", notes: "" });
    load();
  }

  async function move(id: string, status: string) {
    const patch: Record<string, unknown> = { status };
    if (status === "submitted") patch.submitted_at = new Date().toISOString();
    if (status === "settled") patch.settled_at = new Date().toISOString();
    await (supabase as any).from("insurance_claims").update(patch).eq("id", id);
    load();
  }

  const totals = {
    active: claims.filter((c) => ["submitted", "under_review"].includes(c.status)).length,
    approved: claims.filter((c) => c.status === "approved").length,
    pending: claims.filter((c) => c.status === "draft").length,
    rejected: claims.filter((c) => c.status === "rejected").length,
    revenue: claims.filter((c) => c.status === "settled").reduce((s, c) => s + Number(c.approved_amount || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="size-6 text-primary" /> Insurance Management</h1>
          <p className="text-sm text-muted-foreground">Companies, policies and claim lifecycle.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> New Claim</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Insurance Claim</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Patient *</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.uhid} — {p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Policy</Label>
                <Select value={form.patient_insurance_id} onValueChange={(v) => setForm({ ...form, patient_insurance_id: v })} disabled={!patIns.length}>
                  <SelectTrigger><SelectValue placeholder={patIns.length ? "Select policy" : "No policy on file"} /></SelectTrigger>
                  <SelectContent>{patIns.map((p) => <SelectItem key={p.id} value={p.id}>{p.policy_number}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Claim Amount (₹) *</Label><Input type="number" value={form.claim_amount} onChange={(e) => setForm({ ...form, claim_amount: Number(e.target.value) })} /></div>
              <div><Label>Pre-Auth No</Label><Input value={form.pre_auth_no} onChange={(e) => setForm({ ...form, pre_auth_no: e.target.value })} /></div>
              <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Save Draft</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Active" value={totals.active} />
        <Stat label="Approved" value={totals.approved} />
        <Stat label="Draft" value={totals.pending} />
        <Stat label="Rejected" value={totals.rejected} />
        <Stat label="Settled Revenue" value={inr(totals.revenue)} />
      </div>

      <Tabs defaultValue="claims">
        <TabsList><TabsTrigger value="claims">Claims</TabsTrigger><TabsTrigger value="companies">Companies</TabsTrigger></TabsList>
        <TabsContent value="claims">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Claim No</TableHead><TableHead>Amount</TableHead><TableHead>Approved</TableHead><TableHead>Pre-Auth</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {claims.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No claims yet</TableCell></TableRow>}
                {claims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.claim_no}</TableCell>
                    <TableCell>{inr(c.claim_amount)}</TableCell>
                    <TableCell>{inr(c.approved_amount)}</TableCell>
                    <TableCell className="text-xs">{c.pre_auth_no ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="flex gap-1">
                      {c.status === "draft" && <Button size="sm" variant="outline" onClick={() => move(c.id, "submitted")}>Submit</Button>}
                      {c.status === "submitted" && <Button size="sm" variant="outline" onClick={() => move(c.id, "under_review")}>Review</Button>}
                      {c.status === "under_review" && <>
                        <Button size="sm" variant="outline" onClick={() => move(c.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => move(c.id, "rejected")}>Reject</Button>
                      </>}
                      {c.status === "approved" && <Button size="sm" onClick={() => move(c.id, "settled")}>Settle</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="companies">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Policy Type</TableHead><TableHead>TPA</TableHead><TableHead>Contact</TableHead></TableRow></TableHeader>
              <TableBody>
                {companies.map((co) => (
                  <TableRow key={co.id}>
                    <TableCell className="font-medium">{co.name}</TableCell>
                    <TableCell>{co.policy_type}</TableCell>
                    <TableCell>{co.tpa}</TableCell>
                    <TableCell className="text-xs">{co.phone}<div className="text-muted-foreground">{co.email}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></CardContent></Card>;
}
