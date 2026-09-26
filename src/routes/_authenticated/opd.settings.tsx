import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Settings, Stethoscope, Shield, IndianRupee, Clock,
  LayoutTemplate, Plus, Trash2, Search, DoorOpen, Save,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDoctorTemplates, saveDoctorTemplate, deleteDoctorTemplate,
  ConsultationTemplateItem,
} from "@/lib/consultation-templates";

export const Route = createFileRoute("/_authenticated/opd/settings")({
  component: OpdSettings,
});

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";
const LOCAL_OPD_CONFIG_KEY = "careflow_opd_operational_settings";

interface OpdConfig {
  default_fee: number;
  follow_up_days: number;
  token_prefix: string;
  slot_duration_mins: number;
  auto_generate_token: boolean;
  enable_voice_dictation: boolean;
  enable_whatsapp_rx: boolean;
  follow_up_free: boolean;
}

const DEFAULT_OPD_CONFIG: OpdConfig = {
  default_fee: 500,
  follow_up_days: 7,
  token_prefix: "OPD",
  slot_duration_mins: 15,
  auto_generate_token: true,
  enable_voice_dictation: true,
  enable_whatsapp_rx: true,
  follow_up_free: true,
};

const OPD_MODULES = [
  { key: "appointments", label: "Appointments & Booking" },
  { key: "registration", label: "Patient Registration (OPD)" },
  { key: "consultation", label: "Doctor Consultation Desk" },
  { key: "queue", label: "Queue & Token Calling" },
  { key: "opd_billing", label: "OPD Billing & Invoices" },
  { key: "prescriptions", label: "Prescription Management" },
] as const;

const ACTIONS = ["view", "create", "edit", "delete"] as const;
const ROLES = ["admin", "super_admin", "doctor", "nurse", "receptionist", "accountant"] as const;

function OpdSettings() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "super_admin"]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/opd/consultation"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="size-4 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">OPD Settings</h1>
          <p className="text-xs text-muted-foreground">
            Consultation defaults, templates, consultation cabins, and staff permissions
          </p>
        </div>
        {!canManage && <Badge variant="outline" className="ml-auto">Read only</Badge>}
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">
            <Stethoscope className="size-3.5 mr-1.5" />General Defaults
          </TabsTrigger>
          <TabsTrigger value="templates">
            <LayoutTemplate className="size-3.5 mr-1.5" />Consultation Templates
          </TabsTrigger>
          <TabsTrigger value="cabins">
            <DoorOpen className="size-3.5 mr-1.5" />Cabins & Rooms
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Shield className="size-3.5 mr-1.5" />Role Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralTab canManage={canManage} /></TabsContent>
        <TabsContent value="templates"><TemplatesTab canManage={canManage} /></TabsContent>
        <TabsContent value="cabins"><CabinsTab canManage={canManage} /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------ General OPD Tab ------------------------- */
function GeneralTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();

  const { data: config = DEFAULT_OPD_CONFIG, isLoading } = useQuery<OpdConfig>({
    queryKey: ["opd-settings-general"],
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from("hospital_settings")
          .select("prescription")
          .eq("id", SETTINGS_ID)
          .maybeSingle();

        const stored = localStorage.getItem(LOCAL_OPD_CONFIG_KEY);
        const local = stored ? JSON.parse(stored) : {};
        const remote = data?.prescription?.opd_config || {};
        return { ...DEFAULT_OPD_CONFIG, ...local, ...remote };
      } catch {
        return DEFAULT_OPD_CONFIG;
      }
    },
  });

  const [form, setForm] = useState<OpdConfig>(config);

  // Sync state once fetched
  useMemo(() => {
    if (config) setForm(config);
  }, [config]);

  const save = useMutation({
    mutationFn: async () => {
      localStorage.setItem(LOCAL_OPD_CONFIG_KEY, JSON.stringify(form));
      try {
        const { data: existing } = await (supabase as any)
          .from("hospital_settings")
          .select("prescription")
          .eq("id", SETTINGS_ID)
          .maybeSingle();

        const updatedPrescription = {
          ...(existing?.prescription || {}),
          opd_config: form,
        };

        await (supabase as any)
          .from("hospital_settings")
          .update({ prescription: updatedPrescription })
          .eq("id", SETTINGS_ID);
      } catch {
        // Saved to localStorage even if settings row doesn't have custom schema
      }
    },
    onSuccess: () => {
      toast.success("OPD settings saved successfully");
      qc.invalidateQueries({ queryKey: ["opd-settings-general"] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save settings"),
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading settings…</div>;

  return (
    <Card className="p-6 space-y-6 mt-4">
      <div>
        <h3 className="font-semibold text-base">OPD Operational Defaults</h3>
        <p className="text-xs text-muted-foreground">Configure default fees, token prefixes, follow-up durations, and workflow options.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label className="text-xs">Default Consultation Fee (₹)</Label>
          <Input
            type="number"
            disabled={!canManage}
            value={form.default_fee}
            onChange={(e) => setForm({ ...form, default_fee: Number(e.target.value) || 0 })}
          />
          <p className="text-[11px] text-muted-foreground">Pre-filled when registering a new walk-in OPD appointment.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Follow-Up Validity Duration (Days)</Label>
          <Input
            type="number"
            disabled={!canManage}
            value={form.follow_up_days}
            onChange={(e) => setForm({ ...form, follow_up_days: Number(e.target.value) || 7 })}
          />
          <p className="text-[11px] text-muted-foreground">Standard interval suggested for routine review visits.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Token Prefix</Label>
          <Input
            disabled={!canManage}
            value={form.token_prefix}
            onChange={(e) => setForm({ ...form, token_prefix: e.target.value })}
            placeholder="OPD"
          />
          <p className="text-[11px] text-muted-foreground">Prefix before token numbers (e.g. OPD-01, OPD-02).</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Consultation Slot Duration (Minutes)</Label>
          <Input
            type="number"
            disabled={!canManage}
            value={form.slot_duration_mins}
            onChange={(e) => setForm({ ...form, slot_duration_mins: Number(e.target.value) || 15 })}
          />
          <p className="text-[11px] text-muted-foreground">Estimated time allocated per patient slot.</p>
        </div>
      </div>

      <div className="space-y-3 pt-3 border-t">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workflow & Communication</h4>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div>
            <div className="text-sm font-medium">Auto-generate Token on Appointment Check-In</div>
            <div className="text-xs text-muted-foreground">Automatically add patient to OPD calling queue upon arrival.</div>
          </div>
          <Switch
            disabled={!canManage}
            checked={form.auto_generate_token}
            onCheckedChange={(v) => setForm({ ...form, auto_generate_token: v })}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div>
            <div className="text-sm font-medium">Free / Discounted Follow-Up Within Validity</div>
            <div className="text-xs text-muted-foreground">Do not charge consultation fee for return visits within {form.follow_up_days} days.</div>
          </div>
          <Switch
            disabled={!canManage}
            checked={form.follow_up_free}
            onCheckedChange={(v) => setForm({ ...form, follow_up_free: v })}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div>
            <div className="text-sm font-medium">Enable Speech / Voice Dictation for Doctors</div>
            <div className="text-xs text-muted-foreground">Show microphone icon in consultation clinical finding & notes fields.</div>
          </div>
          <Switch
            disabled={!canManage}
            checked={form.enable_voice_dictation}
            onCheckedChange={(v) => setForm({ ...form, enable_voice_dictation: v })}
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
          <div>
            <div className="text-sm font-medium">Enable WhatsApp Share for OPD Prescriptions</div>
            <div className="text-xs text-muted-foreground">Directly share Rx instructions and medicines to patient WhatsApp numbers.</div>
          </div>
          <Switch
            disabled={!canManage}
            checked={form.enable_whatsapp_rx}
            onCheckedChange={(v) => setForm({ ...form, enable_whatsapp_rx: v })}
          />
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end pt-3 border-t">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="size-4 mr-1.5" />
            {save.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------ Consultation Templates Tab ------------------------- */
function TemplatesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConsultationTemplateItem | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["doctor-consultation-templates"],
    queryFn: () => fetchDoctorTemplates(),
  });

  const [form, setForm] = useState<ConsultationTemplateItem>({
    name: "",
    chief_complaint: "",
    clinical_findings: "",
    diagnosis: "",
    advice: "",
    follow_up_days: "5",
    medicines: [],
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.diagnosis || "").toLowerCase().includes(q)
    );
  }, [templates, search]);

  const openNew = () => {
    setEditingTemplate(null);
    setForm({
      name: "",
      chief_complaint: "",
      clinical_findings: "",
      diagnosis: "",
      advice: "",
      follow_up_days: "5",
      medicines: [],
    });
    setEditOpen(true);
  };

  const openEdit = (t: ConsultationTemplateItem) => {
    setEditingTemplate(t);
    setForm({ ...t, medicines: [...(t.medicines || [])] });
    setEditOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Template name is required");
      return saveDoctorTemplate(form);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["doctor-consultation-templates"] });
      toast.success(`Template "${saved.name}" saved!`);
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteDoctorTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-consultation-templates"] });
      toast.success("Template deleted");
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete template"),
  });

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="font-semibold text-base">OPD Consultation & Prescription Templates</h3>
            <p className="text-xs text-muted-foreground">
              Standard disease and condition templates with pre-configured findings, advice, and medicines.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openNew}>
              <Plus className="size-3.5 mr-1.5" />New Template
            </Button>
          )}
        </div>

        <div className="relative mb-4">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search templates by condition name or diagnosis…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((t, idx) => (
            <Card key={t.id || idx} className="p-4 flex flex-col justify-between hover:border-primary/50 transition-colors">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm leading-snug">{t.name}</h4>
                  <Badge variant="secondary" className="text-[10px]">
                    {t.follow_up_days ? `Follow-up ${t.follow_up_days}d` : "Routine"}
                  </Badge>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div><span className="font-medium text-foreground">Diagnosis:</span> {t.diagnosis || "—"}</div>
                  {t.chief_complaint && (
                    <div className="truncate"><span className="font-medium text-foreground">Complaints:</span> {t.chief_complaint}</div>
                  )}
                  {t.advice && (
                    <div className="truncate"><span className="font-medium text-foreground">Advice:</span> {t.advice}</div>
                  )}
                  <div className="pt-1">
                    <span className="font-medium text-foreground">Preloaded Medicines ({t.medicines?.length || 0}):</span>{" "}
                    <span className="line-clamp-1">{t.medicines?.map((m: any) => m.medicine_name).join(", ") || "None"}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t mt-3">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(t)}>
                  View / Edit
                </Button>
                {canManage && t.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete template "${t.name}"?`)) deleteMutation.mutate(t.id!);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Edit / New Template Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Consultation Template" : "New Consultation Template"}</DialogTitle>
            <DialogDescription>Preconfigure complaints, diagnosis, doctor advice, and medicines.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="space-y-1">
              <Label className="text-xs">Template Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Acute Gastritis, Hypertension Review"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Standard Diagnosis</Label>
                <Input
                  value={form.diagnosis || ""}
                  onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                  placeholder="Primary diagnosis"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Follow-up Days</Label>
                <Input
                  value={form.follow_up_days || "5"}
                  onChange={(e) => setForm({ ...form, follow_up_days: e.target.value })}
                  placeholder="5"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Chief Complaints</Label>
              <Textarea
                rows={2}
                value={form.chief_complaint || ""}
                onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
                placeholder="Standard symptoms"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Clinical Findings</Label>
              <Textarea
                rows={2}
                value={form.clinical_findings || ""}
                onChange={(e) => setForm({ ...form, clinical_findings: e.target.value })}
                placeholder="Physical examination notes"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Advice / Instructions</Label>
              <Textarea
                rows={2}
                value={form.advice || ""}
                onChange={(e) => setForm({ ...form, advice: e.target.value })}
                placeholder="Dietary, lifestyle or follow-up advice"
              />
            </div>

            {/* Medicines List */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Preloaded Medicines</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      medicines: [
                        ...(form.medicines || []),
                        { medicine_name: "", dosage: "1-0-1", food_instruction: "After food", duration_days: "5" },
                      ],
                    })
                  }
                >
                  <Plus className="size-3 mr-1" /> Add medicine
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(form.medicines || []).map((m: any, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1.5 items-center border rounded p-1.5 bg-muted/20">
                    <Input
                      className="col-span-5 h-7 text-xs"
                      placeholder="Medicine name"
                      value={m.medicine_name}
                      onChange={(e) => {
                        const copy = [...(form.medicines || [])];
                        copy[idx].medicine_name = e.target.value;
                        setForm({ ...form, medicines: copy });
                      }}
                    />
                    <Input
                      className="col-span-2 h-7 text-xs"
                      placeholder="1-0-1"
                      value={m.dosage || m.frequency || ""}
                      onChange={(e) => {
                        const copy = [...(form.medicines || [])];
                        copy[idx].dosage = e.target.value;
                        setForm({ ...form, medicines: copy });
                      }}
                    />
                    <Input
                      className="col-span-3 h-7 text-xs"
                      placeholder="After food"
                      value={m.food_instruction || ""}
                      onChange={(e) => {
                        const copy = [...(form.medicines || [])];
                        copy[idx].food_instruction = e.target.value;
                        setForm({ ...form, medicines: copy });
                      }}
                    />
                    <Input
                      className="col-span-1 h-7 text-xs"
                      placeholder="Days"
                      value={m.duration_days || ""}
                      onChange={(e) => {
                        const copy = [...(form.medicines || [])];
                        copy[idx].duration_days = e.target.value;
                        setForm({ ...form, medicines: copy });
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="col-span-1 size-7 text-muted-foreground hover:text-destructive justify-self-end"
                      onClick={() => {
                        const copy = (form.medicines || []).filter((_, i) => i !== idx);
                        setForm({ ...form, medicines: copy });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------ Cabins & Rooms Tab ------------------------- */
function CabinsTab({ canManage }: { canManage: boolean }) {
  const LOCAL_CABINS_KEY = "careflow_opd_cabins_list";
  const [cabins, setCabins] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_CABINS_KEY);
      return stored ? JSON.parse(stored) : ["Cabin 101 (General OPD)", "Cabin 102 (Physician)", "Cabin 103 (Pediatrics)", "Room 104 (Orthopedics)"];
    } catch {
      return ["Cabin 101", "Cabin 102", "Room 103"];
    }
  });
  const [newCabin, setNewCabin] = useState("");

  const addCabin = () => {
    if (!newCabin.trim()) return;
    const next = [...cabins, newCabin.trim()];
    setCabins(next);
    localStorage.setItem(LOCAL_CABINS_KEY, JSON.stringify(next));
    setNewCabin("");
    toast.success("Cabin added");
  };

  const removeCabin = (idx: number) => {
    const next = cabins.filter((_, i) => i !== idx);
    setCabins(next);
    localStorage.setItem(LOCAL_CABINS_KEY, JSON.stringify(next));
    toast.success("Cabin removed");
  };

  return (
    <Card className="p-6 space-y-4 mt-4">
      <div>
        <h3 className="font-semibold text-base">OPD Consultation Cabins & Counters</h3>
        <p className="text-xs text-muted-foreground">
          Active doctor consultation rooms and counters displayed in queue tokens and check-in slips.
        </p>
      </div>

      {canManage && (
        <div className="flex gap-2 max-w-md">
          <Input
            placeholder="e.g. Cabin 105 (Cardiology)"
            value={newCabin}
            onChange={(e) => setNewCabin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCabin()}
          />
          <Button onClick={addCabin}><Plus className="size-4 mr-1.5" />Add</Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cabin / Room Name</TableHead>
            <TableHead className="w-24 text-center">Status</TableHead>
            {canManage && <TableHead className="w-16"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cabins.map((c, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium">{c}</TableCell>
              <TableCell className="text-center"><Badge variant="secondary">Active</Badge></TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => removeCabin(idx)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/* ------------------------ Role Permissions Tab ------------------------- */
function PermissionsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();

  const { data: perms = [] } = useQuery({
    queryKey: ["opd-role-perms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role, module, action");
      if (error) throw error;
      return (data ?? []) as { role: string; module: string; action: string }[];
    },
  });

  const set = useMemo(() => new Set(perms.map((p) => `${p.role}::${p.module}::${p.action}`)), [perms]);

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opd-role-perms"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 mt-4">
      {OPD_MODULES.map((m) => (
        <Card key={m.key} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">{m.label}</h3>
            <Badge variant="outline" className="font-mono text-xs">{m.key}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/40">
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
                            disabled={!canManage || role === "super_admin"}
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
      <p className="text-xs text-muted-foreground">Super admin always has full privileges across all OPD modules.</p>
    </div>
  );
}
