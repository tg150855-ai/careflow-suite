import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Settings, BedDouble, Shield, IndianRupee, Building2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/ipd/settings")({ component: IpdSettings });

const IPD_MODULES = [
  { key: "ipd", label: "IPD admissions" },
  { key: "beds", label: "Bed management" },
  { key: "transfers", label: "Patient transfers" },
  { key: "discharge", label: "Discharge summary" },
  { key: "death_register", label: "Death register" },
  { key: "billing", label: "IPD billing" },
] as const;
const ACTIONS = ["view", "create", "edit", "delete", "approve"] as const;
const ROLES = ["admin", "super_admin", "doctor", "nurse", "receptionist", "accountant", "dept_head"] as const;

function IpdSettings() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "super_admin"]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/ipd"><ArrowLeft className="size-4" /></Link></Button>
        <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center"><Settings className="size-4 text-primary" /></div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">IPD settings</h1>
          <p className="text-xs text-muted-foreground">Wards, bed charges and role permissions</p>
        </div>
        {!canManage && <Badge variant="outline" className="ml-auto">Read only</Badge>}
      </div>

      <Tabs defaultValue="wards">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="wards"><Building2 className="size-3.5 mr-1.5" />Ward types</TabsTrigger>
          <TabsTrigger value="charges"><IndianRupee className="size-3.5 mr-1.5" />Bed charges</TabsTrigger>
          <TabsTrigger value="permissions"><Shield className="size-3.5 mr-1.5" />Role permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="wards"><WardTypesTab canManage={canManage} /></TabsContent>
        <TabsContent value="charges"><BedChargesTab canManage={canManage} /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------- Ward types ------------------------------ */
function WardTypesTab({ canManage }: { canManage: boolean }) {
  const { data: wards = [] } = useQuery({
    queryKey: ["settings-wards"],
    queryFn: async () => (await supabase.from("wards").select("id, name, type, floor, description").order("name")).data ?? [],
  });
  const { data: beds = [] } = useQuery({
    queryKey: ["settings-beds-count"],
    queryFn: async () => (await supabase.from("beds").select("id, ward_id, status")).data ?? [],
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { type: string; wards: any[]; bedCount: number; occupied: number }>();
    wards.forEach((w: any) => {
      const cur = map.get(w.type) ?? { type: w.type, wards: [], bedCount: 0, occupied: 0 };
      (cur.wards as any[]).push(w); map.set(w.type, cur);
    });
    beds.forEach((b: any) => {
      const ward = wards.find((w: any) => w.id === b.ward_id);
      if (!ward) return;
      const g = map.get(ward.type); if (!g) return;
      g.bedCount += 1; if (b.status === "occupied") g.occupied += 1;
    });
    return Array.from(map.values());
  }, [wards, beds]);

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Ward types configured</h3>
          <Button asChild size="sm" variant="outline"><Link to="/ipd/beds"><BedDouble className="size-3.5 mr-1.5" />Manage in Bed map</Link></Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Add or remove wards from the Bed map. {!canManage && "Only admins can manage wards."}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {grouped.map((g) => (
            <Card key={g.type} className="p-4 bg-surface-muted/30">
              <Badge variant="secondary" className="capitalize">{g.type.replace("_", " ")}</Badge>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{g.bedCount}</div>
              <div className="text-xs text-muted-foreground">beds across {g.wards.length} ward{g.wards.length > 1 ? "s" : ""}</div>
              <div className="text-xs mt-2">Occupied: {g.occupied} · Available: {g.bedCount - g.occupied}</div>
              <div className="mt-2 text-xs text-muted-foreground truncate">{g.wards.map((w) => w.name).join(", ")}</div>
            </Card>
          ))}
          {grouped.length === 0 && <p className="text-sm text-muted-foreground col-span-3 text-center py-6">No wards configured.</p>}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Bed charges ----------------------------- */
function BedChargesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data: wards = [] } = useQuery({
    queryKey: ["settings-charge-wards"],
    queryFn: async () => (await supabase.from("wards").select("id, name, type, beds(id, bed_number, charge_per_day, status)").order("name")).data ?? [],
  });
  const [edits, setEdits] = useState<Record<string, string>>({});

  const wardCharge = (w: any) => {
    const beds = w.beds ?? [];
    if (!beds.length) return 0;
    return Math.round(beds.reduce((s: number, b: any) => s + Number(b.charge_per_day ?? 0), 0) / beds.length);
  };

  const bulkUpdate = useMutation({
    mutationFn: async ({ wardId, amount }: { wardId: string; amount: number }) => {
      const { error } = await supabase.from("beds").update({ charge_per_day: amount }).eq("ward_id", wardId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Charges updated"); qc.invalidateQueries({ queryKey: ["settings-charge-wards"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Bed charges (per day)</h3>
        {!canManage && <Badge variant="outline">Read only</Badge>}
      </div>
      <p className="text-xs text-muted-foreground mb-4">Set a default per-day charge for every bed in a ward. Individual beds can be fine-tuned in the Bed map.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground bg-surface-muted">
            <tr>
              <th className="text-left font-medium px-3 py-2">Ward</th>
              <th className="text-left font-medium py-2">Type</th>
              <th className="text-right font-medium py-2">Beds</th>
              <th className="text-right font-medium py-2">Current avg</th>
              <th className="text-left font-medium py-2 pl-4">New charge (₹/day)</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {wards.map((w: any) => {
              const cur = wardCharge(w);
              const draft = edits[w.id] ?? "";
              return (
                <tr key={w.id}>
                  <td className="px-3 py-2 font-medium">{w.name}</td>
                  <td className="py-2"><Badge variant="secondary" className="capitalize">{w.type?.replace("_", " ")}</Badge></td>
                  <td className="py-2 text-right tabular-nums">{(w.beds ?? []).length}</td>
                  <td className="py-2 text-right tabular-nums">₹{cur.toLocaleString("en-IN")}</td>
                  <td className="py-2 pl-4">
                    <Input type="number" disabled={!canManage} placeholder={String(cur)} value={draft} onChange={(e) => setEdits({ ...edits, [w.id]: e.target.value })} className="h-9 w-32" />
                  </td>
                  <td className="text-right pr-3 py-2">
                    <Button size="sm" disabled={!canManage || !draft || Number(draft) <= 0 || bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ wardId: w.id, amount: Number(draft) })}>Apply</Button>
                  </td>
                </tr>
              );
            })}
            {wards.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">No wards configured.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ----------------------------- Permissions ------------------------------ */
function PermissionsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["ipd-role-perms"],
    queryFn: async () => (await supabase.from("role_permissions").select("*").in("module", IPD_MODULES.map((m) => m.key))).data ?? [],
  });

  const set = useMemo(() => new Set(rows.map((r: any) => `${r.role}::${r.module}::${r.action}`)), [rows]);

  const toggle = useMutation({
    mutationFn: async ({ role, module, action, on }: { role: string; module: string; action: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("role_permissions").insert({ role: role as any, module, action });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("role_permissions").delete().eq("role", role as any).eq("module", module).eq("action", action);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ipd-role-perms"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 mt-4">
      {IPD_MODULES.map((m) => (
        <Card key={m.key} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{m.label}</h3>
            <Badge variant="outline" className="font-mono text-xs">{m.key}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-surface-muted">
                <tr>
                  <th className="text-left font-medium px-3 py-2 w-44">Role</th>
                  {ACTIONS.map((a) => <th key={a} className="text-center font-medium py-2 capitalize w-24">{a}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y">
                {ROLES.map((role) => (
                  <tr key={role}>
                    <td className="px-3 py-2 capitalize">{role.replace("_", " ")}</td>
                    {ACTIONS.map((action) => {
                      const checked = set.has(`${role}::${m.key}::${action}`);
                      return (
                        <td key={action} className="text-center py-2">
                          <Checkbox
                            checked={checked}
                            disabled={!canManage || (role === "super_admin")}
                            onCheckedChange={(v) => toggle.mutate({ role, module: m.key, action, on: !!v })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">Super admin always has full access and cannot be edited here.</p>
    </div>
  );
}
