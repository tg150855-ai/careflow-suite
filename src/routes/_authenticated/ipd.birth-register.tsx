import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Baby, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { RecordActions } from "@/components/common/record-actions";
import { ModuleActionBar } from "@/components/common/action-bar";
import { SearchBox } from "@/components/common/search-box";
import { DayMonthYearTabs, useDateRange } from "@/components/common/date-range-tabs";
import { shareOnWhatsApp, summarizeRecord } from "@/lib/share";
import { exportXlsx, printPage } from "@/lib/export";
import { useHospitalProfile, type HospitalProfile } from "@/components/print-header";

function printCertificate(kind: "Birth" | "Death", h: HospitalProfile | undefined, fields: Record<string, string>) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  const accent = h?.primary_color || "#0EA5E9";
  const rows = Object.entries(fields).map(([k, v]) => `<tr><td style="padding:6px 12px;font-weight:600;width:35%;border-bottom:1px solid #eee">${k}</td><td style="padding:6px 12px;border-bottom:1px solid #eee">${v || "—"}</td></tr>`).join("");
  const meta = [h?.phone && `Phone: ${h.phone}`, h?.email && `Email: ${h.email}`].filter(Boolean).join(" | ");
  const reg = [h?.registration_no && `License: ${h.registration_no}`, h?.gst_no && `GSTIN: ${h.gst_no}`, h?.nabh_no && `NABH: ${h.nabh_no}`].filter(Boolean).join(" | ");
  w.document.write(`<!doctype html><html><head><title>${kind} Certificate</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;padding:32px;color:#111}.hdr{display:flex;gap:16px;align-items:flex-start;padding-bottom:12px}.hdr img{max-height:64px;max-width:120px;object-fit:contain}.name{font-size:22px;font-weight:700;color:${accent}}.small{font-size:11px;color:#555}.rule{height:2px;background:${accent};margin:4px 0 8px}.title{font-size:16px;font-weight:700;text-align:center;letter-spacing:2px;color:${accent};margin:24px 0 16px;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}.foot{margin-top:48px;display:flex;justify-content:space-between;font-size:11px;color:#666}.sig{margin-top:64px;text-align:right;font-size:12px}@media print{@page{size:A4;margin:14mm}}</style>
</head><body>
<div class="hdr">${h?.logo_url ? `<img src="${h.logo_url}"/>` : ""}<div style="flex:1"><div class="name">${h?.hospital_name || ""}</div>${h?.tagline ? `<div class="small">${h.tagline}</div>` : ""}${h?.address ? `<div class="small" style="white-space:pre-line">${h.address}</div>` : ""}${meta ? `<div class="small">${meta}</div>` : ""}${reg ? `<div class="small">${reg}</div>` : ""}</div></div>
<div class="rule"></div>
<div class="title">Certificate of ${kind}</div>
<table>${rows}</table>
<div class="sig">Authorised Signatory<br/><span class="small">${h?.hospital_name || ""}</span></div>
<div class="foot"><span>${h?.hospital_name || ""}</span><span>Computer generated · ${new Date().toLocaleString()}</span></div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`);
  w.document.close();
}

export const Route = createFileRoute("/_authenticated/ipd/birth-register")({ component: BirthRegister });

function BirthRegister() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { range, preset, setPreset } = useDateRange("month");
  const { data: hospital } = useHospitalProfile();
  const [editRow, setEditRow] = useState<any | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["birth-register"],
    queryFn: async () =>
      (await supabase
        .from("birth_register" as any)
        .select("*, patients:mother_patient_id(full_name, uhid, mobile), admissions(admission_no)")
        .order("born_at", { ascending: false })).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("birth_register" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["birth-register"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const inRange = (d?: string | null) => {
    if (!d || preset === "all") return true;
    const t = new Date(d).getTime();
    return t >= range.from.getTime() && t <= range.to.getTime();
  };

  const filtered = useMemo(() => (rows as any[]).filter((r) => {
    if (!inRange(r.born_at)) return false;
    if (!search) return true;
    const hay = `${r.patients?.full_name ?? ""} ${r.patients?.uhid ?? ""} ${r.baby_name ?? ""} ${r.admissions?.admission_no ?? ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  }), [rows, search, range, preset]);

  const doExport = () => exportXlsx(
    filtered.map((r) => ({
      Mother: r.patients?.full_name, UHID: r.patients?.uhid, Baby: r.baby_name, Sex: r.sex,
      "Weight (g)": r.weight_grams, "Born at": r.born_at, Delivery: r.delivery_type, Doctor: r.attending_doctor_name,
    })),
    `birth-register-${format(new Date(), "yyyyMMdd")}.xlsx`,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Baby className="size-5" />Birth register</h1>
          <p className="text-sm text-muted-foreground mt-1">Newborn birth records linked to the mother's UHID.</p>
        </div>
        <NewBirthDialog />
      </div>

      <ModuleActionBar
        leading={<SearchBox value={search} onChange={setSearch} placeholder="Search mother, UHID, baby, admission…" />}
        onExport={doExport}
        onPrint={printPage}
        extra={<DayMonthYearTabs value={preset} onChange={setPreset} />}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-surface-muted">
              <tr>
                <th className="text-left font-medium px-4 py-2">Mother</th>
                <th className="text-left font-medium py-2">UHID</th>
                <th className="text-left font-medium py-2">Baby</th>
                <th className="text-left font-medium py-2">Sex</th>
                <th className="text-left font-medium py-2">Weight</th>
                <th className="text-left font-medium py-2">Born at</th>
                <th className="text-left font-medium py-2">Doctor</th>
                <th className="text-right font-medium px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium">{r.patients?.full_name ?? "—"}</td>
                  <td className="py-2 font-mono text-xs">{r.patients?.uhid ?? "—"}</td>
                  <td className="py-2">{r.baby_name ?? "—"}</td>
                  <td className="py-2 capitalize">{r.sex ?? "—"}</td>
                  <td className="py-2 tabular-nums">{r.weight_grams ? `${r.weight_grams} g` : "—"}</td>
                  <td className="py-2">{format(new Date(r.born_at), "dd MMM yyyy, p")}</td>
                  <td className="py-2">{r.attending_doctor_name ?? "—"}</td>
                  <td className="text-right px-4 py-2">
                    <RecordActions
                      size="icon"
                      deleteLabel={`birth record for ${r.patients?.full_name ?? "mother"}`}
                      onPrint={() => window.print()}
                      onWhatsApp={() => shareOnWhatsApp(
                        summarizeRecord("Birth Certificate", {
                          Mother: r.patients?.full_name,
                          UHID: r.patients?.uhid,
                          Baby: r.baby_name ?? "—",
                          Sex: r.sex ?? "—",
                          Weight: r.weight_grams ? `${r.weight_grams} g` : "—",
                          "Born at": format(new Date(r.born_at), "dd MMM yyyy, p"),
                          Doctor: r.attending_doctor_name ?? "—",
                        }),
                        undefined,
                        r.patients?.mobile ?? undefined,
                      )}
                      onDelete={() => del.mutate(r.id)}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">No births recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NewBirthDialog() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [motherId, setMotherId] = useState("");
  const [admissionId, setAdmissionId] = useState<string>("");
  const [f, setF] = useState({
    baby_name: "", sex: "male", weight_grams: "",
    born_at: new Date().toISOString().slice(0, 16),
    delivery_type: "Normal", attending_doctor_name: "",
    place_of_birth: "Hospital", remarks: "",
  });

  const { data: matches = [] } = useQuery({
    queryKey: ["birth-mother-search", search], enabled: open && search.length > 1,
    queryFn: async () => (await supabase
      .from("patients")
      .select("id, full_name, uhid, mobile")
      .or(`full_name.ilike.%${search}%,uhid.ilike.%${search}%,mobile.ilike.%${search}%`)
      .limit(10)).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!motherId) throw new Error("Select mother patient");
      const { error } = await supabase.from("birth_register" as any).insert({
        mother_patient_id: motherId,
        admission_id: admissionId || null,
        baby_name: f.baby_name || null,
        sex: f.sex,
        weight_grams: f.weight_grams ? Number(f.weight_grams) : null,
        born_at: new Date(f.born_at).toISOString(),
        delivery_type: f.delivery_type || null,
        attending_doctor_name: f.attending_doctor_name || null,
        place_of_birth: f.place_of_birth || null,
        remarks: f.remarks || null,
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Birth recorded");
      qc.invalidateQueries({ queryKey: ["birth-register"] });
      setOpen(false); setSearch(""); setMotherId(""); setAdmissionId("");
      setF({ baby_name: "", sex: "male", weight_grams: "", born_at: new Date().toISOString().slice(0, 16), delivery_type: "Normal", attending_doctor_name: "", place_of_birth: "Hospital", remarks: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />Record birth</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Record birth</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Mother patient</Label>
            <Input placeholder="Search by name, UHID, mobile" value={search} onChange={(e) => { setSearch(e.target.value); setMotherId(""); }} />
            {matches.length > 0 && !motherId && (
              <div className="border rounded-md max-h-40 overflow-auto mt-1">
                {matches.map((m: any) => (
                  <button key={m.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted" onClick={() => { setMotherId(m.id); setSearch(`${m.uhid} — ${m.full_name}`); }}>
                    <div className="font-medium">{m.full_name}</div>
                    <div className="text-xs text-muted-foreground">{m.uhid} · {m.mobile ?? "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Baby name</Label><Input value={f.baby_name} onChange={(e) => setF({ ...f, baby_name: e.target.value })} placeholder="Baby of…" /></div>
            <div className="space-y-1"><Label>Sex</Label>
              <Select value={f.sex} onValueChange={(v) => setF({ ...f, sex: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["male", "female", "other"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Weight (g)</Label><Input type="number" value={f.weight_grams} onChange={(e) => setF({ ...f, weight_grams: e.target.value })} /></div>
            <div className="space-y-1"><Label>Date & time</Label><Input type="datetime-local" value={f.born_at} onChange={(e) => setF({ ...f, born_at: e.target.value })} /></div>
            <div className="space-y-1"><Label>Delivery type</Label>
              <Select value={f.delivery_type} onValueChange={(v) => setF({ ...f, delivery_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Normal", "C-Section", "Assisted", "Preterm", "Other"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Place</Label>
              <Select value={f.place_of_birth} onValueChange={(v) => setF({ ...f, place_of_birth: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Hospital", "Labour Room", "OT", "Emergency", "En route"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Attending doctor</Label><Input value={f.attending_doctor_name} onChange={(e) => setF({ ...f, attending_doctor_name: e.target.value })} placeholder="Dr. name" /></div>
          <div className="space-y-1"><Label>Remarks</Label><Textarea rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save record"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
