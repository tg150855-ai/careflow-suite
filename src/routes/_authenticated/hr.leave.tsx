import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarCheck, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { ModuleActionBar } from "@/components/common/action-bar";
import { RecordActions } from "@/components/common/record-actions";
import { SearchBox } from "@/components/common/search-box";
import { DayMonthYearTabs, useDateRange } from "@/components/common/date-range-tabs";
import { exportXlsx } from "@/lib/export";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/hr/leave")({ component: Leave });

const TYPES = ["Casual Leave", "Sick Leave", "Earned Leave", "Maternity Leave", "Emergency Leave"];

function Leave() {
  const { hasAnyRole, user } = useAuth();
  const canApprove = hasAnyRole(["admin", "hr_manager", "dept_head", "super_admin"]);
  const [emps, setEmps] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", leave_type: "Casual Leave", from_date: "", to_date: "", reason: "" });
  const [q, setQ] = useState("");
  const { range, preset, setPreset } = useDateRange("month");

  async function load() {
    const [{ data: e }, { data: l }] = await Promise.all([
      (supabase as any).from("employees").select("id,employee_no,full_name,phone").eq("status", "active").order("full_name"),
      (supabase as any).from("leave_requests").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setEmps(e ?? []); setRows(l ?? []);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!form.employee_id || !form.from_date || !form.to_date) return toast.error("Fill all fields");
    const days = differenceInCalendarDays(new Date(form.to_date), new Date(form.from_date)) + 1;
    const { error } = await (supabase as any).from("leave_requests").insert({ ...form, days });
    if (error) return toast.error(error.message);
    toast.success("Request submitted");
    setOpen(false); setForm({ employee_id: "", leave_type: "Casual Leave", from_date: "", to_date: "", reason: "" });
    load();
  }

  async function decide(id: string, status: "approved" | "rejected") {
    await (supabase as any).from("leave_requests").update({ status, approver_id: user?.id, approved_at: new Date().toISOString() }).eq("id", id);
    toast.success(status);
    load();
  }

  async function removeReq(id: string) {
    const { error } = await (supabase as any).from("leave_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Leave request deleted"); load();
  }

  const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (preset !== "all") {
        const created = r.created_at ? new Date(r.created_at) : null;
        if (!created || created < range.from || created > range.to) return false;
      }
      if (!s) return true;
      const emp = empMap[r.employee_id];
      return [emp?.full_name, emp?.employee_no, r.leave_type, r.reason, r.status]
        .some((v) => (v ?? "").toString().toLowerCase().includes(s));
    });
  }, [rows, q, preset, range, empMap]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const stats = useMemo(() => {
    const inRange = (r: any) => {
      if (preset === "all") return true;
      const created = r.created_at ? new Date(r.created_at) : null;
      return !!created && created >= range.from && created <= range.to;
    };
    const scoped = rows.filter(inRange);
    return {
      totalEmployees: emps.length,
      applied: scoped.length,
      approved: scoped.filter((r) => r.status === "approved").length,
      pending: scoped.filter((r) => r.status === "pending").length,
      rejected: scoped.filter((r) => r.status === "rejected").length,
      onLeaveToday: rows.filter((r) => r.status === "approved" && r.from_date <= todayStr && r.to_date >= todayStr).length,
    };
  }, [rows, emps, preset, range, todayStr]);
  const pending = stats.pending;

  function exportRows() {
    exportXlsx(filtered.map((r) => ({
      Employee: empMap[r.employee_id]?.full_name ?? "—",
      "Emp ID": empMap[r.employee_id]?.employee_no ?? "—",
      Type: r.leave_type, From: r.from_date, To: r.to_date, Days: r.days,
      Reason: r.reason ?? "", Status: r.status,
    })), `leave-requests-${format(new Date(), "yyyyMMdd")}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><CalendarCheck className="size-6 text-primary" /> Leave Management</h1>
          <p className="text-sm text-muted-foreground">{pending} pending request{pending !== 1 ? "s" : ""}.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Request Leave</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Leave Request</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Employee</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{emps.map((e) => <SelectItem key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Type</Label>
                <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>From</Label><Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} /></div>
                <div><Label>To</Label><Input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></div>
              </div>
              <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Employees", value: stats.totalEmployees },
          { label: "Leave Applied", value: stats.applied },
          { label: "Approved", value: stats.approved, cls: "text-emerald-600" },
          { label: "Pending", value: stats.pending, cls: "text-amber-600" },
          { label: "Rejected", value: stats.rejected, cls: "text-destructive" },
          { label: "On Leave Today", value: stats.onLeaveToday, cls: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              <div className={`text-2xl font-semibold ${s.cls ?? ""}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>All Requests ({filtered.length})</CardTitle>
          <ModuleActionBar
            leading={<SearchBox value={q} onChange={setQ} placeholder="Search employee, type, status…" />}
            onExport={exportRows}
            onPrint={() => window.print()}
            extra={<DayMonthYearTabs value={preset} onChange={(p) => setPreset(p)} />}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const emp = empMap[r.employee_id];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{emp?.full_name ?? "—"}</TableCell>
                    <TableCell>{r.leave_type}</TableCell>
                    <TableCell>{format(new Date(r.from_date), "dd MMM")}</TableCell>
                    <TableCell>{format(new Date(r.to_date), "dd MMM")}</TableCell>
                    <TableCell>{r.days}</TableCell>
                    <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canApprove && r.status === "pending" && (
                          <>
                            <Button size="icon" variant="outline" onClick={() => decide(r.id, "approved")} className="h-8 w-8"><Check className="size-3.5" /></Button>
                            <Button size="icon" variant="outline" onClick={() => decide(r.id, "rejected")} className="h-8 w-8"><X className="size-3.5" /></Button>
                          </>
                        )}
                        <RecordActions
                          size="icon"
                          deleteLabel={`leave request for ${emp?.full_name ?? "employee"}`}
                          onWhatsApp={() => shareOnWhatsApp(summarizeRecord("Leave Request", {
                            Employee: emp?.full_name ?? "—", "Emp ID": emp?.employee_no ?? "—",
                            Type: r.leave_type,
                            From: format(new Date(r.from_date), "dd MMM yyyy"),
                            To: format(new Date(r.to_date), "dd MMM yyyy"),
                            Days: r.days, Reason: r.reason ?? "—", Status: r.status,
                          }), undefined, emp?.phone ?? undefined)}
                          onDelete={() => removeReq(r.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No leave requests</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
