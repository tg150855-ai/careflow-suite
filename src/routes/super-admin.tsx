import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, Building2, CheckCircle2, Loader2, LogOut, Pause, Plus, Search,
  Settings2, ShieldCheck, Trash2, Users, XCircle, KeyRound, Pencil,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { superAdminOps } from "@/lib/super-admin-api";
import { MODULE_REGISTRY, MODULE_PRESETS, ALL_MODULE_KEYS, type ModuleKey } from "@/lib/modules";
import type { HospitalRow } from "@/lib/use-my-hospital";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/super-admin")({ component: SuperAdminConsole });

type UserRow = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  hospital_id: string | null; login_disabled: boolean | null; created_at: string | null; roles: string[];
};

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  suspended: "bg-orange-50 text-orange-700 border-orange-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

function SuperAdminConsole() {
  const { session, roles, loading, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isSuper = roles.includes("super_admin");
  const [section, setSection] = useState<"overview" | "hospitals" | "approvals" | "users">("overview");
  const [q, setQ] = useState("");
  const [elevating, setElevating] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.error("Enter your email and password");
      return;
    }
    setLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) throw error;
      toast.success("Signed in successfully");
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoggingIn(false);
    }
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["super-admin", "list"],
    enabled: !!session && isSuper,
    queryFn: () => superAdminOps<{ hospitals: HospitalRow[]; users: UserRow[] }>({ action: "list" }),
  });

  const hospitals = data?.hospitals ?? [];
  const users = data?.users ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ["super-admin", "list"] });

  const [editing, setEditing] = useState<HospitalRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [modulesFor, setModulesFor] = useState<HospitalRow | null>(null);
  const [usersFor, setUsersFor] = useState<HospitalRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HospitalRow | null>(null);

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      superAdminOps({ action: "set_status", hospital_id: v.id, status: v.status }),
    onSuccess: (_d, v) => { toast.success(`Hospital ${v.status}`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => superAdminOps({ action: "delete_hospital", hospital_id: id, delete_users: true }),
    onSuccess: () => { toast.success("Hospital deleted"); setConfirmDelete(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = hospitals.filter((h) => (h.status ?? "pending") === "pending");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = section === "approvals" ? pending : hospitals;
    if (!needle) return base;
    return base.filter((h) =>
      [h.hospital_name, h.email, h.city, h.owner_name].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [q, hospitals, pending, section]);

  async function handleElevate() {
    if (!session?.user?.id) return;
    setElevating(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: session.user.id, role: "super_admin" as any });
      if (error && !error.message?.includes("duplicate")) {
        toast.error(`Could not grant role directly: ${error.message}`);
        return;
      }
      toast.success("Super admin role activated! Refreshing console...");
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (e: any) {
      toast.error(e?.message ?? "Elevation failed");
    } finally {
      setElevating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in: Show Super Admin Sign In in Light Theme
  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50/70 p-6 text-slate-900">
        <Helmet>
          <title>Super Admin Sign In — SBG Arogya Plus</title>
        </Helmet>
        <Card className="max-w-md w-full bg-white border-slate-200 shadow-xl rounded-2xl">
          <CardHeader className="text-center pb-2">
            <div className="size-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 border border-indigo-100 shadow-xs">
              <ShieldCheck className="size-8" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">Super Admin Portal</CardTitle>
            <p className="text-xs text-slate-500">Sign in to manage hospitals, tenants, and platform settings</p>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Email Address</Label>
                <Input
                  type="email"
                  placeholder="superadmin@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 focus-visible:ring-indigo-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="bg-white border-slate-200 text-slate-900 focus-visible:ring-indigo-500"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loggingIn}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition"
              >
                {loggingIn ? <Loader2 className="size-4 animate-spin mr-2" /> : <KeyRound className="size-4 mr-2" />}
                {loggingIn ? "Authenticating..." : "Sign In to Super Admin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in, but not yet Super Admin: Light Mode
  if (!isSuper) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50/70 p-6 text-slate-900">
        <Card className="max-w-md w-full bg-white border-slate-200 shadow-xl rounded-2xl">
          <CardContent className="pt-8 pb-6 space-y-4 text-center">
            <div className="size-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
              <ShieldCheck className="size-8" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Super admin only</h1>
              <p className="text-sm text-slate-500 mt-1">This console is restricted to platform super administrators.</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-left space-y-1">
              <div><span className="text-slate-500">Signed in as:</span> <b className="text-slate-800">{session?.user?.email}</b></div>
              <div><span className="text-slate-500">Current roles:</span> <span className="text-indigo-600 capitalize font-medium">{roles.join(", ") || "No role"}</span></div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="default"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                onClick={handleElevate}
                disabled={elevating}
              >
                {elevating ? <Loader2 className="size-4 animate-spin mr-2" /> : <KeyRound className="size-4 mr-2" />}
                {elevating ? "Activating..." : "Grant Super Admin to this Account"}
              </Button>
              <Button variant="ghost" className="text-slate-600 hover:text-slate-900" onClick={() => navigate({ to: "/dashboard" })}>
                Back to hospital app
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nav = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "hospitals", label: "Hospitals", icon: Building2 },
    { key: "approvals", label: `Approvals${pending.length ? ` (${pending.length})` : ""}`, icon: CheckCircle2 },
    { key: "users", label: "Users", icon: Users },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex">
      <Helmet>
        <title>Super Admin Console — SBG Arogya Plus</title>
        <meta name="description" content="Platform super admin console to create, approve, suspend and configure hospital tenants." />
      </Helmet>

      {/* Light sidebar */}
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white hidden md:flex flex-col">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-900">
            <div className="size-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <ShieldCheck className="size-4" />
            </div>
            SUPER ADMIN
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Platform control plane</p>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {nav.map((n) => (
            <button key={n.key} onClick={() => setSection(n.key)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition font-medium ${
                section === n.key ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "text-slate-600 hover:bg-slate-50"}`}>
              <n.icon className={`size-4 ${section === n.key ? "text-indigo-600" : "text-slate-400"}`} /> {n.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 space-y-2 bg-slate-50/50">
          <div className="text-xs text-slate-600 font-medium px-2 truncate">{profile?.full_name ?? session.user.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-white"
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
            <LogOut className="size-4 mr-2 text-slate-400" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="border-b border-slate-200 bg-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl font-semibold text-slate-900">
              {section === "overview" ? "Platform overview" : section === "hospitals" ? "Hospitals" : section === "approvals" ? "Pending approvals" : "All users"}
            </h1>
            <p className="text-xs text-slate-500">Manage every hospital tenant, their modules and their logins.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {section !== "overview" && section !== "users" && (
              <div className="relative">
                <Search className="size-4 absolute left-2.5 top-2.5 text-slate-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hospitals…"
                  className="pl-8 w-56 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 h-9 text-xs" />
              </div>
            )}
            {section === "hospitals" && (
              <Button size="sm" onClick={() => setCreating(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs">
                <Plus className="size-4 mr-1.5" /> New hospital
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-slate-600 hover:text-slate-900 border-slate-200"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              Hospital App
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 font-medium"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="size-4 mr-1.5" /> Logout
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* mobile nav */}
          <div className="md:hidden flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex gap-2">
              {nav.map((n) => (
                <Button key={n.key} size="sm" variant={section === n.key ? "default" : "outline"} onClick={() => setSection(n.key)}>{n.label}</Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="size-3.5 mr-1" /> Logout
            </Button>
          </div>

          {error && <p className="text-sm text-rose-600 font-medium">{(error as Error).message}</p>}
          {isLoading && <Loader2 className="size-5 animate-spin text-slate-400" />}

          {section === "overview" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Hospitals", value: hospitals.length, icon: Building2 },
                { label: "Approved", value: hospitals.filter((h) => h.status === "approved").length, icon: CheckCircle2 },
                { label: "Pending approval", value: pending.length, icon: Pause },
                { label: "Platform users", value: users.length, icon: Users },
              ].map((k) => (
                <Card key={k.label} className="bg-white border-slate-200 shadow-xs hover:shadow-sm transition">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-slate-900 tracking-tight">{k.value}</div>
                        <div className="text-xs text-slate-500 mt-1 font-medium">{k.label}</div>
                      </div>
                      <div className="size-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                        <k.icon className="size-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {(section === "hospitals" || section === "approvals") && (
            <div className="grid gap-4">
              {filtered.length === 0 && !isLoading && (
                <p className="text-sm text-slate-500">No hospitals found.</p>
              )}
              {filtered.map((h) => {
                const status = h.status ?? "pending";
                const mods = Array.isArray(h.enabled_modules) ? (h.enabled_modules as string[]) : [];
                const staff = users.filter((u) => u.hospital_id === h.id);
                return (
                  <Card key={h.id} className="bg-white border-slate-200 shadow-xs hover:shadow-sm transition">
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2 text-slate-900 font-semibold">
                            {h.hospital_name}
                            <Badge className={`border ${STATUS_STYLES[status] ?? ""} capitalize text-[11px]`}>{status}</Badge>
                          </CardTitle>
                          <p className="text-xs text-slate-500 mt-1">
                            {h.email} · {h.city ?? "—"} · {staff.length} user{staff.length === 1 ? "" : "s"} · {mods.length} module{mods.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {status !== "approved" && (
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                              onClick={() => statusMut.mutate({ id: h.id, status: "approved" })}>
                              <CheckCircle2 className="size-4 mr-1.5" /> Approve
                            </Button>
                          )}
                          {status === "approved" && (
                            <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: h.id, status: "suspended" })}>
                              <Pause className="size-4 mr-1.5" /> Suspend
                            </Button>
                          )}
                          {status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: h.id, status: "rejected" })}>
                              <XCircle className="size-4 mr-1.5" /> Reject
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setModulesFor(h)}>
                            <Settings2 className="size-4 mr-1.5" /> Modules
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setUsersFor(h)}>
                            <Users className="size-4 mr-1.5" /> Logins
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing(h)}>
                            <Pencil className="size-4 mr-1.5" /> Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(h)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {mods.length > 0 && (
                      <CardContent className="pt-0 flex flex-wrap gap-1.5">
                        {mods.map((m) => (
                          <Badge key={m} variant="secondary" className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                            {MODULE_REGISTRY.find((r) => r.key === m)?.name ?? m}
                          </Badge>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {section === "users" && (
            <Card className="bg-white border-slate-200 shadow-xs">
              <CardContent className="pt-6 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 border-b border-slate-100 bg-slate-50/60">
                    <tr><th className="text-left p-2.5 font-medium">Name</th><th className="text-left p-2.5 font-medium">Email</th><th className="text-left p-2.5 font-medium">Hospital</th><th className="text-left p-2.5 font-medium">Roles</th><th className="p-2.5" /></tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="p-2.5 font-medium text-slate-900">{u.full_name ?? "—"}</td>
                        <td className="p-2.5 text-slate-600">{u.email ?? "—"}</td>
                        <td className="p-2.5 text-slate-600">{hospitals.find((h) => h.id === u.hospital_id)?.hospital_name ?? "—"}</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length ? u.roles.map((r) => <Badge key={r} variant="secondary" className="bg-slate-100 text-slate-700 text-[10px] border border-slate-200">{r}</Badge>) : <span className="text-slate-400 text-xs">no role</span>}
                          </div>
                        </td>
                        <td className="p-2.5 text-right">
                          <UserRowActions user={u} onDone={refresh} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {(creating || editing) && (
        <HospitalDialog
          hospital={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={refresh}
        />
      )}
      {modulesFor && <ModulesDialog hospital={modulesFor} onClose={() => setModulesFor(null)} onSaved={refresh} />}
      {usersFor && (
        <HospitalUsersDialog
          hospital={usersFor}
          users={users.filter((u) => u.hospital_id === usersFor.id)}
          onClose={() => setUsersFor(null)}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.hospital_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the hospital and all of its user logins. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}>
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserRowActions({ user, onDone }: { user: UserRow; onDone: () => void }) {
  const [pwd, setPwd] = useState("");
  const [open, setOpen] = useState(false);
  const reset = useMutation({
    mutationFn: () => superAdminOps({ action: "set_user_password", user_id: user.id, password: pwd }),
    onSuccess: () => { toast.success("Password updated"); setOpen(false); setPwd(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => superAdminOps({ action: "delete_user", user_id: user.id }),
    onSuccess: () => { toast.success("User deleted"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><KeyRound className="size-4" /></Button>
      <Button size="sm" variant="ghost" className="text-rose-400" onClick={() => del.mutate()}><Trash2 className="size-4" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password — {user.email}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>New password</Label>
            <Input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="min 6 characters" />
          </div>
          <DialogFooter>
            <Button onClick={() => reset.mutate()} disabled={pwd.length < 6 || reset.isPending}>Update password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HospitalDialog({ hospital, onClose, onSaved }: { hospital: HospitalRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    hospital_name: hospital?.hospital_name ?? "",
    owner_name: hospital?.owner_name ?? "",
    email: hospital?.email ?? "",
    phone: hospital?.phone ?? "",
    city: hospital?.city ?? "",
    state: hospital?.state ?? "",
    address: hospital?.address ?? "",
    subscription_plan: hospital?.subscription_plan ?? "Professional",
    max_users: hospital?.max_users ?? 25,
    expiry_date: hospital?.expiry_date ?? "",
    notes: hospital?.notes ?? "",
  });
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        max_users: Number(form.max_users) || 25,
        expiry_date: form.expiry_date || null,
      };
      if (hospital) return superAdminOps({ action: "update_hospital", hospital_id: hospital.id, hospital: payload });
      return superAdminOps({
        action: "create_hospital",
        hospital: { ...payload, status: "approved", enabled_modules: [] },
        ...(password ? { admin_password: password } : {}),
      });
    },
    onSuccess: () => { toast.success(hospital ? "Hospital updated" : "Hospital created"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{hospital ? "Edit hospital" : "New hospital"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
          <Field label="Hospital name"><Input value={form.hospital_name} onChange={(e) => set("hospital_name", e.target.value)} /></Field>
          <Field label="Owner / admin name"><Input value={form.owner_name ?? ""} onChange={(e) => set("owner_name", e.target.value)} /></Field>
          <Field label="Admin email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={!!hospital} /></Field>
          <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="City"><Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="State"><Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} /></Field>
          <Field label="Plan"><Input value={form.subscription_plan ?? ""} onChange={(e) => set("subscription_plan", e.target.value)} /></Field>
          <Field label="Max users"><Input type="number" value={form.max_users} onChange={(e) => set("max_users", e.target.value)} /></Field>
          <Field label="Expiry date"><Input type="date" value={form.expiry_date ?? ""} onChange={(e) => set("expiry_date", e.target.value)} /></Field>
          {!hospital && (
            <Field label="Admin login password (optional)">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Creates the hospital admin login" />
            </Field>
          )}
          <div className="sm:col-span-2">
            <Field label="Address"><Textarea rows={2} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Internal notes"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.hospital_name || !form.email || save.isPending}>
            {save.isPending && <Loader2 className="size-4 mr-2 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROLE_OPTIONS = ["admin", "doctor", "nurse", "receptionist", "pharmacist", "lab_tech", "accountant", "hr_manager", "finance_manager", "dept_head"];

function ModulesDialog({ hospital, onClose, onSaved }: { hospital: HospitalRow; onClose: () => void; onSaved: () => void }) {
  const initial = Array.isArray(hospital.enabled_modules) ? (hospital.enabled_modules as string[]) : [];
  const initialRoles = Array.isArray(hospital.allowed_roles) ? (hospital.allowed_roles as string[]) : [];
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [allowedRoles, setAllowedRoles] = useState<Set<string>>(new Set(initialRoles));
  const [maxUsers, setMaxUsers] = useState<string>(String(hospital.max_users ?? 25));
  const toggle = (k: ModuleKey) =>
    setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleRole = (r: string) =>
    setAllowedRoles((s) => { const n = new Set(s); n.has(r) ? n.delete(r) : n.add(r); return n; });

  const save = useMutation({
    mutationFn: async () => {
      await superAdminOps({ action: "set_modules", hospital_id: hospital.id, modules: [...selected] });
      await superAdminOps({
        action: "update_hospital",
        hospital_id: hospital.id,
        hospital: { allowed_roles: [...allowedRoles], max_users: Number(maxUsers) || 25 },
      });
    },
    onSuccess: () => { toast.success("Access updated"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Access — {hospital.hospital_name}</DialogTitle></DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto space-y-5 pr-1">
          <div className="space-y-2">
            <div className="text-sm font-medium">Login limit</div>
            <Input type="number" min={1} value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} className="w-40" />
            <p className="text-xs text-muted-foreground">Maximum number of logins this hospital can create.</p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Allowed login roles</div>
            <p className="text-xs text-muted-foreground">Leave all unchecked to allow every role.</p>
            <div className="grid sm:grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((r) => (
                <label key={r} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer">
                  <Checkbox checked={allowedRoles.has(r)} onCheckedChange={() => toggleRole(r)} />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Allowed modules</div>
            <div className="flex flex-wrap gap-2 pb-1">
              {MODULE_PRESETS.map((p) => (
                <Button key={p.key} size="sm" variant="secondary" onClick={() => setSelected(new Set(p.modules))}>{p.name}</Button>
              ))}
              <Button size="sm" variant="secondary" onClick={() => setSelected(new Set(ALL_MODULE_KEYS))}>Select all</Button>
              <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {MODULE_REGISTRY.map((m) => (
                <label key={m.key} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer">
                  <Checkbox checked={selected.has(m.key)} onCheckedChange={() => toggle(m.key)} />
                  {m.name}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save access</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function HospitalUsersDialog({ hospital, users, onClose, onSaved }: { hospital: HospitalRow; users: UserRow[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "admin" });
  const create = useMutation({
    mutationFn: () => superAdminOps({ action: "create_user", hospital_id: hospital.id, ...form }),
    onSuccess: () => { toast.success("Login created"); setForm({ full_name: "", email: "", password: "", role: "admin" }); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Logins — {hospital.hospital_name}</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-[35vh] overflow-y-auto">
          {users.length === 0 && <p className="text-sm text-muted-foreground">No logins yet.</p>}
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <div className="font-medium">{u.full_name ?? u.email}</div>
                <div className="text-xs text-muted-foreground">{u.email} · {u.roles.join(", ") || "no role"}</div>
              </div>
              <UserRowActions user={u} onDone={onSaved} />
            </div>
          ))}
        </div>
        <div className="border-t pt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Password"><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={() => create.mutate()} disabled={!form.email || form.password.length < 6 || create.isPending}>
            <Plus className="size-4 mr-1.5" /> Create login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
