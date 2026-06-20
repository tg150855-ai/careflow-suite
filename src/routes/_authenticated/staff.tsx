import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { createStaff } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/staff")({ component: StaffDirectory });

const DEPARTMENTS = ["Administration", "Doctors", "Nursing", "Pharmacy", "Laboratory", "Reception", "Billing", "Accounts", "Housekeeping", "Security"];
const ROLES = [
  { v: "doctor", l: "Doctor" }, { v: "nurse", l: "Nurse" }, { v: "receptionist", l: "Receptionist" },
  { v: "pharmacist", l: "Pharmacist" }, { v: "lab_tech", l: "Lab Tech" }, { v: "accountant", l: "Accountant" },
  { v: "surgeon", l: "Surgeon" }, { v: "ot_coordinator", l: "OT Coordinator" }, { v: "hr_manager", l: "HR Manager" },
  { v: "finance_manager", l: "Finance Manager" }, { v: "dept_head", l: "Dept Head" }, { v: "procurement_officer", l: "Procurement" },
  { v: "insurance_officer", l: "Insurance Officer" }, { v: "admin", l: "Admin" }, { v: "super_admin", l: "Super Admin" },
];

function tempPassword() {
  const seg = () => Math.random().toString(36).slice(2, 6);
  return `Sbg-${seg()}-${seg()}`;
}

function StaffDirectory() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["admin", "super_admin"]);
  const qc = useQueryClient();
  const create = createStaff;

  const [q, setQ] = useState("");
  const [dept, setDept] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["staff-directory"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employees")
        .select("id, employee_no, full_name, department, designation, email, phone, status, joining_date, photo_url, user_id, gender, dob")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((r: any) => r.user_id).filter(Boolean);
      let roleMap: Record<string, string[]> = {};
      if (ids.length) {
        const { data: rs } = await (supabase as any).from("user_roles").select("user_id, role").in("user_id", ids);
        (rs ?? []).forEach((r: any) => {
          (roleMap[r.user_id] ??= []).push(r.role);
        });
      }
      return (data ?? []).map((r: any) => ({ ...r, roles: r.user_id ? roleMap[r.user_id] ?? [] : [] }));
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r: any) => {
      if (q) {
        const term = q.toLowerCase();
        if (!`${r.full_name ?? ""} ${r.employee_no ?? ""} ${r.email ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(term)) return false;
      }
      if (dept !== "all" && r.department !== dept) return false;
      if (status !== "all" && r.status !== status) return false;
      if (roleFilter !== "all" && !r.roles.includes(roleFilter)) return false;
      return true;
    });
  }, [rows, q, dept, status, roleFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="size-6 text-primary" /> Staff Directory
          </h1>
          <p className="text-sm text-muted-foreground">All staff, accounts and roles.</p>
        </div>
        {isAdmin && (
          <CreateStaffDialog
            open={open}
            setOpen={setOpen}
            onCreate={async (payload) => {
              try {
                const res = await create({ data: payload });
                toast.success(`Staff created · ${res.employee_no}`);
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["staff-directory"] });
              } catch (e: any) {
                toast.error(e?.message ?? "Failed to create staff");
              }
            }}
          />
        )}
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input className="pl-8" placeholder="Name, ID, email, phone" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No staff found</TableCell></TableRow>
              )}
              {filtered.map((r: any) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell>
                    <Link to="/staff/$id" params={{ id: r.id }} className="flex items-center gap-3">
                      <Avatar className="size-9">
                        {r.photo_url && <AvatarImage src={r.photo_url} alt={r.full_name} />}
                        <AvatarFallback>{String(r.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-xs font-mono text-muted-foreground">{r.employee_no}</div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell>{r.designation ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.roles.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                      {r.roles.map((rl: string) => <Badge key={rl} variant="secondary">{rl}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.phone ?? "—"}</div>
                  </TableCell>
                  <TableCell>{r.joining_date ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateStaffDialog({ open, setOpen, onCreate }: { open: boolean; setOpen: (v: boolean) => void; onCreate: (p: any) => Promise<void> }) {
  const [form, setForm] = useState({
    full_name: "", email: "", password: tempPassword(), role: "nurse",
    department: "Nursing", designation: "", mobile: "", gender: "male",
    dob: "", address: "", joining_date: "", reporting_manager: "",
  });
  const [submitting, setSubmitting] = useState(false);

  function up<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.full_name || !form.email || !form.password) return toast.error("Name, email, password required");
    setSubmitting(true);
    try {
      await onCreate(form);
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setForm((f) => ({ ...f, password: tempPassword() }))}><Plus className="size-4 mr-2" /> Add staff</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add staff member</DialogTitle></DialogHeader>

        <div className="space-y-5">
          <section>
            <h3 className="text-sm font-semibold mb-2">Personal details</h3>
            <div className="grid grid-cols-2 gap-3">
              <Fld l="Full name *"><Input value={form.full_name} onChange={(e) => up("full_name", e.target.value)} /></Fld>
              <Fld l="Gender">
                <Select value={form.gender} onValueChange={(v) => up("gender", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["male", "female", "other"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </Fld>
              <Fld l="Date of birth"><Input type="date" value={form.dob} onChange={(e) => up("dob", e.target.value)} /></Fld>
              <Fld l="Mobile"><Input value={form.mobile} onChange={(e) => up("mobile", e.target.value)} /></Fld>
              <Fld l="Address" wide><Input value={form.address} onChange={(e) => up("address", e.target.value)} /></Fld>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Employment</h3>
            <div className="grid grid-cols-2 gap-3">
              <Fld l="Department *">
                <Select value={form.department} onValueChange={(v) => up("department", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Fld>
              <Fld l="Designation"><Input value={form.designation} onChange={(e) => up("designation", e.target.value)} /></Fld>
              <Fld l="Joining date"><Input type="date" value={form.joining_date} onChange={(e) => up("joining_date", e.target.value)} /></Fld>
              <Fld l="Reporting manager"><Input value={form.reporting_manager} onChange={(e) => up("reporting_manager", e.target.value)} /></Fld>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">System access</h3>
            <div className="grid grid-cols-2 gap-3">
              <Fld l="Role *">
                <Select value={form.role} onValueChange={(v) => up("role", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
                </Select>
              </Fld>
              <Fld l="Login email *"><Input type="email" value={form.email} onChange={(e) => up("email", e.target.value)} /></Fld>
              <Fld l="Temporary password *" wide>
                <div className="flex gap-2">
                  <Input value={form.password} onChange={(e) => up("password", e.target.value)} />
                  <Button type="button" variant="outline" onClick={() => up("password", tempPassword())}>Regenerate</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Share securely. User will be forced to change on first login.</p>
              </Fld>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "Creating…" : "Create staff & account"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fld({ l, wide, children }: { l: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "col-span-2 space-y-1" : "space-y-1"}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{l}</Label>
      {children}
    </div>
  );
}
