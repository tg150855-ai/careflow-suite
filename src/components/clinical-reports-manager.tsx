import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  FileText, Pencil, Printer, MessageSquare, Trash2, Search, Plus,
  Stethoscope, BedDouble, Scissors, Eye, Download, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { shareOnWhatsApp } from "@/lib/share";
import { PrintHeader, PrintFooter } from "@/components/print-header";
import { SecureDeleteDialog } from "@/components/common/secure-delete-dialog";

export function ClinicalReportsManager({ defaultDepartment = "opd" }: { defaultDepartment?: "opd" | "ipd" | "ot" }) {
  const [activeTab, setActiveTab] = useState<"opd" | "ipd" | "ot">(defaultDepartment);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  // Selected report for editing
  const [editingReport, setEditingReport] = useState<{ type: "opd" | "ipd" | "ot"; data: any } | null>(null);

  // Selected report for printing/previewing
  const [viewingReport, setViewingReport] = useState<{ type: "opd" | "ipd" | "ot"; data: any } | null>(null);

  // Selected report for deletion
  const [deletingReport, setDeletingReport] = useState<{ type: "opd" | "ipd" | "ot"; id: string; name: string } | null>(null);

  // 1. OPD Reports Query
  const { data: opdVisits = [], isLoading: loadingOpd, refetch: refetchOpd } = useQuery({
    queryKey: ["clinical-reports-opd"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opd_visits")
        .select("*, patients(full_name, uhid, mobile, gender, dob), doctors(name, specialization), prescriptions(*, prescription_items(*))")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. IPD Reports Query (Discharge Summaries & Patient Files)
  const { data: ipdSummaries = [], isLoading: loadingIpd, refetch: refetchIpd } = useQuery({
    queryKey: ["clinical-reports-ipd"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discharge_summaries")
        .select("*, admissions(*, patients(full_name, uhid, mobile, gender, dob), doctors(name, specialization), wards(name), beds(bed_number)), discharge_medications(*)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. OT Operative Reports Query
  const { data: otSurgeries = [], isLoading: loadingOt, refetch: refetchOt } = useQuery({
    queryKey: ["clinical-reports-ot"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("surgeries")
        .select("*, patients(full_name, uhid, mobile, gender, dob), primary:primary_surgeon_id(name), ot_rooms(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingReport) return;
      const { type, id } = deletingReport;
      if (type === "opd") {
        // delete linked prescriptions if any
        await supabase.from("prescriptions").delete().eq("opd_visit_id", id);
        const { error } = await supabase.from("opd_visits").delete().eq("id", id);
        if (error) throw error;
      } else if (type === "ipd") {
        await supabase.from("discharge_medications").delete().eq("discharge_id", id);
        const { error } = await supabase.from("discharge_summaries").delete().eq("id", id);
        if (error) throw error;
      } else if (type === "ot") {
        const { error } = await (supabase as any).from("surgeries").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Clinical report deleted successfully");
      setDeletingReport(null);
      if (deletingReport?.type === "opd") refetchOpd();
      if (deletingReport?.type === "ipd") refetchIpd();
      if (deletingReport?.type === "ot") refetchOt();
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete report"),
  });

  // Filtered lists
  const s = search.trim().toLowerCase();
  const filteredOpd = useMemo(() => {
    return opdVisits.filter((v: any) =>
      !s ||
      v.patients?.full_name?.toLowerCase().includes(s) ||
      v.patients?.uhid?.toLowerCase().includes(s) ||
      v.diagnosis?.toLowerCase().includes(s) ||
      v.doctors?.name?.toLowerCase().includes(s)
    );
  }, [opdVisits, s]);

  const filteredIpd = useMemo(() => {
    return ipdSummaries.filter((d: any) =>
      !s ||
      d.admissions?.patients?.full_name?.toLowerCase().includes(s) ||
      d.admissions?.patients?.uhid?.toLowerCase().includes(s) ||
      d.final_diagnosis?.toLowerCase().includes(s) ||
      d.admissions?.doctors?.name?.toLowerCase().includes(s)
    );
  }, [ipdSummaries, s]);

  const filteredOt = useMemo(() => {
    return otSurgeries.filter((ot: any) =>
      !s ||
      ot.patients?.full_name?.toLowerCase().includes(s) ||
      ot.patients?.uhid?.toLowerCase().includes(s) ||
      ot.procedure_name?.toLowerCase().includes(s) ||
      ot.primary?.name?.toLowerCase().includes(s)
    );
  }, [otSurgeries, s]);

  // WhatsApp Share Handler
  const handleWhatsApp = (type: "opd" | "ipd" | "ot", item: any) => {
    let msg = "";
    let mobile = "";
    if (type === "opd") {
      mobile = item.patients?.mobile;
      msg = `*Clinical Consultation Report — SBG Arogya Plus*\n` +
        `Patient: ${item.patients?.full_name} (${item.patients?.uhid})\n` +
        `Doctor: Dr. ${item.doctors?.name ?? "—"}\n` +
        `Diagnosis: ${item.diagnosis || "Under Evaluation"}\n` +
        `Clinical Notes: ${item.clinical_findings || item.notes || "—"}\n` +
        (item.follow_up_date ? `Next Follow-up: ${format(new Date(item.follow_up_date), "dd MMM yyyy")}\n` : "") +
        `\nThank you for trusting CareFlow Suite.`;
    } else if (type === "ipd") {
      mobile = item.admissions?.patients?.mobile;
      msg = `*IPD Discharge & Clinical Summary — SBG Arogya Plus*\n` +
        `Patient: ${item.admissions?.patients?.full_name} (${item.admissions?.patients?.uhid})\n` +
        `Admission: #${item.admissions?.admission_no}\n` +
        `Primary Diagnosis: ${item.final_diagnosis || "—"}\n` +
        `Hospital Course: ${item.hospital_course || "—"}\n` +
        `Advice: ${item.advice || "—"}\n` +
        (item.follow_up_date ? `Follow-up Date: ${format(new Date(item.follow_up_date), "dd MMM yyyy")}\n` : "") +
        `\nWe wish you a healthy recovery.`;
    } else if (type === "ot") {
      mobile = item.patients?.mobile;
      msg = `*OT Operative & Surgery Report — SBG Arogya Plus*\n` +
        `Procedure: ${item.procedure_name}\n` +
        `Surgery No: ${item.surgery_no}\n` +
        `Patient: ${item.patients?.full_name} (${item.patients?.uhid})\n` +
        `Primary Surgeon: Dr. ${item.primary?.name ?? "—"}\n` +
        `Status: ${item.status?.toUpperCase()}\n` +
        `Notes: ${item.notes || "—"}\n` +
        `\nThank you.`;
    }
    shareOnWhatsApp(msg, undefined, mobile);
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Clinical Reports & Plans Management
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Access, edit, print, download and share clinical reports across OPD, IPD, and OT.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search patient, UHID, doctor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="opd" className="flex items-center gap-1.5">
              <Stethoscope className="size-3.5" />
              OPD Consultations ({filteredOpd.length})
            </TabsTrigger>
            <TabsTrigger value="ipd" className="flex items-center gap-1.5">
              <BedDouble className="size-3.5" />
              IPD Summaries ({filteredIpd.length})
            </TabsTrigger>
            <TabsTrigger value="ot" className="flex items-center gap-1.5">
              <Scissors className="size-3.5" />
              OT Operative Plans ({filteredOt.length})
            </TabsTrigger>
          </TabsList>

          {/* OPD TAB */}
          <TabsContent value="opd">
            {loadingOpd ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading OPD reports...</div>
            ) : filteredOpd.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No OPD consultation reports found.</div>
            ) : (
              <div className="divide-y border rounded-md overflow-hidden bg-card">
                {filteredOpd.map((v: any) => (
                  <div key={v.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{v.patients?.full_name ?? "Unknown Patient"}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{v.patients?.uhid}</Badge>
                        <Badge variant="secondary" className="text-[10px]">Dr. {v.doctors?.name ?? "Physician"}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(v.created_at), "dd MMM yyyy, p")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        <span className="font-medium text-foreground">Diagnosis:</span> {v.diagnosis || "Routine OPD checkup"}
                        {v.chief_complaints && <span className="ml-2">· <span className="font-medium text-foreground">Complaints:</span> {v.chief_complaints}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                        title="Edit Report"
                        onClick={() => setEditingReport({ type: "opd", data: v })}
                      >
                        <Pencil className="size-3.5 mr-1" />
                        <span className="hidden sm:inline text-xs">Edit</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        title="View & Print"
                        onClick={() => setViewingReport({ type: "opd", data: v })}
                      >
                        <Printer className="size-3.5 mr-1" />
                        <span className="hidden sm:inline text-xs">Print</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="Share on WhatsApp"
                        onClick={() => handleWhatsApp("opd", v)}
                      >
                        <MessageSquare className="size-3.5 mr-1" />
                        <span className="hidden sm:inline text-xs">WhatsApp</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Secure Delete"
                        onClick={() => setDeletingReport({ type: "opd", id: v.id, name: `OPD Consultation for ${v.patients?.full_name}` })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* IPD TAB */}
          <TabsContent value="ipd">
            {loadingIpd ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading IPD summaries...</div>
            ) : filteredIpd.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No IPD discharge summaries found.</div>
            ) : (
              <div className="divide-y border rounded-md overflow-hidden bg-card">
                {filteredIpd.map((d: any) => (
                  <div key={d.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{d.admissions?.patients?.full_name ?? "Unknown Patient"}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{d.admissions?.patients?.uhid}</Badge>
                        <Badge variant="secondary" className="text-[10px]">Adm #{d.admissions?.admission_no}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(d.created_at), "dd MMM yyyy")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        <span className="font-medium text-foreground">Diagnosis:</span> {d.final_diagnosis || "—"}
                        {d.hospital_course && <span className="ml-2">· {d.hospital_course}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                        title="Edit Report"
                        onClick={() => setEditingReport({ type: "ipd", data: d })}
                      >
                        <Pencil className="size-3.5 mr-1" />
                        <span className="hidden sm:inline text-xs">Edit</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        title="View & Print"
                        onClick={() => setViewingReport({ type: "ipd", data: d })}
                      >
                        <Printer className="size-3.5 mr-1" />
                        <span className="hidden sm:inline text-xs">Print</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="Share on WhatsApp"
                        onClick={() => handleWhatsApp("ipd", d)}
                      >
                        <MessageSquare className="size-3.5 mr-1" />
                        <span className="hidden sm:inline text-xs">WhatsApp</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Secure Delete"
                        onClick={() => setDeletingReport({ type: "ipd", id: d.id, name: `Discharge Summary for ${d.admissions?.patients?.full_name}` })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* OT TAB */}
          <TabsContent value="ot">
            {loadingOt ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading OT operative plans...</div>
            ) : filteredOt.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No OT operative plans found.</div>
            ) : (
              <div className="divide-y border rounded-md overflow-hidden bg-card">
                {filteredOt.map((ot: any) => (
                  <div key={ot.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{ot.procedure_name}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">#{ot.surgery_no}</Badge>
                        <span className="text-xs font-medium">{ot.patients?.full_name} ({ot.patients?.uhid})</span>
                        <Badge variant="secondary" className="text-[10px]">Surgeon: Dr. {ot.primary?.name ?? "—"}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        <span className="capitalize font-medium text-foreground">Status:</span> {ot.status} · Room: {ot.ot_rooms?.name ?? "—"}
                        {ot.notes && <span className="ml-2">· {ot.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                        title="Edit Report"
                        onClick={() => setEditingReport({ type: "ot", data: ot })}
                      >
                        <Pencil className="size-3.5 mr-1" />
                        <span className="hidden sm:inline text-xs">Edit</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        title="View & Print"
                        onClick={() => setViewingReport({ type: "ot", data: ot })}
                      >
                        <Printer className="size-3.5 mr-1" />
                        <span className="hidden sm:inline text-xs">Print</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="Share on WhatsApp"
                        onClick={() => handleWhatsApp("ot", ot)}
                      >
                        <MessageSquare className="size-3.5 mr-1" />
                        <span className="hidden sm:inline text-xs">WhatsApp</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Secure Delete"
                        onClick={() => setDeletingReport({ type: "ot", id: ot.id, name: `OT Surgery #${ot.surgery_no} (${ot.procedure_name})` })}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* EDIT REPORT MODAL */}
      {editingReport && (
        <EditReportDialog
          report={editingReport}
          open={!!editingReport}
          onOpenChange={(op) => !op && setEditingReport(null)}
          onSaved={() => {
            setEditingReport(null);
            if (editingReport.type === "opd") refetchOpd();
            if (editingReport.type === "ipd") refetchIpd();
            if (editingReport.type === "ot") refetchOt();
          }}
        />
      )}

      {/* PRINT/VIEW MODAL */}
      {viewingReport && (
        <PrintReportDialog
          report={viewingReport}
          open={!!viewingReport}
          onOpenChange={(op) => !op && setViewingReport(null)}
        />
      )}

      {/* SECURE DELETE CONFIRMATION */}
      {deletingReport && (
        <SecureDeleteDialog
          open={!!deletingReport}
          onOpenChange={(op) => !op && setDeletingReport(null)}
          title={`Delete ${deletingReport.name}`}
          description="Are you sure you want to permanently delete this clinical report? This action cannot be undone."
          onConfirm={() => deleteMutation.mutate()}
          loading={deleteMutation.isPending}
        />
      )}
    </Card>
  );
}

// -------------------------------------------------------------
// EDIT REPORT DIALOG
// -------------------------------------------------------------
function EditReportDialog({
  report,
  open,
  onOpenChange,
  onSaved,
}: {
  report: { type: "opd" | "ipd" | "ot"; data: any };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { type, data } = report;

  // OPD State
  const [opdDx, setOpdDx] = useState(data.diagnosis || "");
  const [opdComplaints, setOpdComplaints] = useState(data.chief_complaints || "");
  const [opdFindings, setOpdFindings] = useState(data.clinical_findings || "");
  const [opdNotes, setOpdNotes] = useState(data.notes || "");
  const [opdFollowUp, setOpdFollowUp] = useState(data.follow_up_date || "");

  // IPD State
  const [ipdDx, setIpdDx] = useState(data.final_diagnosis || "");
  const [ipdProcedures, setIpdProcedures] = useState(data.procedures_performed || "");
  const [ipdCourse, setIpdCourse] = useState(data.hospital_course || "");
  const [ipdCondition, setIpdCondition] = useState(data.condition_at_discharge || "Stable");
  const [ipdAdvice, setIpdAdvice] = useState(data.advice || "");
  const [ipdFollowUpInstr, setIpdFollowUpInstr] = useState(data.follow_up_instructions || "");
  const [ipdFollowUpDate, setIpdFollowUpDate] = useState(data.follow_up_date || "");

  // OT State
  const [otProcedure, setOtProcedure] = useState(data.procedure_name || "");
  const [otNotes, setOtNotes] = useState(data.notes || "");
  const [otPreOp, setOtPreOp] = useState(data.pre_op_notes || "");
  const [otPostOp, setOtPostOp] = useState(data.post_op_notes || "");
  const [otImplants, setOtImplants] = useState(data.implants_used || "");
  const [otBloodLoss, setOtBloodLoss] = useState(data.blood_loss_ml || "0");

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (type === "opd") {
        const { error } = await supabase
          .from("opd_visits")
          .update({
            diagnosis: opdDx || null,
            chief_complaints: opdComplaints || null,
            clinical_findings: opdFindings || null,
            notes: opdNotes || null,
            follow_up_date: opdFollowUp || null,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else if (type === "ipd") {
        const { error } = await supabase
          .from("discharge_summaries")
          .update({
            final_diagnosis: ipdDx || null,
            procedures_performed: ipdProcedures || null,
            hospital_course: ipdCourse || null,
            condition_at_discharge: ipdCondition || null,
            advice: ipdAdvice || null,
            follow_up_instructions: ipdFollowUpInstr || null,
            follow_up_date: ipdFollowUpDate || null,
          })
          .eq("id", data.id);
        if (error) throw error;
      } else if (type === "ot") {
        const { error } = await (supabase as any)
          .from("surgeries")
          .update({
            procedure_name: otProcedure,
            notes: otNotes || null,
            pre_op_notes: otPreOp || null,
            post_op_notes: otPostOp || null,
            implants_used: otImplants || null,
            blood_loss_ml: Number(otBloodLoss) || 0,
          })
          .eq("id", data.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Report updated successfully");
      onSaved();
    },
    onError: (err: any) => toast.error(err.message || "Failed to update report"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-primary" />
            Edit {type === "opd" ? "OPD Consultation Report" : type === "ipd" ? "IPD Discharge Summary" : "OT Operative Plan"}
          </DialogTitle>
        </DialogHeader>

        {type === "opd" && (
          <div className="space-y-3.5 py-2">
            <div>
              <Label>Diagnosis</Label>
              <Input value={opdDx} onChange={(e) => setOpdDx(e.target.value)} placeholder="Diagnosis..." />
            </div>
            <div>
              <Label>Chief Complaints</Label>
              <Textarea rows={2} value={opdComplaints} onChange={(e) => setOpdComplaints(e.target.value)} placeholder="Chief complaints..." />
            </div>
            <div>
              <Label>Clinical Examination & Findings</Label>
              <Textarea rows={2} value={opdFindings} onChange={(e) => setOpdFindings(e.target.value)} placeholder="Clinical findings..." />
            </div>
            <div>
              <Label>Doctor Advice / Clinical Notes</Label>
              <Textarea rows={3} value={opdNotes} onChange={(e) => setOpdNotes(e.target.value)} placeholder="Advice or treatment notes..." />
            </div>
            <div>
              <Label>Next Follow-Up Date</Label>
              <Input type="date" value={opdFollowUp} onChange={(e) => setOpdFollowUp(e.target.value)} />
            </div>
          </div>
        )}

        {type === "ipd" && (
          <div className="space-y-3.5 py-2">
            <div>
              <Label>Final Diagnosis</Label>
              <Input value={ipdDx} onChange={(e) => setIpdDx(e.target.value)} placeholder="Final diagnosis..." />
            </div>
            <div>
              <Label>Procedures Performed</Label>
              <Textarea rows={2} value={ipdProcedures} onChange={(e) => setIpdProcedures(e.target.value)} placeholder="Procedures..." />
            </div>
            <div>
              <Label>Hospital Course & Stay Summary</Label>
              <Textarea rows={3} value={ipdCourse} onChange={(e) => setIpdCourse(e.target.value)} placeholder="Course in hospital..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Condition at Discharge</Label>
                <Input value={ipdCondition} onChange={(e) => setIpdCondition(e.target.value)} placeholder="Condition..." />
              </div>
              <div>
                <Label>Follow-Up Date</Label>
                <Input type="date" value={ipdFollowUpDate} onChange={(e) => setIpdFollowUpDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Follow-Up Instructions</Label>
              <Textarea rows={2} value={ipdFollowUpInstr} onChange={(e) => setIpdFollowUpInstr(e.target.value)} placeholder="Instructions..." />
            </div>
            <div>
              <Label>Advice on Discharge</Label>
              <Textarea rows={2} value={ipdAdvice} onChange={(e) => setIpdAdvice(e.target.value)} placeholder="Discharge advice..." />
            </div>
          </div>
        )}

        {type === "ot" && (
          <div className="space-y-3.5 py-2">
            <div>
              <Label>Procedure Name</Label>
              <Input value={otProcedure} onChange={(e) => setOtProcedure(e.target.value)} placeholder="Procedure name..." />
            </div>
            <div>
              <Label>Operative Notes</Label>
              <Textarea rows={3} value={otNotes} onChange={(e) => setOtNotes(e.target.value)} placeholder="Operative findings and steps..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pre-Op Notes</Label>
                <Textarea rows={2} value={otPreOp} onChange={(e) => setOtPreOp(e.target.value)} placeholder="Pre-operative assessment..." />
              </div>
              <div>
                <Label>Post-Op Recovery Orders</Label>
                <Textarea rows={2} value={otPostOp} onChange={(e) => setOtPostOp(e.target.value)} placeholder="Post-op recovery plan..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Implants / Hardware Used</Label>
                <Input value={otImplants} onChange={(e) => setOtImplants(e.target.value)} placeholder="e.g. Mesh, Screw, Plate..." />
              </div>
              <div>
                <Label>Estimated Blood Loss (ml)</Label>
                <Input type="number" value={otBloodLoss} onChange={(e) => setOtBloodLoss(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Updated Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------------------------------------------------
// PRINT / PREVIEW REPORT DIALOG
// -------------------------------------------------------------
function PrintReportDialog({
  report,
  open,
  onOpenChange,
}: {
  report: { type: "opd" | "ipd" | "ot"; data: any };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { type, data } = report;

  const handlePrint = () => {
    window.print();
  };

  const patient = type === "ipd" ? data.admissions?.patients : data.patients;
  const doctor = type === "ipd" ? data.admissions?.doctors : type === "ot" ? data.primary : data.doctors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:p-0 print:border-0 print:shadow-none">
        <DialogHeader className="no-print">
          <div className="flex items-center justify-between pr-4">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="size-4" />
              Clinical Report Preview
            </DialogTitle>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="size-3.5 mr-1.5" />Print Report
            </Button>
          </div>
        </DialogHeader>

        {/* PRINTABLE AREA WITH HOSPITAL HEADER & FOOTER */}
        <div className="p-6 bg-white text-black space-y-4 rounded-md border print:border-0 print:p-0">
          <PrintHeader
            title={type === "opd" ? "OPD Consultation Report" : type === "ipd" ? "IPD Discharge & Clinical Summary" : "Operative Surgical Report"}
            documentNo={type === "opd" ? data.visit_no || data.id?.slice(0, 8) : type === "ipd" ? data.admissions?.admission_no : data.surgery_no}
            timestamp={data.created_at}
            rightSlot={
              <div className="text-right text-xs">
                <div className="font-semibold text-sm">Dr. {doctor?.name ?? "Attending Doctor"}</div>
                <div className="text-gray-600">{doctor?.specialization ?? "Consultant"}</div>
              </div>
            }
          />

          {/* PATIENT INFO BANNER */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-y text-xs">
            <div>
              <span className="text-gray-500 uppercase block font-medium">Patient</span>
              <span className="font-semibold text-sm">{patient?.full_name ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 uppercase block font-medium">UHID / Mobile</span>
              <span>{patient?.uhid ?? "—"} · {patient?.mobile ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 uppercase block font-medium">Gender / Age</span>
              <span className="capitalize">{patient?.gender ?? "—"}</span>
            </div>
            <div>
              <span className="text-gray-500 uppercase block font-medium">Date</span>
              <span>{format(new Date(data.created_at), "dd MMM yyyy")}</span>
            </div>
          </div>

          {/* OPD CONTENT */}
          {type === "opd" && (
            <div className="space-y-4 text-sm">
              {data.chief_complaints && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Chief Complaints</h4>
                  <p className="mt-0.5">{data.chief_complaints}</p>
                </div>
              )}
              {data.clinical_findings && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Clinical Examination & Findings</h4>
                  <p className="mt-0.5">{data.clinical_findings}</p>
                </div>
              )}
              <div>
                <h4 className="text-xs uppercase font-semibold text-gray-500">Diagnosis</h4>
                <p className="mt-0.5 font-medium">{data.diagnosis || "Under Clinical Evaluation"}</p>
              </div>
              {data.notes && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Advice & Treatment Plan</h4>
                  <p className="mt-0.5 whitespace-pre-wrap">{data.notes}</p>
                </div>
              )}
              {data.follow_up_date && (
                <div className="p-2.5 bg-gray-50 rounded border text-xs">
                  <span className="font-semibold">Next Review / Follow-Up:</span> {format(new Date(data.follow_up_date), "dd MMM yyyy")}
                </div>
              )}
            </div>
          )}

          {/* IPD CONTENT */}
          {type === "ipd" && (
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="text-xs uppercase font-semibold text-gray-500">Final Diagnosis</h4>
                <p className="mt-0.5 font-medium">{data.final_diagnosis || "—"}</p>
              </div>
              {data.procedures_performed && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Procedures Performed</h4>
                  <p className="mt-0.5">{data.procedures_performed}</p>
                </div>
              )}
              {data.hospital_course && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Hospital Course & Summary of Stay</h4>
                  <p className="mt-0.5 whitespace-pre-wrap">{data.hospital_course}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Condition at Discharge</h4>
                  <p className="mt-0.5">{data.condition_at_discharge || "Stable"}</p>
                </div>
                {data.follow_up_date && (
                  <div>
                    <h4 className="text-xs uppercase font-semibold text-gray-500">Follow-Up Date</h4>
                    <p className="mt-0.5">{format(new Date(data.follow_up_date), "dd MMM yyyy")}</p>
                  </div>
                )}
              </div>
              {data.advice && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Discharge Advice</h4>
                  <p className="mt-0.5 whitespace-pre-wrap">{data.advice}</p>
                </div>
              )}
            </div>
          )}

          {/* OT CONTENT */}
          {type === "ot" && (
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="text-xs uppercase font-semibold text-gray-500">Procedure Performed</h4>
                <p className="mt-0.5 font-medium text-base">{data.procedure_name}</p>
              </div>
              {data.pre_op_notes && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Pre-Operative Assessment</h4>
                  <p className="mt-0.5">{data.pre_op_notes}</p>
                </div>
              )}
              {data.notes && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Operative Findings & Procedure Steps</h4>
                  <p className="mt-0.5 whitespace-pre-wrap">{data.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {data.implants_used && (
                  <div>
                    <h4 className="text-xs uppercase font-semibold text-gray-500">Implants Used</h4>
                    <p className="mt-0.5">{data.implants_used}</p>
                  </div>
                )}
                {data.blood_loss_ml > 0 && (
                  <div>
                    <h4 className="text-xs uppercase font-semibold text-gray-500">Blood Loss</h4>
                    <p className="mt-0.5">{data.blood_loss_ml} ml</p>
                  </div>
                )}
              </div>
              {data.post_op_notes && (
                <div>
                  <h4 className="text-xs uppercase font-semibold text-gray-500">Post-Op Recovery Plan</h4>
                  <p className="mt-0.5">{data.post_op_notes}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 pt-6 border-t flex justify-between items-end text-xs text-gray-600">
            <div>Patient / Guardian Acknowledgement</div>
            <div className="text-right">
              <div className="font-semibold text-gray-900">Dr. {doctor?.name ?? "Doctor"}</div>
              <div>Authorized Signatory</div>
            </div>
          </div>

          <PrintFooter />
        </div>
      </DialogContent>
    </Dialog>
  );
}
