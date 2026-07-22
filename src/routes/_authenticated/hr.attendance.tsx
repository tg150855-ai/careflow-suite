import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, LogIn, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { SearchBox } from "@/components/common/search-box";
import { ModuleActionBar } from "@/components/common/action-bar";
import { exportXlsx } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/hr/attendance")({ component: Attendance });

function Attendance() {
  const [emps, setEmps] = useState<any[]>([]);
  const [today, setToday] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", status: "present", method: "manual" });
  const date = format(new Date(), "yyyy-MM-dd");

  async function load() {
    const [{ data: e }, { data: a }] = await Promise.all([
      (supabase as any).from("employees").select("id,employee_no,full_name,department").eq("status", "active").order("full_name"),
      (supabase as any).from("attendance_records").select("*").eq("date", date),
    ]);
    setEmps(e ?? []); setToday(a ?? []);
  }
  useEffect(() => { load(); }, []);

  async function mark() {
    if (!form.employee_id) return toast.error("Select employee");
    const { error } = await (supabase as any).from("attendance_records").insert({ ...form, check_in: new Date().toISOString(), date } as any);
    if (error) return toast.error(error.message);
    toast.success("Marked");
    setOpen(false); setForm({ employee_id: "", status: "present", method: "manual" });
    load();
  }

  async function checkOut(id: string, checkIn: string) {
    const hrs = (Date.now() - new Date(checkIn).getTime()) / 3600000;
    await (supabase as any).from("attendance_records").update({ check_out: new Date().toISOString(), working_hours: +hrs.toFixed(2), overtime_hours: Math.max(0, +hrs.toFixed(2) - 8) } as any).eq("id", id);
    toast.success("Checked out");
    load();
  }

  const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
  const present = today.filter((t) => t.status === "present").length;
  const absent = emps.length - today.length;
  const late = today.filter((t) => t.check_in && new Date(t.check_in).getHours() >= 10).length;
  const overtime = today.filter((t) => t.overtime_hours > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Clock className="size-6 text-primary" /> Attendance</h1>
          <p className="text-sm text-muted-foreground">Today: {format(new Date(), "EEEE, dd MMM yyyy")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Mark Attendance</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Mark Attendance</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Employee</Label>
                <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{emps.map((e) => <SelectItem key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="half_day">Half Day</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="biometric">Biometric</SelectItem>
                      <SelectItem value="qr">QR</SelectItem>
                      <SelectItem value="rfid">RFID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={mark}>Check In</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Present Today</div><div className="text-2xl font-semibold text-emerald-600">{present}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Absent</div><div className="text-2xl font-semibold text-rose-600">{absent}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Late Arrivals</div><div className="text-2xl font-semibold text-amber-600">{late}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">On Overtime</div><div className="text-2xl font-semibold">{overtime}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Today's Log ({today.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Department</TableHead><TableHead>Check In</TableHead><TableHead>Check Out</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {today.map((t) => {
                const e = empMap[t.employee_id];
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{e?.full_name ?? "—"}</TableCell>
                    <TableCell>{e?.department ?? "—"}</TableCell>
                    <TableCell><LogIn className="inline size-3 mr-1" />{t.check_in ? format(new Date(t.check_in), "HH:mm") : "—"}</TableCell>
                    <TableCell><LogOut className="inline size-3 mr-1" />{t.check_out ? format(new Date(t.check_out), "HH:mm") : "—"}</TableCell>
                    <TableCell>{t.working_hours} {t.overtime_hours > 0 && <Badge variant="outline" className="ml-1">+{t.overtime_hours} OT</Badge>}</TableCell>
                    <TableCell><Badge>{t.status}</Badge></TableCell>
                    <TableCell>{!t.check_out && <Button size="sm" variant="outline" onClick={() => checkOut(t.id, t.check_in)}>Check Out</Button>}</TableCell>
                  </TableRow>
                );
              })}
              {today.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No records today</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
