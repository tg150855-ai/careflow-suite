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
import { ArrowLeft, Settings, BedDouble, Shield, IndianRupee, Building2, FileText, Plus, Trash2, Search, Sparkles } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fetchDischargeTemplates, saveDischargeTemplate, deleteDischargeTemplate, DischargeTemplateItem } from "@/lib/discharge-templates";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

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
          <TabsTrigger value="templates"><FileText className="size-3.5 mr-1.5" />Discharge templates</TabsTrigger>
          <TabsTrigger value="permissions"><Shield className="size-3.5 mr-1.5" />Role permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="wards"><WardTypesTab canManage={canManage} /></TabsContent>
        <TabsContent value="charges"><BedChargesTab canManage={canManage} /></TabsContent>
        <TabsContent value="templates"><DischargeTemplatesTab canManage={canManage} /></TabsContent>
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

/* ------------------------ Discharge Templates Tab ------------------------- */
function DischargeTemplatesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const queryKey = ["discharge-templates", "settings"];

  const { data: templates = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDischargeTemplates(),
  });

  const [search, setSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DischargeTemplateItem | null>(null);

  // Form states for creating/editing template
  const [name, setName] = useState("");
  const [category, setCategory] = useState("General Surgery");
  const [primaryDx, setPrimaryDx] = useState("");
  const [secondaryDx, setSecondaryDx] = useState("");
  const [notes, setNotes] = useState("");
  const [course, setCourse] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [days, setDays] = useState(7);
  const [meds, setMeds] = useState<any[]>([]);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.primary_diagnosis.toLowerCase().includes(q)
    );
  }, [templates, search]);

  const openNew = () => {
    setEditingTemplate(null);
    setName("");
    setCategory("General Surgery");
    setPrimaryDx("");
    setSecondaryDx("");
    setNotes("");
    setCourse("");
    setFollowUp("Review in OPD after 7 days.");
    setDays(7);
    setMeds([
      { medicine_name: "", dose: "", route: "Oral", frequency: "1-0-1", duration: "5 days", instructions: "After meals" },
    ]);
    setEditDialogOpen(true);
  };

  const openEdit = (tpl: DischargeTemplateItem) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setCategory(tpl.category || "General");
    setPrimaryDx(tpl.primary_diagnosis);
    setSecondaryDx(tpl.secondary_diagnosis || "");
    setNotes(tpl.doctor_notes || "");
    setCourse(tpl.hospital_course || "");
    setFollowUp(tpl.follow_up_instructions || "");
    setDays(tpl.follow_up_days || 7);
    setMeds(
      (tpl.medicines || []).map((m) => ({
        medicine_name: m.medicine_name,
        dose: m.dose || m.dosage || "",
        route: m.route || "Oral",
        frequency: m.frequency || "1-0-1",
        duration: m.duration || "5 days",
        instructions: m.instructions || "",
      }))
    );
    setEditDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Template name is required");
      if (!primaryDx.trim()) throw new Error("Primary diagnosis is required");

      const cleanMeds = meds
        .filter((m) => m.medicine_name.trim())
        .map((m) => ({
          medicine_name: m.medicine_name.trim(),
          dose: m.dose || "",
          dosage: m.dose || "",
          route: m.route || "Oral",
          frequency: m.frequency || "1-0-1",
          duration: m.duration || "5 days",
          instructions: m.instructions || "",
        }));

      return saveDischargeTemplate({
        id: editingTemplate?.id,
        name: name.trim(),
        category: category.trim() || "General",
        primary_diagnosis: primaryDx.trim(),
        secondary_diagnosis: secondaryDx.trim() || undefined,
        doctor_notes: notes.trim() || undefined,
        hospital_course: course.trim() || undefined,
        follow_up_instructions: followUp.trim() || undefined,
        follow_up_days: Number(days) || 7,
        condition_at_discharge: "Stable",
        medicines: cleanMeds,
      });
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["discharge-templates"] });
      toast.success(`Discharge template "${saved.name}" saved!`);
      setEditDialogOpen(false);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to save template"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDischargeTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discharge-templates"] });
      toast.success("Discharge template deleted");
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete template"),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="font-semibold text-base">Discharge Summary Templates</h3>
            <p className="text-xs text-muted-foreground">
              Configure standard and department-wise discharge summary templates with auto-fill fields & prescriptions.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openNew}>
              <Plus className="size-3.5 mr-1.5" />
              New Template
            </Button>
          )}
        </div>

        <div className="relative mb-4">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search templates by title, department, or diagnosis…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((t) => {
            const isStandard = t.id.startsWith("dtpl-") && !t.id.startsWith("dtpl-custom-");
            return (
              <Card key={t.id} className="p-4 flex flex-col justify-between hover:border-primary/50 transition-colors">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm leading-snug">{t.name}</h4>
                      <Badge variant="secondary" className="text-[10px] mt-1">
                        {t.category || "General"}
                      </Badge>
                      {isStandard && (
                        <Badge variant="outline" className="text-[10px] ml-1.5">
                          Standard
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>
                      <span className="font-medium text-foreground">Primary Dx:</span> {t.primary_diagnosis}
                    </div>
                    {t.secondary_diagnosis && (
                      <div className="truncate">
                        <span className="font-medium text-foreground">Secondary:</span> {t.secondary_diagnosis}
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-foreground">Follow-up:</span>{" "}
                      {t.follow_up_days ? `${t.follow_up_days} days` : "Routine"}
                    </div>
                    <div className="pt-1">
                      <span className="font-medium text-foreground">Prescription ({t.medicines?.length || 0}):</span>{" "}
                      <span className="line-clamp-1">
                        {t.medicines?.map((m) => m.medicine_name).join(", ") || "No preloaded meds"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t mt-3">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(t)}>
                    Edit / View
                  </Button>
                  {canManage && !isStandard && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(t.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 text-center py-10 text-xs text-muted-foreground">
              No discharge templates found.
            </div>
          )}
        </div>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Discharge Template" : "New Discharge Template"}</DialogTitle>
            <DialogDescription>
              Discharge fields and take-home medications configured here will auto-fill whenever doctors select this template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Template Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Laparoscopic Appendectomy" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Department / Category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. General Surgery" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Primary Diagnosis *</Label>
              <Textarea rows={2} value={primaryDx} onChange={(e) => setPrimaryDx(e.target.value)} placeholder="Primary diagnosis..." />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Secondary Diagnosis (optional)</Label>
              <Textarea rows={2} value={secondaryDx} onChange={(e) => setSecondaryDx(e.target.value)} placeholder="Comorbidities, operative notes, secondary findings..." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Doctor's Notes & Advice</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Post-op instructions, dietary advice, wound care..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hospital Course Summary</Label>
                <Textarea rows={3} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Brief summary of admission, interventions, response to treatment..." />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Follow-up Days</Label>
                <Input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value) || 7)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Follow-up Instructions</Label>
                <Input value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="e.g. Review in OPD for suture removal" />
              </div>
            </div>

            {/* Template prescription medicines */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Preloaded Take-Home Medicines</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setMeds([
                      ...meds,
                      { medicine_name: "", dose: "", route: "Oral", frequency: "1-0-1", duration: "5 days", instructions: "After meals" },
                    ])
                  }
                >
                  <Plus className="size-3 mr-1" /> Add medicine
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {meds.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-center border rounded p-1.5 bg-muted/20">
                    <Input
                      className="col-span-4 h-7 text-xs"
                      placeholder="Medicine name"
                      value={m.medicine_name}
                      onChange={(e) => {
                        const copy = [...meds];
                        copy[idx].medicine_name = e.target.value;
                        setMeds(copy);
                      }}
                    />
                    <Input
                      className="col-span-2 h-7 text-xs"
                      placeholder="Dose"
                      value={m.dose}
                      onChange={(e) => {
                        const copy = [...meds];
                        copy[idx].dose = e.target.value;
                        setMeds(copy);
                      }}
                    />
                    <Input
                      className="col-span-2 h-7 text-xs"
                      placeholder="Frequency"
                      value={m.frequency}
                      onChange={(e) => {
                        const copy = [...meds];
                        copy[idx].frequency = e.target.value;
                        setMeds(copy);
                      }}
                    />
                    <Input
                      className="col-span-3 h-7 text-xs"
                      placeholder="Duration"
                      value={m.duration}
                      onChange={(e) => {
                        const copy = [...meds];
                        copy[idx].duration = e.target.value;
                        setMeds(copy);
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="col-span-1 size-7 text-muted-foreground hover:text-destructive justify-self-end"
                      onClick={() => setMeds(meds.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                {meds.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-3 border border-dashed rounded">
                    No medications configured in this template.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

