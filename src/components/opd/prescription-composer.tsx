import { useEffect, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { PrintHeader, PrintFooter, useHospitalProfile } from "@/components/print-header";
import { format } from "date-fns";
import { Printer, Download, MessageCircle, Save, Eraser, Undo2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shareOnWhatsApp } from "@/lib/share";

export type ComposerContext = {
  prescriptionId: string;
  patient: any;
  doctor: any;
  visit: {
    id: string;
    chief_complaints?: string | null;
    diagnosis?: string | null;
    clinical_findings?: string | null;
    notes?: string | null;
    follow_up_date?: string | null;
    vitals?: any;
  };
  medicines: Array<{ name: string; strength?: string; route?: string; frequency?: string; food?: string; duration?: string; quantity?: string; instructions?: string }>;
  investigations: string[];
  procedures: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: ComposerContext | null;
  onSubmitted?: () => void;
};

export function PrescriptionComposer({ open, onOpenChange, ctx, onSubmitted }: Props) {
  const { data: hospital } = useHospitalProfile();
  const { data: tpl } = useQuery({
    queryKey: ["hospital-settings", "prescription-tpl"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("hospital_settings")
        .select("prescription")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .maybeSingle();
      return (data?.prescription ?? {}) as any;
    },
  });

  const padRef = useRef<SignatureCanvas | null>(null);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [penColor, setPenColor] = useState<"#111827" | "#1d4ed8">("#111827");
  const [penWidth, setPenWidth] = useState(2);
  const [advice, setAdvice] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState<{ handwriting?: string; signature?: string } | null>(null);

  useEffect(() => { if (open) { setAdvice(ctx?.visit?.notes ?? ""); setSavedIds(null); } }, [open, ctx?.visit?.notes]);

  const patientAge = useMemo(() => {
    const dob = ctx?.patient?.dob;
    if (!dob) return "—";
    try {
      const y = new Date().getFullYear() - new Date(dob).getFullYear();
      return `${y}y`;
    } catch { return "—"; }
  }, [ctx?.patient?.dob]);

  const vit = ctx?.visit?.vitals ?? {};
  const autoApplySig = tpl?.auto_apply_signature && tpl?.signature_url;

  async function submit(action: "save" | "print" | "whatsapp" | "download") {
    if (!ctx) return;
    setSaving(true);
    try {
      let handwriting: string | null = null;
      let signature: string | null = null;
      if (padRef.current && !padRef.current.isEmpty()) {
        handwriting = padRef.current.getCanvas().toDataURL("image/png");
      }
      if (sigRef.current && !sigRef.current.isEmpty()) {
        signature = sigRef.current.getCanvas().toDataURL("image/png");
      } else if (autoApplySig) {
        signature = tpl.signature_url;
      }
      const { error } = await (supabase as any)
        .from("prescriptions")
        .update({ handwriting_png: handwriting, signature_png: signature, notes: advice || null })
        .eq("id", ctx.prescriptionId);
      if (error) throw error;
      setSavedIds({ handwriting: handwriting ?? undefined, signature: signature ?? undefined });
      toast.success("Prescription saved");
      onSubmitted?.();

      const url = `${window.location.origin}/prescriptions/${ctx.prescriptionId}/print`;
      if (action === "print" || action === "download") {
        window.open(url, "_blank");
      } else if (action === "whatsapp") {
        if (tpl?.enable_whatsapp === false) return toast.info("WhatsApp not configured.");
        const phone = ctx.patient?.mobile;
        if (!phone) return toast.info("WhatsApp not configured — patient has no mobile.");
        const msg = `Dear ${ctx.patient?.full_name},\n\nYour prescription from ${hospital?.hospital_name ?? "our hospital"} is ready.\n${url}\n\nThank you. Get well soon.`;
        shareOnWhatsApp(msg, undefined, phone);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!ctx) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Digital Prescription</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Review, add handwritten notes, sign and share.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}><X className="size-4" /></Button>
          </div>
        </DialogHeader>

        <div className="grid lg:grid-cols-[1fr_320px] gap-0">
          {/* A4 preview */}
          <div className="p-6 bg-muted/30">
            <div
              className="bg-white text-black shadow-sm border mx-auto"
              style={{ maxWidth: "780px", padding: "18mm", fontFamily: tpl?.font_family || "system-ui", fontSize: tpl?.font_size ? `${tpl.font_size}px` : "13px", position: "relative" }}
            >
              {tpl?.watermark && (
                <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: 0.06, fontSize: 96, transform: "rotate(-30deg)", fontWeight: 800 }}>
                  {tpl.watermark}
                </div>
              )}
              <PrintHeader
                title="Prescription"
                timestamp={new Date()}
                rightSlot={
                  <div>
                    <div className="font-semibold">{ctx.doctor?.name}</div>
                    <div className="text-gray-600 text-[11px]">{ctx.doctor?.specialization}</div>
                  </div>
                }
              />

              {tpl?.header && <div className="mt-2 text-[11px] whitespace-pre-line text-gray-700">{tpl.header}</div>}

              <section className="grid grid-cols-2 gap-x-4 gap-y-1 py-3 text-sm border-b mt-2">
                <div><span className="text-gray-500 text-xs uppercase">Patient: </span>{ctx.patient?.full_name}</div>
                <div><span className="text-gray-500 text-xs uppercase">UHID: </span>{ctx.patient?.uhid}</div>
                <div><span className="text-gray-500 text-xs uppercase">Age/Sex: </span>{patientAge} / <span className="capitalize">{ctx.patient?.gender}</span></div>
                <div><span className="text-gray-500 text-xs uppercase">Date: </span>{format(new Date(), "dd MMM yyyy HH:mm")}</div>
                <div><span className="text-gray-500 text-xs uppercase">Mobile: </span>{ctx.patient?.mobile ?? "—"}</div>
                <div><span className="text-gray-500 text-xs uppercase">Consult ID: </span><span className="font-mono text-[11px]">{ctx.visit.id.slice(0, 8)}</span></div>
              </section>

              {(vit.bp || vit.pulse || vit.temp || vit.spo2 || vit.weight || vit.height) && (
                <section className="py-2 text-xs border-b">
                  <span className="text-gray-500 uppercase mr-2">Vitals:</span>
                  {[vit.bp && `BP ${vit.bp}`, vit.pulse && `PR ${vit.pulse}`, vit.temp && `Temp ${vit.temp}`, vit.spo2 && `SpO₂ ${vit.spo2}`, vit.weight && `Wt ${vit.weight}kg`, vit.height && `Ht ${vit.height}cm`].filter(Boolean).join(" · ")}
                </section>
              )}

              {ctx.visit.chief_complaints && <Block label="Chief complaints">{ctx.visit.chief_complaints}</Block>}
              {ctx.visit.clinical_findings && <Block label="Clinical findings">{ctx.visit.clinical_findings}</Block>}
              {ctx.visit.diagnosis && <Block label="Diagnosis">{ctx.visit.diagnosis}</Block>}

              {ctx.medicines.length > 0 && (
                <section className="py-3 border-b">
                  <div aria-hidden className="text-2xl font-serif italic mb-2">℞</div>
                  <ol className="space-y-2 text-sm">
                    {ctx.medicines.map((m, i) => (
                      <li key={i} className="border-b border-dashed pb-1.5">
                        <div className="flex justify-between">
                          <span className="font-medium">{i + 1}. {m.name}{m.strength ? ` — ${m.strength}` : ""}</span>
                          {m.duration && <span className="text-xs">{m.duration} days{m.quantity ? ` · Qty ${m.quantity}` : ""}</span>}
                        </div>
                        <div className="text-xs text-gray-700">{[m.route, m.frequency, m.food].filter(Boolean).join(" · ")}</div>
                        {m.instructions && <div className="text-xs italic text-gray-600">{m.instructions}</div>}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {ctx.investigations.length > 0 && (
                <Block label="Investigations advised">
                  <ul className="list-disc list-inside space-y-0.5 text-sm">{ctx.investigations.map((i, k) => <li key={k}>{i}</li>)}</ul>
                </Block>
              )}

              {ctx.procedures.length > 0 && (
                <Block label="Procedures">
                  <ul className="list-disc list-inside space-y-0.5 text-sm">{ctx.procedures.map((i, k) => <li key={k}>{i}</li>)}</ul>
                </Block>
              )}

              <section className="py-3 border-b">
                <Label className="text-xs uppercase text-gray-500 mb-1 block">Advice / Diet / Notes</Label>
                <Textarea value={advice} onChange={(e) => setAdvice(e.target.value)} rows={3} className="text-sm" />
              </section>

              {/* Handwriting canvas */}
              <section className="py-3 border-b">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs uppercase text-gray-500">Handwritten notes</Label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setPenColor("#111827")} className={`size-5 rounded-full border-2 ${penColor === "#111827" ? "ring-2 ring-offset-1 ring-primary" : ""}`} style={{ background: "#111827" }} aria-label="Black pen" />
                    <button type="button" onClick={() => setPenColor("#1d4ed8")} className={`size-5 rounded-full border-2 ${penColor === "#1d4ed8" ? "ring-2 ring-offset-1 ring-primary" : ""}`} style={{ background: "#1d4ed8" }} aria-label="Blue pen" />
                    <div className="flex items-center gap-1 w-28"><Slider min={1} max={6} step={1} value={[penWidth]} onValueChange={(v) => setPenWidth(v[0])} /></div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => padRef.current?.undo()}><Undo2 className="size-3.5 mr-1" />Undo</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => padRef.current?.clear()}><Eraser className="size-3.5 mr-1" />Clear</Button>
                  </div>
                </div>
                <div className="border rounded bg-white" style={{ touchAction: "none" }}>
                  <SignatureCanvas
                    ref={(r) => { padRef.current = r; }}
                    penColor={penColor}
                    minWidth={penWidth * 0.6}
                    maxWidth={penWidth}
                    canvasProps={{ width: 720, height: 220, className: "w-full h-[220px] rounded" }}
                  />
                </div>
              </section>

              {/* Signature */}
              <section className="py-3 flex items-end justify-between">
                <div className="text-xs text-gray-600 max-w-[60%]">
                  {tpl?.footer && <div className="whitespace-pre-line">{tpl.footer}</div>}
                  {tpl?.footer_disclaimer && <div className="mt-2 italic">{tpl.footer_disclaimer}</div>}
                </div>
                <div className="text-right w-56">
                  {autoApplySig ? (
                    <img src={tpl.signature_url} alt="Signature" className="ml-auto max-h-16" />
                  ) : (
                    <div className="border rounded bg-white">
                      <SignatureCanvas
                        ref={(r) => { sigRef.current = r; }}
                        penColor="#111827"
                        canvasProps={{ width: 220, height: 70, className: "w-full h-[70px]" }}
                      />
                    </div>
                  )}
                  <div className="border-t border-black mt-1 pt-0.5 text-[11px]">{ctx.doctor?.name}</div>
                  <div className="text-[10px] text-gray-500">Doctor signature</div>
                </div>
              </section>

              <PrintFooter />
            </div>
          </div>

          {/* Side actions */}
          <div className="p-5 border-l bg-background sticky lg:top-[64px] lg:self-start space-y-3">
            <div className="text-sm font-semibold">Actions</div>
            <p className="text-xs text-muted-foreground">Auto-filled from consultation using your hospital's saved prescription template.</p>
            <Separator />
            <Button className="w-full" onClick={() => submit("save")} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
              Submit prescription
            </Button>
            <Button variant="outline" className="w-full" onClick={() => submit("print")} disabled={saving}>
              <Printer className="size-4 mr-2" />Print A4
            </Button>
            <Button variant="outline" className="w-full" onClick={() => submit("download")} disabled={saving}>
              <Download className="size-4 mr-2" />Download PDF
            </Button>
            <Button variant="outline" className="w-full" onClick={() => submit("whatsapp")} disabled={saving}>
              <MessageCircle className="size-4 mr-2" />WhatsApp patient
            </Button>
            {savedIds && (
              <p className="text-[11px] text-emerald-600">Saved to patient history.</p>
            )}
            <Separator />
            <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="py-2 border-b text-sm">
      <h3 className="text-xs uppercase text-gray-500 mb-0.5">{label}</h3>
      <div>{children}</div>
    </section>
  );
}
