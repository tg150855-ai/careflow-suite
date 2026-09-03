import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DischargeTemplateItem,
  fetchDischargeTemplates,
  saveDischargeTemplate,
  deleteDischargeTemplate,
} from "@/lib/discharge-templates";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookmarkPlus,
  FileText,
  Pill,
  Calendar,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Settings2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export interface DischargeTemplateApplyPayload {
  primary_diagnosis: string;
  secondary_diagnosis?: string;
  doctor_notes?: string;
  hospital_course?: string;
  follow_up_instructions?: string;
  follow_up_date?: string;
  condition_at_discharge?: string;
  medicines: Array<{
    id: string;
    medicine_name: string;
    dose?: string;
    route?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
}

interface Props {
  hospitalId?: string | null;
  doctorId?: string | null;
  currentValues?: {
    primary_diagnosis?: string;
    secondary_diagnosis?: string;
    doctor_notes?: string;
    hospital_course?: string;
    follow_up_instructions?: string;
    condition_at_discharge?: string;
    medicines?: any[];
  };
  onApplyTemplate: (data: DischargeTemplateApplyPayload) => void;
  className?: string;
}

export function DischargeTemplateSelector({
  hospitalId,
  doctorId,
  currentValues,
  onApplyTemplate,
  className,
}: Props) {
  const qc = useQueryClient();
  const queryKey = ["discharge-templates", hospitalId, doctorId];

  const { data: templates = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDischargeTemplates({ hospitalId, doctorId }),
    staleTime: 60 * 1000,
  });

  const [selectedId, setSelectedId] = useState<string>("");
  const [manageOpen, setManageOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("General");
  const [search, setSearch] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId),
    [templates, selectedId]
  );

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    const map = new Map<string, DischargeTemplateItem[]>();
    templates.forEach((t) => {
      const cat = t.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    });
    return Array.from(map.entries());
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.primary_diagnosis.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q)
    );
  }, [templates, search]);

  const saveMutation = useMutation({
    mutationFn: (item: Omit<DischargeTemplateItem, "id"> & { id?: string }) =>
      saveDischargeTemplate(item, { hospitalId, doctorId }),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey });
      toast.success(`Discharge template "${saved.name}" saved!`);
      setSaveOpen(false);
      setNewTemplateName("");
      setSelectedId(saved.id);
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to save template"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDischargeTemplate(id, { hospitalId, doctorId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Template removed");
      if (selectedId) setSelectedId("");
    },
    onError: (err: any) => toast.error(err?.message ?? "Failed to delete template"),
  });

  const handleApply = (tpl: DischargeTemplateItem) => {
    const days = tpl.follow_up_days ?? 7;
    const followUpDateObj = new Date();
    followUpDateObj.setDate(followUpDateObj.getDate() + days);
    const followUpDate = followUpDateObj.toISOString().slice(0, 10);

    const meds = (tpl.medicines || []).map((m) => ({
      id: crypto.randomUUID(),
      medicine_name: m.medicine_name,
      dose: m.dose || m.dosage || "",
      dosage: m.dose || m.dosage || "",
      route: m.route || "Oral",
      frequency: m.frequency || "1-0-1",
      duration: m.duration || `${days} days`,
      instructions: m.instructions || "",
    }));

    onApplyTemplate({
      primary_diagnosis: tpl.primary_diagnosis,
      secondary_diagnosis: tpl.secondary_diagnosis || "",
      doctor_notes: tpl.doctor_notes || tpl.advice || "",
      hospital_course: tpl.hospital_course || "",
      follow_up_instructions: tpl.follow_up_instructions || "",
      follow_up_date: followUpDate,
      condition_at_discharge: tpl.condition_at_discharge || "Stable",
      medicines: meds,
    });

    toast.success(`Template applied: ${tpl.name}`);
  };

  const handleSaveCurrentAsTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    const meds = (currentValues?.medicines || []).map((m: any) => ({
      medicine_name: m.medicine_name || "",
      dose: m.dose || m.dosage || "",
      dosage: m.dose || m.dosage || "",
      route: m.route || "",
      frequency: m.frequency || "",
      duration: m.duration || "",
      instructions: m.instructions || "",
    }));

    saveMutation.mutate({
      name: newTemplateName.trim(),
      category: newTemplateCategory.trim() || "General",
      primary_diagnosis: currentValues?.primary_diagnosis || "",
      secondary_diagnosis: currentValues?.secondary_diagnosis || "",
      doctor_notes: currentValues?.doctor_notes || "",
      hospital_course: currentValues?.hospital_course || "",
      follow_up_instructions: currentValues?.follow_up_instructions || "",
      follow_up_days: 7,
      condition_at_discharge: currentValues?.condition_at_discharge || "Stable",
      medicines: meds,
    });
  };

  return (
    <div className={`p-3 bg-muted/30 rounded-lg border flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Discharge Summary Template
          </span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
            Auto-fills all fields & meds
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
            onClick={() => setManageOpen(true)}
            title="Browse & manage all templates"
          >
            <Settings2 className="size-3.5 mr-1" />
            Manage
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => {
              setNewTemplateName(currentValues?.primary_diagnosis ? `${currentValues.primary_diagnosis} Template` : "");
              setSaveOpen(true);
            }}
            title="Save current discharge form as a reusable template"
          >
            <BookmarkPlus className="size-3.5 mr-1 text-primary" />
            Save Current as Template
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <Select
            value={selectedId}
            onValueChange={(val) => {
              setSelectedId(val);
              const found = templates.find((t) => t.id === val);
              if (found) handleApply(found);
            }}
          >
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue placeholder={isLoading ? "Loading templates…" : "Select a discharge template to auto-fill…"} />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {groupedTemplates.map(([cat, items]) => (
                <SelectGroup key={cat}>
                  <SelectLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1 bg-muted/40">
                    {cat}
                  </SelectLabel>
                  {items.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs py-1.5">
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="font-medium">{tpl.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          {tpl.medicines?.length || 0} meds
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplate && (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-9 text-xs px-3"
            onClick={() => handleApply(selectedTemplate)}
          >
            <Sparkles className="size-3.5 mr-1.5" />
            Re-apply Template
          </Button>
        )}
      </div>

      {/* Mini preview if a template is selected */}
      {selectedTemplate && (
        <div className="bg-background/80 rounded border p-2.5 text-xs grid grid-cols-1 md:grid-cols-2 gap-2 mt-0.5">
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold">Primary Diagnosis:</div>
            <div className="font-medium text-foreground truncate">{selectedTemplate.primary_diagnosis}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground font-semibold">Follow-up:</div>
            <div className="text-foreground truncate">
              {selectedTemplate.follow_up_days ? `Review in ${selectedTemplate.follow_up_days} days` : "As advised"} · {selectedTemplate.condition_at_discharge ?? "Stable"}
            </div>
          </div>
          <div className="md:col-span-2 flex items-center gap-1.5 flex-wrap pt-1 border-t border-dashed">
            <Pill className="size-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-semibold">Pre-configured Meds ({selectedTemplate.medicines?.length || 0}):</span>
            <div className="flex gap-1 flex-wrap">
              {selectedTemplate.medicines?.slice(0, 4).map((m, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] py-0 px-1 font-normal">
                  {m.medicine_name.replace(/^(Tab|Cap|Syp|Inj)\s+/i, "")}
                </Badge>
              ))}
              {(selectedTemplate.medicines?.length || 0) > 4 && (
                <span className="text-[10px] text-muted-foreground">+{selectedTemplate.medicines.length - 4} more</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save current form as template Dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Discharge Template</DialogTitle>
            <DialogDescription>
              Create a reusable discharge template from the current form data. Doctors and staff can select it anytime to auto-fill diagnoses, notes, and prescriptions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Template Name</Label>
              <Input
                placeholder="e.g. Post-Op Hernia Repair, Acute Asthma Exacerbation"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department / Category</Label>
              <Input
                placeholder="e.g. General Surgery, Cardiology, Orthopedics, Medicine"
                value={newTemplateCategory}
                onChange={(e) => setNewTemplateCategory(e.target.value)}
              />
            </div>
            <div className="rounded border bg-muted/30 p-2 text-xs space-y-1">
              <div className="font-semibold text-muted-foreground">Items to be captured in template:</div>
              <div>• Primary: {currentValues?.primary_diagnosis || "—"}</div>
              <div>• Secondary: {currentValues?.secondary_diagnosis || "—"}</div>
              <div>• Prescription: {(currentValues?.medicines || []).length} take-home medicines</div>
              <div>• Follow-up Instructions & Doctor's Notes</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCurrentAsTemplate}
              disabled={saveMutation.isPending || !newTemplateName.trim()}
            >
              <CheckCircle2 className="size-3.5 mr-1.5" />
              {saveMutation.isPending ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage templates modal */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Discharge Summary Templates</DialogTitle>
            <DialogDescription>
              Browse standard clinical templates and custom templates created for your hospital.
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search templates by name, department, or diagnosis…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="overflow-y-auto flex-1 divide-y border rounded-md">
            {filteredTemplates.map((t) => {
              const isDefault = t.id.startsWith("dtpl-") && !t.id.startsWith("dtpl-custom-");
              return (
                <div key={t.id} className="p-3 hover:bg-muted/30 flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{t.name}</span>
                      <Badge variant="outline" className="text-[10px] py-0">
                        {t.category || "General"}
                      </Badge>
                      {isDefault && (
                        <Badge variant="secondary" className="text-[10px] py-0 font-normal">
                          Standard
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      <span className="font-semibold">Dx:</span> {t.primary_diagnosis}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      <span className="font-semibold">Meds ({t.medicines?.length || 0}):</span>{" "}
                      {t.medicines?.map((m) => m.medicine_name).join(", ") || "None"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        handleApply(t);
                        setSelectedId(t.id);
                        setManageOpen(false);
                      }}
                    >
                      <Sparkles className="size-3 mr-1" />
                      Apply
                    </Button>
                    {!isDefault && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(t.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete custom template"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredTemplates.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No discharge templates found matching &ldquo;{search}&rdquo;.
              </div>
            )}
          </div>

          <DialogFooter className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setManageOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
