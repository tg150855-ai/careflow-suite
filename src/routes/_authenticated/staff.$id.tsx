import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { resetStaffPassword, toggleStaffLogin, changeStaffRole } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/staff/$id")({ component: StaffProfile });

const ROLES = [
  "doctor", "nurse", "receptionist", "pharmacist", "lab_tech", "accountant",
  "surgeon", "ot_coordinator", "hr_manager", "finance_manager", "dept_head",
  "procurement_officer", "insurance_officer", "admin", "super_admin",
];

function StaffProfile() {
  const { id } = Route.useParams();
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["admin", "super_admin"]);
  const qc = useQueryClient();
  const resetPw = resetStaffPassword;
  const toggleLogin = toggleStaffLogin;
  const setRole = changeStaffRole;

  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["staff", id],
    queryFn: async () => {
      const { data: emp } = await (supabase as any).from("employees").select("*").eq("id", id).single();
      if (!emp) return null;
      const [profile, roles, attendance, leaves, payroll, audit] = await Promise.all([
        emp.user_id ? (supabase as any).from("profiles").select("*").eq("id", emp.user_id).maybeSingle() : Promise.resolve({ data: null }),
        emp.user_id ? (supabase as any).from("user_roles").select("role").eq("user_id", emp.user_id) : Promise.resolve({ data: [] }),
        (supabase as any).from("attendance_records").select("*").eq("employee_id", id).order("check_in", { ascending: false }).limit(30),
        (supabase as any).from("leave_requests").select("*").eq("employee_id", id).order("created_at", { ascending: false }).limit(20),
        (supabase as any).from("salary_slips").select("*").eq("employee_id", id).order("created_at", { ascending: false }).limit(12),
        emp.user_id ? (supabase as any).from("enterprise_audit_logs").select("*").or(`entity_id.eq.${emp.user_id},user_id.eq.${emp.user_id}`).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      ]);
      return { emp, profile: profile.data, roles: (roles.data ?? []).map((r: any) => r.role), attendance: attendance.data ?? [], leaves: leaves.data ?? [], payroll: payroll.data ?? [], audit: audit.data ?? [] };
    },
  });

  if (isLoading) return <div className="p-12 text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-12">Not found</div>;
  const { emp, profile, roles, attendance, leaves, payroll, audit } = data;

  async function doReset() {
    if (!emp.user_id) return toast.error("No login account linked");
    if (newPw.length < 8) return toast.error("Min 8 characters");
    try {
      await resetPw({ data: { user_id: emp.user_id, new_password: newPw } });
      toast.success("Password reset · user must change on next login");
      setPwOpen(false); setNewPw("");
      qc.invalidateQueries({ queryKey: ["staff", id] });
    } catch (e: any) { toast.error(e?.message); }
  }
  async function doToggle() {
    if (!emp.user_id) return;
    try {
      await toggleLogin({ data: { user_id: emp.user_id, disabled: !profile?.login_disabled } });
      toast.success(profile?.login_disabled ? "Login enabled" : "Login disabled");
      qc.invalidateQueries({ queryKey: ["staff", id] });
      qc.invalidateQueries({ queryKey: ["staff-directory"] });
    } catch (e: any) { toast.error(e?.message); }
  }
  async function doRoleChange(r: string) {
    if (!emp.user_id) return;
    try {
      await setRole({ data: { user_id: emp.user_id, role: r as any } });
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["staff", id] });
    } catch (e: any) { toast.error(e?.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/staff"><ArrowLeft className="size-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{emp.full_name}</h1>
          <div className="text-sm text-muted-foreground font-mono">{emp.employee_no}</div>
        </div>
        {isAdmin && emp.user_id && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPwOpen(true)}><KeyRound className="size-4 mr-2" /> Reset password</Button>
            <Button variant={profile?.login_disabled ? "default" : "destructive"} onClick={doToggle}>
              {profile?.login_disabled ? <><ShieldCheck className="size-4 mr-2" />Enable login</> : <><ShieldAlert className="size-4 mr-2" />Disable login</>}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 flex items-center gap-5">
          <Avatar className="size-20">
            {emp.photo_url && <AvatarImage src={emp.photo_url} />}
            <AvatarFallback className="text-2xl">{String(emp.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Department</div><div className="font-medium">{emp.department}</div></div>
            <div><div className="text-xs text-muted-foreground">Designation</div><div className="font-medium">{emp.designation ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Email</div><div className="font-medium">{emp.email ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Phone</div><div className="font-medium">{emp.phone ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Roles</div><div className="flex flex-wrap gap-1">{roles.map((r: string) => <Badge key={r} variant="secondary">{r}</Badge>)}</div></div>
            <div><div className="text-xs text-muted-foreground">Status</div><Badge variant={emp.status === "active" ? "default" : "secondary"}>{emp.status}</Badge></div>
            <div><div className="text-xs text-muted-foreground">Login</div><Badge variant={profile?.login_disabled ? "destructive" : "default"}>{profile?.login_disabled ? "Disabled" : "Active"}</Badge></div>
            <div><div className="text-xs text-muted-foreground">Joined</div><div className="font-medium">{emp.joining_date ?? "—"}</div></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card><CardContent className="pt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Info k="Full name" v={emp.full_name} />
            <Info k="Gender" v={emp.gender} />
            <Info k="Date of birth" v={emp.dob} />
            <Info k="Address" v={emp.address} />
            <Info k="PAN" v={emp.pan} />
            <Info k="Aadhaar" v={emp.aadhaar} />
            <Info k="Emergency contact" v={emp.emergency_contact_name} />
            <Info k="Emergency phone" v={emp.emergency_contact_phone} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="employment">
          <Card><CardContent className="pt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Info k="Employee ID" v={emp.employee_no} />
            <Info k="Department" v={emp.department} />
            <Info k="Designation" v={emp.designation} />
            <Info k="Qualification" v={emp.qualification} />
            <Info k="Joining date" v={emp.joining_date} />
            <Info k="Bank" v={emp.bank_name} />
            <Info k="A/C No" v={emp.bank_account} />
            <Info k="IFSC" v={emp.bank_ifsc} />
            {isAdmin && emp.user_id && (
              <div className="col-span-full">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Change role</Label>
                <Select value={roles[0] ?? ""} onValueChange={doRoleChange}>
                  <SelectTrigger className="max-w-xs"><SelectValue placeholder="Assign role" /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card><CardHeader><CardTitle className="text-base">Last 30 days</CardTitle></CardHeader><CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Check-in</TableHead><TableHead>Check-out</TableHead><TableHead>Shift</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {attendance.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No records</TableCell></TableRow>}
                {attendance.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.check_in ? new Date(a.check_in).toLocaleString() : "—"}</TableCell>
                    <TableCell>{a.check_out ? new Date(a.check_out).toLocaleString() : "—"}</TableCell>
                    <TableCell>{a.shift ?? "—"}</TableCell>
                    <TableCell>{a.working_hours ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{a.status ?? "—"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="leave">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {leaves.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No leave requests</TableCell></TableRow>}
                {leaves.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.leave_type}</TableCell>
                    <TableCell>{l.from_date}</TableCell>
                    <TableCell>{l.to_date}</TableCell>
                    <TableCell><Badge>{l.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Gross</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {payroll.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No payroll yet</TableCell></TableRow>}
                {payroll.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.month}/{p.year}</TableCell>
                    <TableCell>₹ {p.gross_salary ?? 0}</TableCell>
                    <TableCell>₹ {p.net_salary ?? 0}</TableCell>
                    <TableCell><Badge>{p.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
              <TableBody>
                {audit.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No activity</TableCell></TableRow>}
                {audit.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                    <TableCell className="text-xs">{a.entity}</TableCell>
                    <TableCell className="text-xs">{a.user_email ?? a.user_id?.slice(0, 8)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>New temporary password</Label>
            <Input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" />
            <p className="text-xs text-muted-foreground">User will be forced to change on next login.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={doReset}>Reset password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ k, v }: { k: string; v: any }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="font-medium">{v || "—"}</div>
    </div>
  );
}
