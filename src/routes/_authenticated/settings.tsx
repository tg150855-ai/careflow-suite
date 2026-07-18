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

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

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

function SettingsPage() {
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["admin", "super_admin"]);
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["hospital-settings", "full"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("hospital_settings")
        .select("*")
        .eq("id", SETTINGS_ID)
        .single();
      if (error) throw error;
      return data;
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
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab settings={settings} canEdit={canEdit} onSaved={() => qc.invalidateQueries({ queryKey: ["hospital-settings"] })} />
        </TabsContent>
        <TabsContent value="logo">
          <LogoTab settings={settings} canEdit={canEdit} onSaved={() => qc.invalidateQueries({ queryKey: ["hospital-settings"] })} />
        </TabsContent>
        <TabsContent value="branding">
          <BrandingTab settings={settings} canEdit={canEdit} onSaved={() => qc.invalidateQueries({ queryKey: ["hospital-settings"] })} />
        </TabsContent>
        <TabsContent value="departments">
          <DepartmentsTab settings={settings} canEdit={canEdit} onSaved={() => qc.invalidateQueries({ queryKey: ["hospital-settings"] })} />
        </TabsContent>
        <TabsContent value="prescription">
          <JsonTab field="prescription" label="Prescription" settings={settings} canEdit={canEdit}
            fields={[
              { key: "header", label: "Header text", type: "textarea" },
              { key: "footer", label: "Footer text", type: "textarea" },
              { key: "watermark", label: "Watermark text", type: "text" },
              { key: "signature_url", label: "Digital signature URL", type: "text" },
            ]}
            onSaved={() => qc.invalidateQueries({ queryKey: ["hospital-settings"] })} />
        </TabsContent>
        <TabsContent value="billing">
          <JsonTab field="billing" label="Billing" settings={settings} canEdit={canEdit}
            fields={[
              { key: "gst_percent", label: "GST %", type: "number" },
              { key: "invoice_prefix", label: "Invoice prefix", type: "text" },
              { key: "receipt_prefix", label: "Receipt prefix", type: "text" },
              { key: "currency", label: "Currency code", type: "text" },
            ]}
            onSaved={() => qc.invalidateQueries({ queryKey: ["hospital-settings"] })} />
        </TabsContent>
        <TabsContent value="printers">
          <JsonTab field="printers" label="Printers" settings={settings} canEdit={canEdit}
            fields={[
              { key: "opd", label: "OPD printer name", type: "text" },
              { key: "billing", label: "Billing printer name", type: "text" },
              { key: "pharmacy", label: "Pharmacy printer name", type: "text" },
              { key: "lab", label: "Lab printer name", type: "text" },
            ]}
            onSaved={() => qc.invalidateQueries({ queryKey: ["hospital-settings"] })} />
        </TabsContent>
        <TabsContent value="messaging">
          <JsonTab field="messaging" label="WhatsApp & SMS" settings={settings} canEdit={canEdit}
            fields={[
              { key: "whatsapp_api_key", label: "WhatsApp API key", type: "text" },
              { key: "whatsapp_sender_id", label: "WhatsApp sender ID", type: "text" },
              { key: "sms_api_key", label: "SMS API key", type: "text" },
              { key: "sms_sender_id", label: "SMS sender ID", type: "text" },
            ]}
            onSaved={() => qc.invalidateQueries({ queryKey: ["hospital-settings"] })} />
        </TabsContent>
        <TabsContent value="security">
          <JsonTab field="security" label="Security" settings={settings} canEdit={canEdit}
            fields={[
              { key: "min_password_length", label: "Min password length", type: "number" },
              { key: "session_minutes", label: "Session timeout (minutes)", type: "number" },
              { key: "max_attempts", label: "Max login attempts", type: "number" },
            ]}
            onSaved={() => qc.invalidateQueries({ queryKey: ["hospital-settings"] })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Profile ----------
function ProfileTab({ settings, canEdit, onSaved }: { settings: Settings; canEdit: boolean; onSaved: () => void }) {
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
    const { error } = await (supabase as any).from("hospital_settings").update(v).eq("id", SETTINGS_ID);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit({ action: "update", entity: "hospital_settings", entityId: SETTINGS_ID, before, after: v });
    toast.success("Hospital profile saved");
    onSaved();
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
function LogoTab({ settings, canEdit, onSaved }: { settings: Settings; canEdit: boolean; onSaved: () => void }) {
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
    const { error } = await (supabase as any)
      .from("hospital_settings")
      .update({ logo_url: url })
      .eq("id", SETTINGS_ID);
    setUploading(false);
    if (error) return toast.error(error.message);
    await logAudit({ action: "update", entity: "hospital_settings.logo", entityId: SETTINGS_ID, after: { logo_url: url } });
    toast.success("Logo updated");
    onSaved();
  }

  async function remove() {
    const { error } = await (supabase as any)
      .from("hospital_settings")
      .update({ logo_url: null })
      .eq("id", SETTINGS_ID);
    if (error) return toast.error(error.message);
    await logAudit({ action: "delete", entity: "hospital_settings.logo", entityId: SETTINGS_ID });
    toast.success("Logo removed");
    onSaved();
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
function BrandingTab({ settings, canEdit, onSaved }: { settings: Settings; canEdit: boolean; onSaved: () => void }) {
  const [v, setV] = useState({
    primary_color: settings.primary_color ?? "#0EA5E9",
    secondary_color: settings.secondary_color ?? "#0F172A",
    accent_color: settings.accent_color ?? "#22C55E",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await (supabase as any).from("hospital_settings").update(v).eq("id", SETTINGS_ID);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit({ action: "update", entity: "hospital_settings.branding", entityId: SETTINGS_ID, after: v });
    toast.success("Branding saved");
    onSaved();
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

// ---------- Departments ----------
const DEFAULT_DEPTS = ["OPD", "IPD", "ICU", "OT", "Pharmacy", "Laboratory", "Radiology"];

function DepartmentsTab({ settings, canEdit, onSaved }: { settings: Settings; canEdit: boolean; onSaved: () => void }) {
  const initial: { name: string; enabled: boolean }[] =
    Array.isArray(settings.departments) && settings.departments.length
      ? settings.departments
      : DEFAULT_DEPTS.map((name) => ({ name, enabled: true }));
  const [depts, setDepts] = useState(initial);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await (supabase as any).from("hospital_settings").update({ departments: depts }).eq("id", SETTINGS_ID);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit({ action: "update", entity: "hospital_settings.departments", entityId: SETTINGS_ID, after: { departments: depts } });
    toast.success("Departments saved");
    onSaved();
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-2">
        {depts.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={d.name} disabled={!canEdit}
              onChange={(e) => setDepts(depts.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
            <Button type="button" size="sm" variant={d.enabled ? "default" : "outline"} disabled={!canEdit}
              onClick={() => setDepts(depts.map((x, idx) => idx === i ? { ...x, enabled: !x.enabled } : x))}>
              {d.enabled ? "Enabled" : "Disabled"}
            </Button>
            {canEdit && (
              <Button type="button" size="icon" variant="ghost" onClick={() => setDepts(depts.filter((_, idx) => idx !== i))}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <>
          <Separator />
          <div className="flex gap-2">
            <Input placeholder="New department name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => {
              if (!newName.trim()) return;
              setDepts([...depts, { name: newName.trim(), enabled: true }]);
              setNewName("");
            }}>Add</Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}Save departments
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

// ---------- JSON Tab (prescription / billing / printers / messaging / security) ----------
function JsonTab({ field, label, settings, canEdit, fields, onSaved }: {
  field: keyof Settings;
  label: string;
  settings: Settings;
  canEdit: boolean;
  fields: { key: string; label: string; type: "text" | "number" | "textarea" }[];
  onSaved: () => void;
}) {
  const [v, setV] = useState<Record<string, any>>(() => ({ ...(settings[field] as any || {}) }));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setV({ ...(settings[field] as any || {}) }); }, [settings, field]);

  async function save() {
    setSaving(true);
    const payload: any = { [field]: v };
    const { error } = await (supabase as any).from("hospital_settings").update(payload).eq("id", SETTINGS_ID);
    setSaving(false);
    if (error) return toast.error(error.message);
    await logAudit({ action: "update", entity: `hospital_settings.${String(field)}`, entityId: SETTINGS_ID, after: payload });
    toast.success(`${label} settings saved`);
    onSaved();
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
