import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hr/employees")({ component: Employees });

const DEPTS = ["Administration", "Doctors", "Nursing", "Pharmacy", "Laboratory", "Reception", "Billing", "Accounts", "Housekeeping", "Security"];

function Employees() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", department: "Nursing", designation: "", email: "", phone: "", joining_date: "", qualification: "", address: "", pan: "", aadhaar: "", bank_name: "", bank_account: "", bank_ifsc: "" });

  async function load() {
    const { data } = await (supabase as any).from("employees").select("*").order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.full_name) return toast.error("Name required");
    const { error } = await (supabase as any).from("employees").insert(form as any);
    if (error) return toast.error(error.message);
    toast.success("Employee added");
    setOpen(false);
    setForm({ full_name: "", department: "Nursing", designation: "", email: "", phone: "", joining_date: "", qualification: "", address: "", pan: "", aadhaar: "", bank_name: "", bank_account: "", bank_ifsc: "" });
    load();
  }

  const filtered = rows.filter((r) => !q || r.full_name?.toLowerCase().includes(q.toLowerCase()) || r.employee_no?.toLowerCase().includes(q.toLowerCase()) || r.department?.toLowerCase().includes(q.toLowerCase()));
  const byDept = DEPTS.map((d) => ({ d, count: rows.filter((r) => r.department === d).length }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Briefcase className="size-6 text-primary" /> Employees</h1>
          <p className="text-sm text-muted-foreground">Hospital workforce master.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> New Employee</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>Department *</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
              <div><Label>Joining Date</Label><Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></div>
              <div><Label>Qualification</Label><Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>PAN</Label><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} /></div>
              <div><Label>Aadhaar</Label><Input value={form.aadhaar} onChange={(e) => setForm({ ...form, aadhaar: e.target.value })} /></div>
              <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div><Label>A/C No</Label><Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} /></div>
              <div><Label>IFSC</Label><Input value={form.bank_ifsc} onChange={(e) => setForm({ ...form, bank_ifsc: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Save Employee</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {byDept.slice(0, 5).map((b) => (
          <Card key={b.d}><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{b.d}</div><div className="text-2xl font-semibold">{b.count}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Employees ({rows.length})</CardTitle>
          <div className="relative w-72"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" placeholder="Search name, ID, dept" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Emp ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Designation</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.employee_no}</TableCell>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>{r.designation ?? "—"}</TableCell>
                  <TableCell>{r.phone ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No employees yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
