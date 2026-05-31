import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

export const Route = createFileRoute("/_authenticated/hr/leave")({ component: Leave });

const TYPES = ["Casual Leave", "Sick Leave", "Earned Leave", "Maternity Leave", "Emergency Leave"];

function Leave() {
  const { hasAnyRole, user } = useAuth();
  const canApprove = hasAnyRole(["admin", "hr_manager", "dept_head", "super_admin"]);
  const [emps, setEmps] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", leave_type: "Casual Leave", from_date: "", to_date: "", reason: "" });

  async function load() {
    const [{ data: e }, { data: l }] = await Promise.all([
      (supabase as any).from("employees").select("id,employee_no,full_name").eq("status", "active").order("full_name"),
      (supabase as any).from("leave_requests").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setEmps(e ?? []); setRows(l ?? []);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!form.employee_id || !form.from_date || !form.to_date) return toast.error("Fill all fields");
    const days = differenceInCalendarDays(new Date(form.to_date), new Date(form.from_date)) + 1;
    const { error } = await (supabase as any).from("leave_requests").insert({ ...form, days } as any);
    if (error) return toast.error(error.message);
    toast.success("Request submitted");
    setOpen(false); setForm({ employee_id: "", leave_type: "Casual Leave", from_date: "", to_date: "", reason: "" });
    load();
  }

  async function decide(id: string, status: "approved" | "rejected") {
    await (supabase as any).from("leave_requests").update({ status, approver_id: user?.id, approved_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(status);
    load();
  }

  const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
  const pending = rows.filter((r) => r.status === "pending").length;

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

      <Card>
        <CardHeader><CardTitle>All Requests</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{empMap[r.employee_id]?.full_name ?? "—"}</TableCell>
                  <TableCell>{r.leave_type}</TableCell>
                  <TableCell>{format(new Date(r.from_date), "dd MMM")}</TableCell>
                  <TableCell>{format(new Date(r.to_date), "dd MMM")}</TableCell>
                  <TableCell>{r.days}</TableCell>
                  <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell>
                    {canApprove && r.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => decide(r.id, "approved")}><Check className="size-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}><X className="size-3" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No leave requests</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
