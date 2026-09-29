import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileSignature,
  PenTool,
  Plus,
  Pencil,
  Trash2,
  Printer,
  Download,
  Eye,
  Calendar,
  User,
  Pill,
  Clock,
  Sparkles,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  type PatientTabNote,
  getPatientTabNotes,
  deletePatientTabNote,
  printTabNote,
} from "@/lib/patient-tab-notes";
import { TabNotePageCanvas } from "./tab-note-page-canvas";

interface PatientTabNotesSectionProps {
  patientId: string;
  patient: {
    id: string;
    full_name?: string | null;
    uhid?: string | null;
    gender?: string | null;
    dob?: string | null;
    blood_group?: string | null;
  };
  department: "OPD" | "IPD" | "OT";
  contextId?: string | null;
  doctorName?: string | null;
  compact?: boolean;
}

export function PatientTabNotesSection({
  patientId,
  patient,
  department,
  contextId,
  doctorName,
  compact = false,
}: PatientTabNotesSectionProps) {
  const qc = useQueryClient();

  // Active view states
  const [editorOpen, setEditorOpen] = useState(false);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [editingNote, setEditingNote] = useState<PatientTabNote | null>(null);
  const [previewNote, setPreviewNote] = useState<PatientTabNote | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<"ALL" | "OPD" | "IPD" | "OT">(department);

  // Query tab notes
  const { data: notes = [], isLoading, refetch } = useQuery({
    queryKey: ["patient-tab-notes", patientId],
    enabled: !!patientId,
    queryFn: () => getPatientTabNotes(patientId),
  });

  const filteredNotes = notes.filter((n) =>
    deptFilter === "ALL" ? true : n.department === deptFilter
  );

  const handleCreateNew = () => {
    setEditingNote(null);
    setIsEditorFullscreen(false);
    setEditorOpen(true);
  };

  const handleEdit = (note: PatientTabNote) => {
    setEditingNote(note);
    setIsEditorFullscreen(false);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deletePatientTabNote(pendingDeleteId, patientId);
      toast.success("Handwritten page deleted from patient record");
      qc.invalidateQueries({ queryKey: ["patient-tab-notes", patientId] });
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete page");
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <PenTool className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Tab Note Pages (Handwriting with Pen)</h2>
            <p className="text-xs text-muted-foreground">
              Write on tablet with stylus pen on hospital letterhead • Erase, undo, clear & medicine names
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Department Filter tabs */}
          <div className="flex rounded-lg border bg-muted/40 p-0.5 text-xs">
            {(["ALL", "OPD", "IPD", "OT"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDeptFilter(d)}
                className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                  deptFilter === d
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <Button size="sm" onClick={handleCreateNew} className="h-9 gap-1.5 shadow-sm">
            <Plus className="size-4" />
            New Tab Page
          </Button>
        </div>
      </div>

      {/* Editor Modal / Workspace */}
      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setIsEditorFullscreen(false);
        }}
      >
        <DialogContent
          className={
            isEditorFullscreen
              ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !border-none !p-2 md:!p-4 overflow-y-auto !z-[99999] bg-background"
              : "max-w-[95vw] md:max-w-6xl max-h-[95vh] overflow-y-auto p-4 md:p-6"
          }
        >
          {!isEditorFullscreen && (
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileSignature className="size-5 text-primary" />
                {editingNote ? "Edit Handwritten Tab Page" : `New ${department} Handwritten Page (Pen & Stylus)`}
              </DialogTitle>
            </DialogHeader>
          )}

          <TabNotePageCanvas
            patient={patient}
            department={editingNote?.department || department}
            contextId={editingNote?.context_id || contextId}
            doctorName={doctorName}
            initialNote={editingNote}
            isFullscreen={isEditorFullscreen}
            onToggleFullscreen={() => setIsEditorFullscreen((prev) => !prev)}
            onSaved={() => {
              setEditorOpen(false);
              setEditingNote(null);
              setIsEditorFullscreen(false);
              qc.invalidateQueries({ queryKey: ["patient-tab-notes", patientId] });
              refetch();
            }}
            onCancel={() => {
              setEditorOpen(false);
              setEditingNote(null);
              setIsEditorFullscreen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewNote} onOpenChange={(open) => !open && setPreviewNote(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-base font-semibold">{previewNote?.title}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {previewNote?.department} • Created {previewNote && format(new Date(previewNote.created_at), "dd MMM yyyy, HH:mm")}
                  {previewNote?.doctor_name && ` • Dr. ${previewNote.doctor_name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => previewNote && printTabNote(previewNote)}
                  className="h-8 text-xs"
                >
                  <Printer className="size-3.5 mr-1" />
                  Print
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (previewNote) {
                      setPreviewNote(null);
                      handleEdit(previewNote);
                    }
                  }}
                  className="h-8 text-xs"
                >
                  <Pencil className="size-3.5 mr-1" />
                  Edit Page
                </Button>
              </div>
            </div>
          </DialogHeader>

          {previewNote && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg overflow-hidden border shadow-sm bg-white flex justify-center">
                <img
                  src={previewNote.image_data}
                  alt={previewNote.title}
                  className="w-full max-w-[700px] h-auto block"
                />
              </div>

              {previewNote.medicines && previewNote.medicines.length > 0 && (
                <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Pill className="size-3.5 text-primary" />
                    Medicines On Page ({previewNote.medicines.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {previewNote.medicines.map((m, idx) => (
                      <div key={idx} className="p-2 rounded border bg-background flex items-center justify-between">
                        <span className="font-medium text-foreground">{m.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {m.dosage || "1-0-1"} {m.duration && `• ${m.duration}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewNote.notes && (
                <div className="p-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground whitespace-pre-wrap">
                  <strong className="text-foreground">Typed Notes: </strong>
                  {previewNote.notes}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Handwritten Page?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this tab note from the patient's record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notes Grid */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading handwritten pages...</div>
      ) : filteredNotes.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <PenTool className="size-6" />
          </div>
          <h3 className="font-semibold text-sm">No Handwritten Pages Yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Doctors can write directly with a tab pen/stylus on the hospital letterhead page with eraser, undo, clear, and medicine tools.
          </p>
          <Button size="sm" onClick={handleCreateNew} className="mt-4 gap-1.5">
            <Plus className="size-3.5" />
            Create First Tab Page
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              className="overflow-hidden border group hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Thumbnail Preview - Full Portrait Medical Sheet Display */}
                <div
                  onClick={() => setPreviewNote(note)}
                  className="relative h-48 bg-slate-100/70 dark:bg-slate-900/60 p-2.5 border-b cursor-pointer overflow-hidden flex items-center justify-center group-hover:bg-slate-100 transition-colors"
                >
                  <img
                    src={note.image_data}
                    alt={note.title}
                    className="h-full w-auto max-w-full object-contain rounded shadow-sm border border-slate-200 dark:border-slate-800 bg-white"
                  />
                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="bg-white/95 text-slate-800 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 shadow-md">
                      <Eye className="size-3.5 text-primary" /> View Page
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider shadow-sm bg-background/90 backdrop-blur-sm"
                  >
                    {note.department}
                  </Badge>
                  {note.medicines && note.medicines.length > 0 && (
                    <Badge
                      variant="outline"
                      className="absolute top-2 right-2 text-[10px] bg-background/90 backdrop-blur-sm shadow-sm flex items-center gap-1"
                    >
                      <Pill className="size-3 text-primary" /> {note.medicines.length} Meds
                    </Badge>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      onClick={() => setPreviewNote(note)}
                      className="font-semibold text-sm line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                      title={note.title}
                    >
                      {note.title}
                    </h3>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3 text-primary/70 shrink-0" />
                      <span>{format(new Date(note.created_at), "dd MMM yyyy, HH:mm")}</span>
                    </div>
                    {note.hospital_name && (
                      <div className="flex items-center gap-1.5 font-medium text-foreground/80 truncate">
                        <Building2 className="size-3 text-primary/70 shrink-0" />
                        <span className="truncate">{note.hospital_name}</span>
                      </div>
                    )}
                    {note.doctor_name && (
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="size-3 text-primary/70 shrink-0" />
                        <span className="truncate">Dr. {note.doctor_name}</span>
                      </div>
                    )}
                  </div>

                  {note.medicines && note.medicines.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {note.medicines.slice(0, 3).map((m, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate max-w-[140px]"
                        >
                          {m.name}
                        </span>
                      ))}
                      {note.medicines.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{note.medicines.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-3 pt-2 border-t mt-2 flex items-center justify-between gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => printTabNote(note)}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground shrink-0"
                >
                  <Printer className="size-3.5 mr-1" />
                  Print
                </Button>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(note)}
                    className="h-8 text-xs font-medium"
                  >
                    <Pencil className="size-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingDeleteId(note.id)}
                    className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete page"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
