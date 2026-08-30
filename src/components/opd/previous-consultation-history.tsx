import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  History,
  Calendar,
  User,
  Stethoscope,
  Pill,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  Activity,
  Printer,
  Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Props {
  patientId: string;
  currentAppointmentId?: string;
  hospitalId?: string | null;
  onCopyMedicines?: (medicines: any[]) => void;
  onCopyAdvice?: (advice: string) => void;
  onCopyDiagnosis?: (diagnosis: string, findings?: string) => void;
}

export function PreviousConsultationHistory({
  patientId,
  currentAppointmentId,
  hospitalId,
  onCopyMedicines,
  onCopyAdvice,
  onCopyDiagnosis,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["opd-patient-previous-history", patientId, hospitalId],
    enabled: !!patientId,
    queryFn: async () => {
      let query = supabase
        .from("opd_visits")
        .select(`
          id,
          appointment_id,
          chief_complaints,
          diagnosis,
          clinical_findings,
          notes,
          follow_up_date,
          vitals,
          created_at,
          doctors(id, name, specialization),
          prescriptions(
            id,
            prescription_items(
              id,
              medicine_name,
              dosage,
              timing,
              food_instruction,
              duration_days,
              notes,
              position
            )
          )
        `)
        .eq("patient_id", patientId);

      if (hospitalId) {
        query = query.eq("hospital_id", hospitalId);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        console.error("[opd-patient-previous-history] error", error);
        return [];
      }

      // Filter out the current active appointment visit from previous history
      const prev = (data ?? []).filter(
        (v: any) => !currentAppointmentId || v.appointment_id !== currentAppointmentId
      );
      return prev;
    },
  });

  const latestVisit = visits[0];

  function handleCopyAllMeds(v: any) {
    const rxItems = v.prescriptions?.[0]?.prescription_items ?? [];
    if (!rxItems.length) {
      toast.info("No medicines recorded in this previous visit.");
      return;
    }
    const clean = rxItems.map((it: any) => ({
      medicine_name: it.medicine_name ?? "",
      strength: "",
      route: "Oral",
      frequency: it.dosage ?? "1-0-1",
      dosage: it.dosage ?? "1-0-1",
      food_instruction: it.food_instruction ?? "After meal",
      duration_days: it.duration_days ? String(it.duration_days) : "5",
      instructions: it.notes ?? "",
    }));
    onCopyMedicines?.(clean);
    toast.success(`Copied ${clean.length} medicines to current prescription`);
  }

  return (
    <div>
      {/* Quick compact bar / header button */}
      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-surface-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <History className="size-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold flex items-center gap-1.5 flex-wrap">
              <span>Previous History</span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {visits.length} past visit{visits.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {latestVisit ? (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Last: <b>{latestVisit.diagnosis || latestVisit.chief_complaints || "Consultation"}</b> ({format(new Date(latestVisit.created_at), "dd MMM yyyy")} by {latestVisit.doctors?.name ?? "Doctor"})
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">New patient or no previous OPD history recorded.</p>
            )}
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs shrink-0"
          onClick={() => setModalOpen(true)}
          disabled={visits.length === 0}
        >
          View Full History
        </Button>
      </div>

      {/* Full History Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              Patient Previous Consultation History
            </DialogTitle>
            <DialogDescription>
              Chronological records of all past OPD consultations, diagnoses, prescriptions, and clinical notes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {visits.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No past consultations recorded for this patient.
              </div>
            ) : (
              <div className="space-y-3">
                {visits.map((v: any, index: number) => {
                  const isExpanded = expandedId === v.id || (index === 0 && expandedId === null);
                  const rxItems = v.prescriptions?.[0]?.prescription_items ?? [];
                  const vit = v.vitals ?? {};

                  return (
                    <Card key={v.id} className="p-4 border-l-4 border-l-primary/70 space-y-3">
                      <div
                        className="flex items-start justify-between gap-2 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? "" : v.id)}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {format(new Date(v.created_at), "dd MMMM yyyy · HH:mm")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({formatDistanceToNow(new Date(v.created_at), { addSuffix: true })})
                            </span>
                            {index === 0 && (
                              <Badge variant="default" className="text-[10px] h-4">
                                Latest
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <User className="size-3 text-primary" />
                            <span>Doctor: <b>{v.doctors?.name ?? "Consulting Physician"}</b> {v.doctors?.specialization ? `(${v.doctors.specialization})` : ""}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {rxItems.length > 0 && onCopyMedicines && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyAllMeds(v);
                              }}
                            >
                              <Copy className="size-3 text-primary" /> Re-prescribe ({rxItems.length})
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-7"
                          >
                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Summary Badges */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {v.diagnosis && (
                          <div className="font-medium text-foreground bg-primary/10 px-2 py-0.5 rounded">
                            Dx: {v.diagnosis}
                          </div>
                        )}
                        {v.chief_complaints && (
                          <div className="text-muted-foreground bg-surface-muted px-2 py-0.5 rounded truncate max-w-sm">
                            CC: {v.chief_complaints}
                          </div>
                        )}
                        {rxItems.length > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Pill className="size-2.5 mr-1" /> {rxItems.length} Meds
                          </Badge>
                        )}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="space-y-3 pt-3 border-t text-xs">
                          {/* Vitals */}
                          {Object.values(vit).some((x) => x) && (
                            <div className="bg-surface-muted/40 p-2.5 rounded-lg border">
                              <div className="font-semibold text-[10px] uppercase text-muted-foreground mb-1 flex items-center gap-1">
                                <Activity className="size-3 text-primary" /> Vitals Recorded:
                              </div>
                              <div className="flex items-center gap-4 flex-wrap text-muted-foreground">
                                {vit.bp && <span>BP: <b>{vit.bp}</b></span>}
                                {vit.pulse && <span>Pulse: <b>{vit.pulse} bpm</b></span>}
                                {vit.temp && <span>Temp: <b>{vit.temp} °F</b></span>}
                                {vit.spo2 && <span>SpO₂: <b>{vit.spo2}%</b></span>}
                                {vit.weight && <span>Weight: <b>{vit.weight} kg</b></span>}
                              </div>
                            </div>
                          )}

                          {/* Clinical Findings & Diagnosis */}
                          <div className="grid sm:grid-cols-2 gap-2">
                            {v.chief_complaints && (
                              <div className="p-2.5 rounded-lg border bg-card">
                                <div className="font-semibold text-[10px] uppercase text-muted-foreground mb-0.5">Chief Complaints:</div>
                                <div className="text-foreground whitespace-pre-wrap">{v.chief_complaints}</div>
                              </div>
                            )}
                            {v.clinical_findings && (
                              <div className="p-2.5 rounded-lg border bg-card">
                                <div className="font-semibold text-[10px] uppercase text-muted-foreground mb-0.5">Clinical Examination Findings:</div>
                                <div className="text-foreground whitespace-pre-wrap">{v.clinical_findings}</div>
                              </div>
                            )}
                          </div>

                          {v.notes && (
                            <div className="p-2.5 rounded-lg border bg-card">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-semibold text-[10px] uppercase text-muted-foreground">Doctor Advice & Notes:</span>
                                {onCopyAdvice && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 px-1 text-[10px]"
                                    onClick={() => {
                                      onCopyAdvice(v.notes);
                                      toast.success("Advice copied");
                                    }}
                                  >
                                    Copy Advice
                                  </Button>
                                )}
                              </div>
                              <div className="text-foreground whitespace-pre-wrap">{v.notes}</div>
                            </div>
                          )}

                          {/* Medicines list */}
                          {rxItems.length > 0 && (
                            <div className="space-y-1.5 p-2.5 rounded-lg border bg-card">
                              <div className="flex items-center justify-between font-semibold text-[10px] uppercase text-muted-foreground">
                                <span>Prescribed Medicines ({rxItems.length}):</span>
                                {onCopyMedicines && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 px-1 text-[10px] text-primary"
                                    onClick={() => handleCopyAllMeds(v)}
                                  >
                                    <Copy className="size-2.5 mr-1" /> Copy All Medicines
                                  </Button>
                                )}
                              </div>
                              <div className="divide-y divide-border/60">
                                {rxItems.map((m: any, mIdx: number) => (
                                  <div key={m.id ?? mIdx} className="py-1.5 flex items-center justify-between gap-2">
                                    <div>
                                      <div className="font-medium text-foreground">
                                        {mIdx + 1}. {m.medicine_name}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        {m.dosage || m.timing || "—"} · {m.food_instruction || "After meal"} {m.duration_days ? `· for ${m.duration_days} days` : ""}
                                      </div>
                                    </div>
                                    {m.notes && (
                                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground max-w-[150px] truncate">
                                        {m.notes}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {v.follow_up_date && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="size-3 text-primary" />
                              <span>Follow-up Recommended: <b>{v.follow_up_date}</b></span>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
