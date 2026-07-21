import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";
import { useIsSuperAdmin } from "@/lib/use-super-admin";

export const Route = createFileRoute("/_authenticated/insurance")({ component: InsurancePage });

function InsurancePage() {
  const isAdmin = useIsSuperAdmin();
  const [claims, setClaims] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: "", patient_insurance_id: "", claim_amount: 0, pre_auth_no: "", notes: "" });
  const [patIns, setPatIns] = useState<any[]>([]);

  // filters
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    const [c, co, p] = await Promise.all([
      (supabase as any).from("insurance_claims").select("*, patients(full_name, uhid, mobile)").order("created_at", { ascending: false }).limit(500),
      (supabase as any).from("insurance_companies").select("*").order("name"),
      supabase.from("patients").select("id,full_name,uhid").limit(500),
    ]);
    setClaims(c.data ?? []);
    setCompanies(co.data ?? []);
    setPatients(p.data ?? []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!form.patient_id) { setPatIns([]); return; }
    (supabase as any).from("patient_insurance").select("id,policy_number,company_id,coverage_limit").eq("patient_id", form.patient_id).then(({ data }: { data: any }) => setPatIns(data ?? []));
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
    await (supabase as any).from("insurance_claims").update(patch as any).eq("id", id);
    load();
  }

  async function removeClaim(id: string) {
    const { error } = await (supabase as any).from("insurance_claims").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Claim deleted"); load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromT = from ? new Date(from).getTime() : null;
    const toT = to ? new Date(to).getTime() + 86_400_000 - 1 : null;
    return claims.filter((c) => {
      if (fromT && new Date(c.created_at).getTime() < fromT) return false;
      if (toT && new Date(c.created_at).getTime() > toT) return false;
      if (!q) return true;
      const hay = `${c.claim_no ?? ""} ${c.pre_auth_no ?? ""} ${c.patients?.full_name ?? ""} ${c.patients?.uhid ?? ""} ${c.patients?.mobile ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [claims, search, from, to]);

  const pendingList = filtered.filter((c) => ["draft", "submitted", "under_review"].includes(c.status));
  const completedList = filtered.filter((c) => ["approved", "settled", "rejected"].includes(c.status));

  const totals = {
    active: claims.filter((c) => ["submitted", "under_review"].includes(c.status)).length,
    approved: claims.filter((c) => c.status === "approved").length,
    pending: claims.filter((c) => c.status === "draft").length,
    rejected: claims.filter((c) => c.status === "rejected").length,
    revenue: claims.filter((c) => c.status === "settled").reduce((s, c) => s + Number(c.approved_amount || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
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
        <TabsList>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="min-w-[240px] flex-1">
              <Label className="text-xs">Search</Label>
              <SearchBox value={search} onChange={setSearch} placeholder="Claim no, pre-auth, patient, UHID, mobile" />
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setFrom(""); setTo(""); }}>Reset</Button>
          </div>

          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="all">All <Badge variant="secondary" className="ml-2">{filtered.length}</Badge></TabsTrigger>
              <TabsTrigger value="pending">Pending <Badge variant="secondary" className="ml-2">{pendingList.length}</Badge></TabsTrigger>
              <TabsTrigger value="completed">Completed <Badge variant="secondary" className="ml-2">{completedList.length}</Badge></TabsTrigger>
            </TabsList>
            <TabsContent value="all"><ClaimsTable rows={filtered} move={move} removeClaim={removeClaim} /></TabsContent>
            <TabsContent value="pending"><ClaimsTable rows={pendingList} move={move} removeClaim={removeClaim} /></TabsContent>
            <TabsContent value="completed"><ClaimsTable rows={completedList} move={move} removeClaim={removeClaim} /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="companies">
          <CompaniesPanel companies={companies} reload={load} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClaimsTable({ rows, move, removeClaim }: { rows: any[]; move: (id: string, s: string) => void; removeClaim: (id: string) => void }) {
  return (
    <Card><CardContent className="pt-6">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Claim No</TableHead>
          <TableHead>Patient</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Approved</TableHead>
          <TableHead>Pre-Auth</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No claims</TableCell></TableRow>}
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.claim_no}</TableCell>
              <TableCell className="text-sm">{c.patients?.full_name ?? "—"}<div className="text-xs text-muted-foreground font-mono">{c.patients?.uhid}</div></TableCell>
              <TableCell>{inr(c.claim_amount)}</TableCell>
              <TableCell>{inr(c.approved_amount)}</TableCell>
              <TableCell className="text-xs">{c.pre_auth_no ?? "—"}</TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{c.status.replace("_", " ")}</Badge></TableCell>
              <TableCell className="flex gap-1 items-center flex-wrap">
                {c.status === "draft" && <Button size="sm" variant="outline" onClick={() => move(c.id, "submitted")}>Submit</Button>}
                {c.status === "submitted" && <Button size="sm" variant="outline" onClick={() => move(c.id, "under_review")}>Review</Button>}
                {c.status === "under_review" && <>
                  <Button size="sm" variant="outline" onClick={() => move(c.id, "approved")}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => move(c.id, "rejected")}>Reject</Button>
                </>}
                {c.status === "approved" && <Button size="sm" onClick={() => move(c.id, "settled")}>Settle</Button>}
                <RecordActions onDelete={() => removeClaim(c.id)} deleteLabel={`claim ${c.claim_no}`} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function CompaniesPanel({ companies, reload, isAdmin }: { companies: any[]; reload: () => void; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", policy_type: "cashless", tpa: "", phone: "", email: "", active: true });

  function openNew() {
    setEditing(null);
    setForm({ name: "", policy_type: "cashless", tpa: "", phone: "", email: "", active: true });
    setOpen(true);
  }
  function openEdit(co: any) {
    setEditing(co);
    setForm({ name: co.name ?? "", policy_type: co.policy_type ?? "cashless", tpa: co.tpa ?? "", phone: co.phone ?? "", email: co.email ?? "", active: co.active ?? true });
    setOpen(true);
  }
  async function save() {
    if (!form.name.trim()) return toast.error("Name required");
    const q = editing
      ? (supabase as any).from("insurance_companies").update(form).eq("id", editing.id)
      : (supabase as any).from("insurance_companies").insert(form);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success(editing ? "Company updated" : "Company added");
    setOpen(false); reload();
  }
  async function remove(id: string, name: string) {
    const { error } = await (supabase as any).from("insurance_companies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${name}`); reload();
  }

  return (
    <Card><CardContent className="pt-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Building2 className="size-4 text-muted-foreground" /><span className="text-sm font-medium">Insurance Companies</span></div>
        {isAdmin && <Button size="sm" onClick={openNew}><Plus className="size-4 mr-1" />Add Company</Button>}
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Policy Type</TableHead><TableHead>TPA</TableHead><TableHead>Contact</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {companies.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No companies yet</TableCell></TableRow>}
          {companies.map((co) => (
            <TableRow key={co.id}>
              <TableCell className="font-medium">{co.name}</TableCell>
              <TableCell className="capitalize">{co.policy_type ?? "—"}</TableCell>
              <TableCell>{co.tpa ?? "—"}</TableCell>
              <TableCell className="text-xs">{co.phone ?? "—"}<div className="text-muted-foreground">{co.email ?? ""}</div></TableCell>
              <TableCell><Badge variant={co.active ? "secondary" : "outline"}>{co.active ? "Active" : "Inactive"}</Badge></TableCell>
              <TableCell>
                <RecordActions
                  onEdit={isAdmin ? () => openEdit(co) : undefined}
                  onDelete={() => remove(co.id, co.name)}
                  deleteLabel={co.name}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Company" : "Add Insurance Company"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Policy Type</Label>
              <Select value={form.policy_type} onValueChange={(v) => setForm({ ...form, policy_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashless">Cashless</SelectItem>
                  <SelectItem value="reimbursement">Reimbursement</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>TPA</Label><Input value={form.tpa} onChange={(e) => setForm({ ...form, tpa: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="col-span-2 flex items-center gap-2">
              <input id="active" type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Save" : "Add"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent></Card>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></CardContent></Card>;
}
