import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Image as ImageIcon, Plus, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pacs")({ component: PACSPage });

function PACSPage() {
  const [studies, setStudies] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    supabase.from("imaging_studies" as any).select("*, patients(full_name, uhid), dicom_files(*)")
      .order("study_date", { ascending: false }).limit(200)
      .then(({ data }) => setStudies(data ?? []));
  };

  useEffect(() => {
    load();
    supabase.from("patients").select("id, full_name, uhid").order("full_name").limit(500).then(({ data }) => setPatients(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><ImageIcon className="size-6 text-primary" /> PACS / Imaging Studies</h1>
          <p className="text-sm text-muted-foreground">Picture Archiving & Communication System with DICOM-ready architecture.</p>
        </div>
        <NewStudyDialog open={open} setOpen={setOpen} patients={patients} onCreated={load} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardContent className="p-0 divide-y max-h-[70vh] overflow-y-auto">
            {studies.map((s) => (
              <button key={s.id} onClick={() => setSelected(s)}
                className={`w-full text-left p-3 hover:bg-surface-muted ${selected?.id === s.id ? "bg-surface-muted" : ""}`}>
                <div className="text-sm font-medium">{s.description || s.modality || "Study"}</div>
                <div className="text-xs text-muted-foreground">{s.patients?.full_name} ({s.patients?.uhid})</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{s.modality ?? "—"}</Badge>
                  <span className="text-[10px] text-muted-foreground">{s.dicom_files?.length ?? 0} files</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{format(new Date(s.study_date ?? s.created_at), "dd MMM yyyy")}</span>
                </div>
              </button>
            ))}
            {studies.length === 0 && <div className="p-8 text-sm text-center text-muted-foreground">No studies yet.</div>}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardContent className="p-4">
            {selected ? <Viewer study={selected} /> : <div className="h-[60vh] flex items-center justify-center text-sm text-muted-foreground">Select a study to view images.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Viewer({ study }: any) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [rotate, setRotate] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const files = study.dicom_files ?? [];
  const file = files[idx];

  return (
    <div className="space-y-3">
      <div>
        <div className="font-semibold">{study.description || study.modality}</div>
        <div className="text-xs text-muted-foreground">{study.patients?.full_name} · Study UID: <code>{study.study_uid ?? "—"}</code></div>
      </div>
      <div className="bg-black rounded-lg flex items-center justify-center overflow-hidden" style={{ height: 380 }}>
        {file?.file_url ? (
          <img src={file.file_url} alt={file.file_name}
            style={{ transform: `scale(${zoom / 100}) rotate(${rotate}deg)`, filter: `brightness(${brightness}%) contrast(${contrast}%)`, maxHeight: "100%", maxWidth: "100%", transition: "all 0.15s" }} />
        ) : (
          <div className="text-white/50 text-sm">{files.length === 0 ? "No images uploaded for this study." : "Image preview not available (DICOM raw)."}</div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => setZoom(Math.max(20, zoom - 20))}><ZoomOut className="size-3.5" /></Button>
        <span className="text-xs tabular-nums w-12 text-center">{zoom}%</span>
        <Button size="sm" variant="outline" onClick={() => setZoom(Math.min(400, zoom + 20))}><ZoomIn className="size-3.5" /></Button>
        <Button size="sm" variant="outline" onClick={() => setRotate((rotate + 90) % 360)}><RotateCw className="size-3.5" /></Button>
        <div className="ml-auto flex items-center gap-1">
          {files.map((_: any, i: number) => (
            <button key={i} className={`size-7 rounded text-xs ${i === idx ? "bg-primary text-primary-foreground" : "bg-muted"}`} onClick={() => setIdx(i)}>{i + 1}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Brightness {brightness}%</Label><Slider value={[brightness]} min={20} max={200} onValueChange={(v) => setBrightness(v[0])} /></div>
        <div><Label className="text-xs">Contrast {contrast}%</Label><Slider value={[contrast]} min={20} max={200} onValueChange={(v) => setContrast(v[0])} /></div>
      </div>
    </div>
  );
}

function NewStudyDialog({ open, setOpen, patients, onCreated }: any) {
  const [form, setForm] = useState({ patient_id: "", modality: "X-Ray", description: "", study_uid: "", file_url: "", file_name: "" });
  const submit = async () => {
    if (!form.patient_id) return toast.error("Patient required");
    const { data: study, error } = await supabase.from("imaging_studies" as any)
      .insert({ patient_id: form.patient_id, modality: form.modality, description: form.description, study_uid: form.study_uid || null })
      .select().single();
    if (error || !study) return toast.error(error?.message ?? "Failed");
    if (form.file_url) {
      await supabase.from("dicom_files" as any).insert({
        study_id: (study as any).id, file_name: form.file_name || "image", file_url: form.file_url, modality: form.modality,
        acquisition_date: new Date().toISOString(),
      });
    }
    toast.success("Study created"); setOpen(false); onCreated();
    setForm({ patient_id: "", modality: "X-Ray", description: "", study_uid: "", file_url: "", file_name: "" });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="size-4 mr-2" />New Study</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Imaging Study</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.uhid})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Modality</Label>
              <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["X-Ray", "CT Scan", "MRI", "Ultrasound", "Mammography"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Study UID</Label><Input value={form.study_uid} onChange={(e) => setForm({ ...form, study_uid: e.target.value })} placeholder="DICOM UID" /></div>
          </div>
          <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Image URL (optional)</Label><Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>File name</Label><Input value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Create Study</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
