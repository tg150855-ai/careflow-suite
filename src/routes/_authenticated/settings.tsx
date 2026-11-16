import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, Image as ImageIcon, Palette, Receipt, Pill, Shield,
  MessageSquare, Printer, Loader2, Upload, Trash2, Languages,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { BrandLogo } from "@/components/brand";
import { LANGUAGES, applyLanguage, type AppLanguage } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODULE_PRESETS, MODULE_REGISTRY, enabledKeysFrom } from "@/lib/modules";
import { useMyHospital } from "@/lib/use-my-hospital";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

async function saveHospitalSettings(patch: Record<string, any>, hospitalId?: string | null) {
  const { error } = await (supabase as any)
    .from("hospital_settings")
    .upsert({ id: SETTINGS_ID, ...patch }, { onConflict: "id" });
  if (error) throw error;
  if (hospitalId && hospitalId !== SETTINGS_ID) {
    try {
      await (supabase as any)
        .from("hospital_settings")
        .upsert({ id: hospitalId, ...patch }, { onConflict: "id" });
    } catch { /* ignore secondary upsert failure */ }
  }
}

type Settings = {
  id: string;
  hospital_name: string;
  tagline: string | null;
  registration_no: string | null;
  nabh_no: string | null;
  gst_no: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  prescription: any;
  billing: any;
  printers: any;
  messaging: any;
  security: any;
  departments: any;
};

const DEFAULT_SETTINGS: Settings = {
  id: SETTINGS_ID,
  hospital_name: "SBG Arogya Plus",
  tagline: "Hospital Management Suite",
  registration_no: "",
  nabh_no: "",
  gst_no: "",
  website: "",
  email: "",
  phone: "",
  address: "",
  logo_url: null,
  primary_color: "#0EA5E9",
  secondary_color: "#0F172A",
  accent_color: "#22C55E",
  prescription: {},
  billing: { gst_percent: 18, invoice_prefix: "INV", receipt_prefix: "RCT", currency: "INR" },
  printers: {},
  messaging: {},
  security: { session_minutes: 60, max_attempts: 5, min_password_length: 8 },
  departments: [],
};

function SettingsPage() {
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["admin", "super_admin"]);
  const qc = useQueryClient();
  const { hospital } = useMyHospital();
  const hospitalId = hospital?.id ?? null;

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["hospital-settings"] });
    qc.invalidateQueries({ queryKey: ["my-hospital"] });
  };

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["hospital-settings", "full", hospitalId],
    queryFn: async () => {
      let fetched: any = null;
      if (hospitalId) {
        const { data } = await (supabase as any)
          .from("hospital_settings")
          .select("*")
          .eq("id", hospitalId)
          .maybeSingle();
        fetched = data;
      }
      if (!fetched) {
        const { data, error } = await (supabase as any)
          .from("hospital_settings")
          .select("*")
          .eq("id", SETTINGS_ID)
          .maybeSingle();
        if (error) {
          console.warn("Could not fetch hospital_settings row, using defaults:", error.message);
        } else {
          fetched = data;
        }
      }
      const initial: Settings = fetched ? { ...DEFAULT_SETTINGS, ...fetched } : DEFAULT_SETTINGS;
      if (hospital?.hospital_name && (initial.hospital_name === "SBG Arogya Plus" || !initial.hospital_name)) {
        initial.hospital_name = hospital.hospital_name;
      }
      if (hospital?.phone && !initial.phone) initial.phone = hospital.phone;
      if (hospital?.email && !initial.email) initial.email = hospital.email;
      if (hospital?.address && !initial.address) {
        initial.address = [hospital.address, hospital.city, hospital.state].filter(Boolean).join(", ");
      }
      return initial;
    },
  });

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hospital Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage hospital identity, branding, and operational defaults. {!canEdit && "(Read-only)"}
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile"><Building2 className="size-3.5 mr-1" />Profile</TabsTrigger>
          <TabsTrigger value="logo"><ImageIcon className="size-3.5 mr-1" />Logo</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="size-3.5 mr-1" />Branding</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="prescription"><Pill className="size-3.5 mr-1" />Prescription</TabsTrigger>
          <TabsTrigger value="billing"><Receipt className="size-3.5 mr-1" />Billing</TabsTrigger>
          <TabsTrigger value="printers"><Printer className="size-3.5 mr-1" />Printers</TabsTrigger>
          <TabsTrigger value="messaging"><MessageSquare className="size-3.5 mr-1" />WhatsApp/SMS</TabsTrigger>
          <TabsTrigger value="security"><Shield className="size-3.5 mr-1" />Security</TabsTrigger>
          <TabsTrigger value="language"><Languages className="size-3.5 mr-1" />Language</TabsTrigger>
        </TabsList>

        <TabsContent value="language">
          <LanguageTab settings={settings} canEdit={canEdit} hospitalId={hospitalId} onSaved={refreshAll} />
        </TabsContent>

        <TabsContent value="profile">
          <ProfileTab settings={settings} canEdit={canEdit} hospitalId={hospitalId} onSaved={refreshAll} />
        </TabsContent>
        <TabsContent value="logo">
          <LogoTab settings={settings} canEdit={canEdit} hospitalId={hospitalId} onSaved={refreshAll} />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab settings={settings} canEdit={canEdit} hospitalId={hospitalId} onSaved={refreshAll} />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentsTab settings={settings} canEdit={canEdit} hospitalId={hospitalId} onSaved={refreshAll} />
        </TabsContent>
        <TabsContent value="prescription">
          <JsonTab field="prescription" label="Prescription" settings={settings} canEdit={canEdit} hospitalId={hospitalId}
            fields={[
              { key: "header", label: "Header text", type: "textarea" },
              { key: "footer", label: "Footer text", type: "textarea" },
              { key: "footer_disclaimer", label: "Footer disclaimer", type: "textarea" },
              { key: "watermark", label: "Watermark text", type: "text" },
              { key: "signature_url", label: "Digital signature image URL", type: "text" },
              { key: "auto_apply_signature", label: "Auto-apply signature (1 = yes, 0 = no)", type: "number" },
              { key: "enable_whatsapp", label: "Enable WhatsApp share (1 = yes, 0 = no)", type: "number" },
              { key: "font_family", label: "Font family (e.g. Inter, Georgia)", type: "text" },
              { key: "font_size", label: "Base font size (px)", type: "number" },
              { key: "paper_size", label: "Paper size (A4/A5)", type: "text" },
              { key: "margins_mm", label: "Page margin (mm)", type: "number" },
              { key: "number_format", label: "Prescription number format", type: "text" },
            ]}
            onSaved={refreshAll} />
        </TabsContent>
        <TabsContent value="billing">
          <JsonTab field="billing" label="Billing" settings={settings} canEdit={canEdit} hospitalId={hospitalId}
            fields={[
              { key: "gst_percent", label: "GST %", type: "number" },
              { key: "invoice_prefix", label: "Invoice prefix", type: "text" },
              { key: "receipt_prefix", label: "Receipt prefix", type: "text" },
              { key: "currency", label: "Currency code", type: "text" },
            ]}
            onSaved={refreshAll} />
        </TabsContent>
        <TabsContent value="printers">
          <JsonTab field="printers" label="Printers" settings={settings} canEdit={canEdit} hospitalId={hospitalId}
            fields={[
              { key: "opd", label: "OPD printer name", type: "text" },
              { key: "billing", label: "Billing printer name", type: "text" },
              { key: "pharmacy", label: "Pharmacy printer name", type: "text" },
              { key: "lab", label: "Lab printer name", type: "text" },
            ]}
            onSaved={refreshAll} />
        </TabsContent>
        <TabsContent value="messaging">
          <JsonTab field="messaging" label="WhatsApp & SMS" settings={settings} canEdit={canEdit} hospitalId={hospitalId}
            fields={[
              { key: "whatsapp_api_key", label: "WhatsApp API key", type: "text" },
              { key: "whatsapp_sender_id", label: "WhatsApp sender ID", type: "text" },
              { key: "sms_api_key", label: "SMS API key", type: "text" },
              { key: "sms_sender_id", label: "SMS sender ID", type: "text" },
            ]}
            onSaved={refreshAll} />
        </TabsContent>
        <TabsContent value="security">
          <JsonTab field="security" label="Security" settings={settings} canEdit={canEdit} hospitalId={hospitalId}
            fields={[
              { key: "min_password_length", label: "Min password length", type: "number" },
              { key: "session_minutes", label: "Session timeout (minutes)", type: "number" },
              { key: "max_attempts", label: "Max login attempts", type: "number" },
            ]}
            onSaved={refreshAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Profile ----------
function ProfileTab({ settings, canEdit, hospitalId, onSaved }: { settings: Settings; canEdit: boolean; hospitalId?: string | null; onSaved: () => void }) {
  const [v, setV] = useState({
    hospital_name: settings.hospital_name ?? "",
    tagline: settings.tagline ?? "",
    registration_no: settings.registration_no ?? "",
    nabh_no: settings.nabh_no ?? "",
    gst_no: settings.gst_no ?? "",
    website: settings.website ?? "",
    email: settings.email ?? "",
    phone: settings.phone ?? "",
    address: settings.address ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const before = { ...settings };
    try {
      await saveHospitalSettings(v, hospitalId);
      if (hospitalId) {
        await supabase
          .from("hospitals")
          .update({
            hospital_name: v.hospital_name,
            phone: v.phone || null,
            email: v.email || null,
            address: v.address || null,
          })
          .eq("id", hospitalId);
      }
      setSaving(false);
      await logAudit({ action: "update", entity: "hospital_settings", entityId: hospitalId || SETTINGS_ID, before, after: v });
      toast.success("Hospital profile saved");
      onSaved();
    } catch (err: any) {
      setSaving(false);
      toast.error(err.message || "Failed to save hospital profile");
    }
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Row label="Hospital name *"><Input value={v.hospital_name} disabled={!canEdit} onChange={(e) => setV({ ...v, hospital_name: e.target.value })} /></Row>
        <Row label="Tagline"><Input value={v.tagline} disabled={!canEdit} onChange={(e) => setV({ ...v, tagline: e.target.value })} /></Row>
        <Row label="Registration no"><Input value={v.registration_no} disabled={!canEdit} onChange={(e) => setV({ ...v, registration_no: e.target.value })} /></Row>
        <Row label="NABH no"><Input value={v.nabh_no} disabled={!canEdit} onChange={(e) => setV({ ...v, nabh_no: e.target.value })} /></Row>
        <Row label="GST no"><Input value={v.gst_no} disabled={!canEdit} onChange={(e) => setV({ ...v, gst_no: e.target.value })} /></Row>
        <Row label="Website"><Input value={v.website} disabled={!canEdit} onChange={(e) => setV({ ...v, website: e.target.value })} /></Row>
        <Row label="Email"><Input type="email" value={v.email} disabled={!canEdit} onChange={(e) => setV({ ...v, email: e.target.value })} /></Row>
        <Row label="Phone"><Input value={v.phone} disabled={!canEdit} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Row>
        <Row label="Address" full><Textarea rows={3} value={v.address} disabled={!canEdit} onChange={(e) => setV({ ...v, address: e.target.value })} /></Row>
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}Save profile
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------- Logo ----------
function LogoTab({ settings, canEdit, hospitalId, onSaved }: { settings: Settings; canEdit: boolean; hospitalId?: string | null; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      return toast.error("Only PNG, JPG or SVG allowed");
    }
    if (file.size > 4 * 1024 * 1024) return toast.error("Max file size 4MB");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `logos/hospital-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("hospital-assets")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { data: signed } = await supabase.storage
      .from("hospital-assets")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    const url = signed?.signedUrl;
    try {
      await saveHospitalSettings({ logo_url: url }, hospitalId);
      setUploading(false);
      await logAudit({ action: "update", entity: "hospital_settings.logo", entityId: hospitalId || SETTINGS_ID, after: { logo_url: url } });
      toast.success("Logo updated");
      onSaved();
    } catch (err: any) {
      setUploading(false);
      toast.error(err.message || "Failed to update logo");
    }
  }

  async function remove() {
    try {
      await saveHospitalSettings({ logo_url: null }, hospitalId);
      await logAudit({ action: "delete", entity: "hospital_settings.logo", entityId: hospitalId || SETTINGS_ID });
      toast.success("Logo removed");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove logo");
    }
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-center bg-muted/40 rounded-lg border h-40 px-4">
        <BrandLogo src={settings.logo_url ?? undefined} size={80} />
      </div>
      <p className="text-xs text-muted-foreground">
        Used on the login screen, sidebar, dashboard header, prescriptions, bills, lab/radiology reports, discharge summaries and PDF exports. PNG, JPG or SVG — up to 4MB.
      </p>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            {settings.logo_url ? "Replace logo" : "Upload logo"}
          </Button>
          {settings.logo_url && (
            <Button variant="outline" onClick={remove}>
              <Trash2 className="size-4 mr-2" />Remove
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------- Branding ----------
function BrandingTab({ settings, canEdit, hospitalId, onSaved }: { settings: Settings; canEdit: boolean; hospitalId?: string | null; onSaved: () => void }) {
  const [v, setV] = useState({
    primary_color: settings.primary_color ?? "#0EA5E9",
    secondary_color: settings.secondary_color ?? "#0F172A",
    accent_color: settings.accent_color ?? "#22C55E",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveHospitalSettings(v, hospitalId);
      setSaving(false);
      await logAudit({ action: "update", entity: "hospital_settings.branding", entityId: hospitalId || SETTINGS_ID, after: v });
      toast.success("Branding saved");
      onSaved();
    } catch (err: any) {
      setSaving(false);
      toast.error(err.message || "Failed to save branding");
    }
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["primary_color", "secondary_color", "accent_color"] as const).map((k) => (
          <Row key={k} label={k.replace("_", " ")}>
            <div className="flex items-center gap-2">
              <input type="color" value={v[k]} disabled={!canEdit}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
                className="size-10 rounded border cursor-pointer" />
              <Input value={v[k]} disabled={!canEdit} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
            </div>
          </Row>
        ))}
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}Save branding
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------- Departments / Module management ----------
function DepartmentsTab({ settings, canEdit, hospitalId, onSaved }: { settings: Settings; canEdit: boolean; hospitalId?: string | null; onSaved: () => void }) {
  const [enabled, setEnabled] = useState<Set<string>>(() => enabledKeysFrom(settings.departments) as Set<string>);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setEnabled(enabledKeysFrom(settings.departments) as Set<string>); }, [settings.departments]);

  function toggle(key: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const departments = MODULE_REGISTRY.map((m) => ({ key: m.key, name: m.name, enabled: enabled.has(m.key) }));
    try {
      await saveHospitalSettings({ departments }, hospitalId);
      setSaving(false);
      await logAudit({ action: "update", entity: "hospital_settings.departments", entityId: hospitalId || SETTINGS_ID, after: { departments } });
      toast.success("Modules saved");
      onSaved();
    } catch (err: any) {
      setSaving(false);
      toast.error(err.message || "Failed to save departments");
    }
  }

  return (
    <Card className="p-6 space-y-5">
      <div>
        <div className="font-medium">Module access templates</div>
        <div className="text-xs text-muted-foreground">Apply a preset, then fine-tune below.</div>
        <div className="flex flex-wrap gap-2 mt-3">
          {MODULE_PRESETS.map((p) => (
            <Button key={p.key} type="button" size="sm" variant="outline" disabled={!canEdit}
              onClick={() => setEnabled(new Set(p.modules))} title={p.description}>
              {p.name}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {MODULE_REGISTRY.map((m) => {
          const on = enabled.has(m.key);
          return (
            <button key={m.key} type="button" disabled={!canEdit} onClick={() => toggle(m.key)}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 h-11 text-sm text-left transition-colors ${on ? "border-primary/40 bg-primary/5" : "opacity-60"}`}>
              <span className="truncate">{m.name}</span>
              <span className={`text-[11px] font-medium ${on ? "text-primary" : "text-muted-foreground"}`}>{on ? "Enabled" : "Disabled"}</span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Disabled modules are hidden from the sidebar and their pages are blocked for every user. Existing data is never deleted.
      </p>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}Save modules
          </Button>
        </div>
      )}
    </Card>
  );
}


// ---------- JSON Tab (prescription / billing / printers / messaging / security) ----------
function JsonTab({ field, label, settings, canEdit, fields, hospitalId, onSaved }: {
  field: keyof Settings;
  label: string;
  settings: Settings;
  canEdit: boolean;
  fields: { key: string; label: string; type: "text" | "number" | "textarea" }[];
  hospitalId?: string | null;
  onSaved: () => void;
}) {
  const [v, setV] = useState<Record<string, any>>(() => ({ ...(settings[field] as any || {}) }));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setV({ ...(settings[field] as any || {}) }); }, [settings, field]);

  async function save() {
    setSaving(true);
    try {
      await saveHospitalSettings({ [field]: v }, hospitalId);
      setSaving(false);
      await logAudit({ action: "update", entity: `hospital_settings.${String(field)}`, entityId: hospitalId || SETTINGS_ID, after: { [field]: v } });
      toast.success(`${label} settings saved`);
      onSaved();
    } catch (err: any) {
      setSaving(false);
      toast.error(err.message || `Failed to save ${label.toLowerCase()} settings`);
    }
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <Row key={f.key} label={f.label} full={f.type === "textarea"}>
            {f.type === "textarea" ? (
              <Textarea rows={3} value={v[f.key] ?? ""} disabled={!canEdit}
                onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            ) : (
              <Input type={f.type} value={v[f.key] ?? ""} disabled={!canEdit}
                onChange={(e) => setV({ ...v, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} />
            )}
          </Row>
        ))}
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}Save {label.toLowerCase()}
          </Button>
        </div>
      )}
    </Card>
  );
}

function Row({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

// ---------- Language ----------
function LanguageTab({ settings, canEdit, hospitalId, onSaved }: { settings: Settings & { default_language?: string }; canEdit: boolean; hospitalId?: string | null; onSaved: () => void }) {
  const [lang, setLang] = useState<AppLanguage>(((settings as any).default_language ?? "en") as AppLanguage);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveHospitalSettings({ default_language: lang }, hospitalId);
      setSaving(false);
      await applyLanguage(lang);
      logAudit({ action: "update", entity: "hospital_settings", entityId: hospitalId || SETTINGS_ID, after: { default_language: lang } });
      toast.success("Language updated");
      onSaved();
    } catch (err: any) {
      setSaving(false);
      toast.error(err.message || "Failed to update language");
    }
  }

  return (
    <Card className="p-6 space-y-5 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">System language</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Choose the default language for the entire HMIS interface. Applies to sidebar, buttons,
          forms, dashboards and reports. Patient names, doctor notes and other user-entered data
          are never translated.
        </p>
      </div>
      <Separator />
      <div className="space-y-2 max-w-sm">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Default system language
        </Label>
        <Select value={lang} onValueChange={(v) => setLang(v as AppLanguage)} disabled={!canEdit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                <span className="mr-2">{l.flag}</span>
                {l.native} <span className="text-muted-foreground ml-1">({l.label})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={!canEdit || saving}>
          {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
          Save language
        </Button>
      </div>
    </Card>
  );
}
