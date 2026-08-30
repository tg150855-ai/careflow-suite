import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConsultationTemplateItem,
  fetchDoctorTemplates,
  saveDoctorTemplate,
  deleteDoctorTemplate,
} from "@/lib/consultation-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookmarkPlus,
  LayoutTemplate,
  Pencil,
  Trash2,
  Check,
  Plus,
  Sparkles,
  Search,
  Pill,
  FlaskConical,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  doctorId?: string | null;
  userId?: string | null;
  hospitalId?: string | null;
  currentConsultation?: {
    chief?: string;
    findings?: string;
    diagnosis?: string;
    notes?: string;
    followUp?: string;
    investigations?: any[];
    medicines?: any[];
  };
  onApplyTemplate: (template: ConsultationTemplateItem) => void;
}

export function ConsultationTemplateManager({
  doctorId,
  userId,
  hospitalId,
  currentConsultation,
  onApplyTemplate,
}: Props) {
  const qc = useQueryClient();
  const queryKey = ["doctor-consultation-templates", hospitalId, doctorId, userId];

  const { data: templates = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDoctorTemplates({ hospitalId, doctorId, userId }),
    staleTime: 60 * 1000,
  });

  const [selectedTplId, setSelectedTplId] = useState<string>("");
  const [manageOpen, setManageOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConsultationTemplateItem | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [search, setSearch] = useState("");

  const saveMutation = useMutation({
    mutationFn: (tpl: ConsultationTemplateItem) =>
      saveDoctorTemplate(tpl, { hospitalId, doctorId, userId }),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey });
      toast.success(`Template "${saved.name}" saved`);
      setSaveOpen(false);
      setEditingTemplate(null);
      setNewTemplateName("");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to save template");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      deleteDoctorTemplate(id, name, { hospitalId, doctorId, userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Template deleted");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to delete template");
    },
  });

  function handleSelect(val: string) {
    setSelectedTplId(val);
    const tpl = templates.find((t) => (t.id ?? t.name) === val || t.name === val);
    if (tpl) {
      onApplyTemplate(tpl);
      toast.success(`Applied template: ${tpl.name}`);
    }
  }

  function openSaveCurrent() {
    if (!currentConsultation?.diagnosis && !currentConsultation?.chief && (!currentConsultation?.medicines || currentConsultation.medicines.length === 0)) {
      toast.info("Fill in consultation details before saving as template.");
    }
    setNewTemplateName(currentConsultation?.diagnosis || currentConsultation?.chief || "");
    setSaveOpen(true);
  }

  function handleSaveCurrent() {
    if (!newTemplateName.trim()) {
      toast.error("Enter a template name");
      return;
    }
    const tpl: ConsultationTemplateItem = {
      name: newTemplateName.trim(),
      chief_complaint: currentConsultation?.chief ?? "",
      clinical_findings: currentConsultation?.findings ?? "",
      diagnosis: currentConsultation?.diagnosis ?? "",
      advice: currentConsultation?.notes ?? "",
      follow_up_advice: currentConsultation?.followUp ?? "",
      follow_up_days: currentConsultation?.followUp ? "7" : undefined,
      investigations: currentConsultation?.investigations ?? [],
      medicines: (currentConsultation?.medicines ?? [])
        .filter((m: any) => m.medicine_name?.trim())
        .map((m: any) => ({
          medicine_name: m.medicine_name,
          strength: m.strength ?? "",
          route: m.route ?? "Oral",
          frequency: m.frequency ?? m.dosage ?? "1-0-1",
          dosage: m.dosage ?? m.frequency ?? "1-0-1",
          food_instruction: m.food_instruction ?? "After meal",
          duration_days: String(m.duration_days ?? "5"),
          instructions: m.instructions ?? "",
        })),
    };
    saveMutation.mutate(tpl);
  }

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
    t.chief_complaint?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Template selector */}
      <div className="flex items-center gap-1.5">
        <Select value={selectedTplId} onValueChange={handleSelect}>
          <SelectTrigger className="h-8 min-w-[210px] text-xs bg-surface-muted/60 border-dashed border-primary/40 font-medium">
            <LayoutTemplate className="size-3.5 text-primary mr-1 shrink-0" />
            <SelectValue placeholder="Ready-made Templates..." />
          </SelectTrigger>
          <SelectContent className="max-h-80 w-[300px]">
            <div className="p-2 border-b text-[11px] font-semibold text-muted-foreground uppercase flex items-center justify-between">
              <span>Doctor Templates ({templates.length})</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation();
                  setManageOpen(true);
                }}
              >
                Manage
              </Button>
            </div>
            {templates.map((t) => (
              <SelectItem
                key={t.id ?? t.name}
                value={t.id ?? t.name}
                className="text-xs py-2 cursor-pointer"
              >
                <div className="font-medium truncate">{t.name}</div>
                {t.diagnosis && (
                  <div className="text-[10px] text-muted-foreground truncate">{t.diagnosis}</div>
                )}
                {t.medicines && t.medicines.length > 0 && (
                  <div className="text-[10px] text-primary/80 flex items-center gap-1 mt-0.5">
                    <Pill className="size-2.5" />
                    <span>{t.medicines.length} medicine{t.medicines.length > 1 ? "s" : ""}</span>
                  </div>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1"
          onClick={openSaveCurrent}
          title="Save current consultation as a reusable template"
        >
          <BookmarkPlus className="size-3.5 text-primary" />
          <span className="hidden sm:inline">Save Template</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setManageOpen(true)}
          title="Manage templates"
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>

      {/* Save Template Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="size-5 text-primary" />
              Save as Consultation Template
            </DialogTitle>
            <DialogDescription>
              Create a doctor-specific template from the current consultation details to quickly populate future patient visits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Template Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Fever / Cold / Cough or Acute Gastroenteritis"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="rounded-lg border bg-surface-muted/40 p-3 text-xs space-y-1.5">
              <div className="font-semibold text-muted-foreground uppercase text-[10px]">Included in this template:</div>
              <div className="truncate"><b>Diagnosis:</b> {currentConsultation?.diagnosis || "—"}</div>
              <div className="truncate"><b>Chief Complaint:</b> {currentConsultation?.chief || "—"}</div>
              <div className="truncate"><b>Clinical Findings:</b> {currentConsultation?.findings || "—"}</div>
              <div className="truncate"><b>Advice:</b> {currentConsultation?.notes || "—"}</div>
              <div><b>Medicines:</b> {currentConsultation?.medicines?.filter((m: any) => m.medicine_name?.trim()).length ?? 0} items</div>
              <div><b>Investigations:</b> {currentConsultation?.investigations?.length ?? 0} tests</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveCurrent} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Templates Modal */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="size-5 text-primary" />
              Manage Doctor Consultation Templates
            </DialogTitle>
            <DialogDescription>
              Custom ready-made templates for rapid OPD consultation. Private to your account and hospital.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() =>
                  setEditingTemplate({
                    name: "",
                    chief_complaint: "",
                    clinical_findings: "",
                    diagnosis: "",
                    advice: "",
                    medicines: [{ medicine_name: "", dosage: "1-0-1", frequency: "1-0-1", food_instruction: "After meal", duration_days: "5" }],
                    investigations: [],
                    follow_up_days: "5",
                    follow_up_advice: "",
                  })
                }
              >
                <Plus className="size-3.5" /> Create New
              </Button>
            </div>

            {/* Template edit form if active */}
            {editingTemplate && (
              <TemplateEditor
                template={editingTemplate}
                onSave={(tpl) => saveMutation.mutate(tpl)}
                onCancel={() => setEditingTemplate(null)}
                isSaving={saveMutation.isPending}
              />
            )}

            {/* Template cards list */}
            <div className="grid sm:grid-cols-2 gap-3">
              {filteredTemplates.length === 0 ? (
                <div className="col-span-2 text-center py-10 text-muted-foreground text-sm border rounded-lg">
                  No consultation templates found. Create one or apply from defaults.
                </div>
              ) : (
                filteredTemplates.map((t) => (
                  <div
                    key={t.id ?? t.name}
                    className="border rounded-xl p-3.5 bg-card hover:border-primary/50 transition flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm">{t.name}</div>
                        <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                          {t.medicines?.length ?? 0} meds
                        </Badge>
                      </div>

                      {t.diagnosis && (
                        <div className="text-xs font-medium text-primary mt-1 truncate">
                          Dx: {t.diagnosis}
                        </div>
                      )}

                      {t.chief_complaint && (
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          <b>CC:</b> {t.chief_complaint}
                        </div>
                      )}

                      {t.medicines && t.medicines.length > 0 && (
                        <div className="mt-2 text-[11px] space-y-0.5 bg-surface-muted/50 p-2 rounded-lg border">
                          <div className="font-semibold text-[10px] text-muted-foreground uppercase">Prescription:</div>
                          {t.medicines.slice(0, 3).map((m, idx) => (
                            <div key={idx} className="truncate text-foreground/80">
                              • {m.medicine_name} {m.strength ? `(${m.strength})` : ""} - {m.frequency || m.dosage} ({m.duration_days}d)
                            </div>
                          ))}
                          {t.medicines.length > 3 && (
                            <div className="text-[10px] text-muted-foreground italic">
                              +{t.medicines.length - 3} more medicines
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t mt-1">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingTemplate(t)}
                        >
                          <Pencil className="size-3 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            if (window.confirm(`Delete template "${t.name}"?`)) {
                              deleteMutation.mutate({ id: t.id ?? "", name: t.name });
                            }
                          }}
                        >
                          <Trash2 className="size-3 mr-1" /> Delete
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs"
                        onClick={() => {
                          onApplyTemplate(t);
                          setManageOpen(false);
                          toast.success(`Applied template: ${t.name}`);
                        }}
                      >
                        Apply <Check className="size-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateEditor({
  template,
  onSave,
  onCancel,
  isSaving,
}: {
  template: ConsultationTemplateItem;
  onSave: (tpl: ConsultationTemplateItem) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(template.name);
  const [chief, setChief] = useState(template.chief_complaint ?? "");
  const [findings, setFindings] = useState(template.clinical_findings ?? "");
  const [diagnosis, setDiagnosis] = useState(template.diagnosis ?? "");
  const [advice, setAdvice] = useState(template.advice ?? "");
  const [followUp, setFollowUp] = useState(template.follow_up_advice ?? "");
  const [medicines, setMedicines] = useState<any[]>(
    template.medicines && template.medicines.length > 0
      ? template.medicines
      : [{ medicine_name: "", dosage: "1-0-1", frequency: "1-0-1", food_instruction: "After meal", duration_days: "5" }]
  );

  function addMedicine() {
    setMedicines((m) => [
      ...m,
      { medicine_name: "", strength: "", route: "Oral", frequency: "1-0-1", dosage: "1-0-1", food_instruction: "After meal", duration_days: "5", instructions: "" },
    ]);
  }

  function updateMedicine(index: number, field: string, val: string) {
    setMedicines((arr) =>
      arr.map((item, idx) => (idx === index ? { ...item, [field]: val } : item))
    );
  }

  function removeMedicine(index: number) {
    setMedicines((arr) => arr.filter((_, idx) => idx !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }
    const cleanMedicines = medicines.filter((m) => m.medicine_name?.trim());
    onSave({
      ...template,
      name: name.trim(),
      chief_complaint: chief,
      clinical_findings: findings,
      diagnosis: diagnosis,
      advice: advice,
      follow_up_advice: followUp,
      medicines: cleanMedicines,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="border-2 border-primary/30 rounded-xl p-4 bg-surface-muted/30 space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          {template.id ? "Edit Consultation Template" : "New Consultation Template"}
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Template Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fever / Cold / Cough" required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Diagnosis</Label>
          <Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Acute Viral Bronchitis" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Chief Complaints</Label>
          <Textarea rows={2} value={chief} onChange={(e) => setChief(e.target.value)} placeholder="Symptoms & duration" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Clinical Findings</Label>
          <Textarea rows={2} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Physical exam findings" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Doctor Advice / Diet / Rest</Label>
          <Textarea rows={2} value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="Dietary restrictions, gargles, rest..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Follow-up Advice</Label>
          <Textarea rows={2} value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="Review in 5 days with lab reports" />
        </div>
      </div>

      {/* Medicines list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Template Medicines / Rx</Label>
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addMedicine}>
            <Plus className="size-3 mr-1" /> Add Medicine
          </Button>
        </div>

        <div className="space-y-2">
          {medicines.map((m, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-card p-2 rounded-lg border">
              <div className="col-span-5">
                <Input
                  className="h-8 text-xs"
                  placeholder="Medicine name (e.g. Paracetamol 650mg)"
                  value={m.medicine_name}
                  onChange={(e) => updateMedicine(idx, "medicine_name", e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  className="h-8 text-xs"
                  placeholder="Frequency (1-0-1)"
                  value={m.frequency || m.dosage}
                  onChange={(e) => {
                    updateMedicine(idx, "frequency", e.target.value);
                    updateMedicine(idx, "dosage", e.target.value);
                  }}
                />
              </div>
              <div className="col-span-2">
                <Select
                  value={m.food_instruction || "After meal"}
                  onValueChange={(v) => updateMedicine(idx, "food_instruction", v)}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="After meal">After meal</SelectItem>
                    <SelectItem value="Before meal">Before meal</SelectItem>
                    <SelectItem value="Empty stomach">Empty stomach</SelectItem>
                    <SelectItem value="With meal">With meal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input
                  className="h-8 text-xs"
                  placeholder="Days (e.g. 5)"
                  value={m.duration_days}
                  onChange={(e) => updateMedicine(idx, "duration_days", e.target.value)}
                />
              </div>
              <div className="col-span-1 text-right">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive"
                  onClick={() => removeMedicine(idx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </form>
  );
}
