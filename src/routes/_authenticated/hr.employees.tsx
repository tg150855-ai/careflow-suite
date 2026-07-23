import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { EmployeeAttachments } from "@/components/employee-attachments";
import { format } from "date-fns";
import { ModuleActionBar } from "@/components/common/action-bar";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";
import { DayMonthYearTabs, useDateRange } from "@/components/common/date-range-tabs";
import { exportXlsx } from "@/lib/export";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/hr/employees")({ component: Employees });

const DEPTS = ["Administration", "Doctors", "Nursing", "Pharmacy", "Laboratory", "Reception", "Billing", "Accounts", "Housekeeping", "Security"];
const EMPTY = { full_name: "", department: "Nursing", designation: "", email: "", phone: "", joining_date: "", qualification: "", address: "", pan: "", aadhaar: "", bank_name: "", bank_account: "", bank_ifsc: "" };

function Employees() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const { range, preset, setPreset } = useDateRange("all");

  async function load() {
    const { data } = await (supabase as any).from("employees").select("*").order("created_at", { ascending: false }).limit(500);
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: any) {
    setEditing(r);
    setForm({
      full_name: r.full_name ?? "", department: r.department ?? "Nursing", designation: r.designation ?? "",
      email: r.email ?? "", phone: r.phone ?? "", joining_date: r.joining_date ?? "",
      qualification: r.qualification ?? "", address: r.address ?? "", pan: r.pan ?? "",
      aadhaar: r.aadhaar ?? "", bank_name: r.bank_name ?? "", bank_account: r.bank_account ?? "", bank_ifsc: r.bank_ifsc ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.full_name) return toast.error("Name required");
    const payload = { ...form, joining_date: form.joining_date || null };
    const { error } = editing
      ? await (supabase as any).from("employees").update(payload).eq("id", editing.id)
      : await (supabase as any).from("employees").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Employee updated" : "Employee added");
    setOpen(false); setEditing(null); setForm(EMPTY); load();
  }

  async function removeEmp(id: string) {
    const { error } = await (supabase as any).from("employees").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Employee deleted"); load();
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (preset !== "all") {
        const created = r.created_at ? new Date(r.created_at) : null;
        if (!created || created < range.from || created > range.to) return false;
      }
      if (!s) return true;
      return [r.full_name, r.employee_no, r.department, r.designation, r.phone, r.email]
        .some((v) => (v ?? "").toString().toLowerCase().includes(s));
    });
  }, [rows, q, preset, range]);

  const byDept = DEPTS.map((d) => ({ d, count: filtered.filter((r) => r.department === d).length }));

  function exportRows() {
    exportXlsx(filtered.map((r) => ({
      "Emp ID": r.employee_no, Name: r.full_name, Department: r.department,
      Designation: r.designation ?? "", Phone: r.phone ?? "", Email: r.email ?? "",
      "Joining Date": r.joining_date ?? "", Qualification: r.qualification ?? "",
      PAN: r.pan ?? "", Aadhaar: r.aadhaar ?? "", Bank: r.bank_name ?? "",
      "A/C": r.bank_account ?? "", IFSC: r.bank_ifsc ?? "", Status: r.status,
    })), `employees-${format(new Date(), "yyyyMMdd")}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Briefcase className="size-6 text-primary" /> Employees</h1>
          <p className="text-sm text-muted-foreground">Hospital workforce master.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="size-4" /> New Employee</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
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
            <DialogFooter><Button onClick={save}>Save Employee</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {byDept.slice(0, 5).map((b) => (
          <Card key={b.d}><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{b.d}</div><div className="text-2xl font-semibold">{b.count}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>All Employees ({filtered.length})</CardTitle>
          <ModuleActionBar
            leading={<SearchBox value={q} onChange={setQ} placeholder="Search name, ID, dept, phone…" />}
            onAdd={openNew}
            onExport={exportRows}
            onPrint={() => window.print()}
            extra={<DayMonthYearTabs value={preset} onChange={(p) => setPreset(p)} />}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Emp ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Designation</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.employee_no}</TableCell>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>{r.designation ?? "—"}</TableCell>
                  <TableCell>{r.phone ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <RecordActions
                      size="icon"
                      deleteLabel={`employee ${r.full_name}`}
                      onEdit={() => openEdit(r)}
                      onWhatsApp={() => shareOnWhatsApp(summarizeRecord("Employee", {
                        "Emp ID": r.employee_no, Name: r.full_name, Department: r.department,
                        Designation: r.designation ?? "—", Phone: r.phone ?? "—",
                        Email: r.email ?? "—", Joined: r.joining_date ?? "—",
                      }), undefined, r.phone ?? undefined)}
                      onDelete={() => removeEmp(r.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No employees found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
