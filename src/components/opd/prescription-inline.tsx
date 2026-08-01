import { useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PrintHeader, PrintFooter } from "@/components/print-header";
import { format } from "date-fns";
import { Printer, Download, MessageCircle, Save, Eraser, Undo2, Receipt, Loader2, FileSignature } from "lucide-react";

export type InlineRxAction = "billing" | "bill" | "print" | "download" | "whatsapp";
export type InlineRxPayload = { handwriting: string | null; signature: string | null; advice: string };

export type InlineRxContext = {
  patient: any;
  doctor: any;
  visit: {
    chief_complaints?: string | null;
    diagnosis?: string | null;
    clinical_findings?: string | null;
    follow_up_date?: string | null;
    vitals?: any;
  };
  medicines: Array<{ name: string; strength?: string; route?: string; frequency?: string; food?: string; duration?: string; quantity?: string; instructions?: string }>;
  investigations: string[];
  procedures: string[];
};

const PEN_COLORS: Array<{ label: string; value: string }> = [
  { label: "Black", value: "#111827" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Red", value: "#dc2626" },
];
const PEN_SIZES: Array<{ label: string; value: number }> = [
  { label: "S", value: 1.5 },
  { label: "M", value: 3 },
  { label: "L", value: 5 },
];

/**
 * Inline (non-modal) digital prescription section rendered at the bottom of the
 * consultation page. Preview auto-syncs from the live consultation form state.
 */
export function PrescriptionInline({
  ctx,
  saving,
  onAction,
}: {
  ctx: InlineRxContext;
  saving?: boolean;
  onAction: (action: InlineRxAction, payload: InlineRxPayload) => void;
}) {
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
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penWidth, setPenWidth] = useState(PEN_SIZES[1].value);
  const [erasing, setErasing] = useState(false);
  const [advice, setAdvice] = useState("");

  const autoApplySig = tpl?.auto_apply_signature && tpl?.signature_url;

  const patientAge = useMemo(() => {
    const dob = ctx.patient?.dob;
    if (!dob) return "—";
    try { return `${new Date().getFullYear() - new Date(dob).getFullYear()}y`; } catch { return "—"; }
  }, [ctx.patient?.dob]);

  const vit = ctx.visit?.vitals ?? {};

  function fire(action: InlineRxAction) {
    const handwriting = padRef.current && !padRef.current.isEmpty() ? padRef.current.getCanvas().toDataURL("image/png") : null;
    let signature: string | null = sigRef.current && !sigRef.current.isEmpty() ? sigRef.current.getCanvas().toDataURL("image/png") : null;
    if (!signature && autoApplySig) signature = tpl.signature_url;
    onAction(action, { handwriting, signature, advice });
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileSignature className="size-4 text-primary" />
        <h2 className="font-semibold text-sm">Digital prescription</h2>
        <span className="text-xs text-muted-foreground">· auto-synced from the sections above</span>
      </div>

      {/* A4 preview */}
      <div className="bg-muted/30 rounded-xl p-4 overflow-x-auto">
        <div
          className="bg-white text-black shadow-sm border mx-auto relative"
          style={{ maxWidth: "780px", padding: "18mm", fontFamily: tpl?.font_family || "system-ui", fontSize: tpl?.font_size ? `${tpl.font_size}px` : "13px" }}
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
            {ctx.visit.follow_up_date && <div><span className="text-gray-500 text-xs uppercase">Follow-up: </span>{ctx.visit.follow_up_date}</div>}
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
            <Textarea value={advice} onChange={(e) => setAdvice(e.target.value)} rows={3} className="text-sm" placeholder="Prescription-only advice (does not change clinical notes above)" />
          </section>

          <section className="py-3 flex items-end justify-between">
            <div className="text-xs text-gray-600 max-w-[60%]">
              {tpl?.footer && <div className="whitespace-pre-line">{tpl.footer}</div>}
              {tpl?.footer_disclaimer && <div className="mt-2 italic">{tpl.footer_disclaimer}</div>}
            </div>
            <div className="text-right w-56">
              {autoApplySig ? (
                <img src={tpl.signature_url} alt="Doctor signature" className="ml-auto max-h-16" />
              ) : (
                <div className="border rounded bg-white" style={{ touchAction: "none" }}>
                  <SignatureCanvas ref={(r) => { sigRef.current = r; }} penColor="#111827" canvasProps={{ width: 220, height: 70, className: "w-full h-[70px]" }} />
                </div>
              )}
              <div className="border-t border-black mt-1 pt-0.5 text-[11px]">{ctx.doctor?.name}</div>
              <div className="text-[10px] text-gray-500">Doctor signature</div>
            </div>
          </section>

          <PrintFooter />
        </div>
      </div>

      {/* Handwriting canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Handwritten notes</Label>
          <div className="flex items-center gap-2 flex-wrap">
            {PEN_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={`${c.label} pen`}
                onClick={() => { setPenColor(c.value); setErasing(false); }}
                className={`size-5 rounded-full border ${!erasing && penColor === c.value ? "ring-2 ring-offset-1 ring-primary" : ""}`}
                style={{ background: c.value }}
              />
            ))}
            <div className="flex items-center gap-1">
              {PEN_SIZES.map((s) => (
                <Button key={s.label} type="button" size="sm" variant={penWidth === s.value && !erasing ? "secondary" : "ghost"} className="h-7 w-7 p-0 text-[11px]"
                  onClick={() => { setPenWidth(s.value); setErasing(false); }}>{s.label}</Button>
              ))}
            </div>
            <Button type="button" size="sm" variant={erasing ? "secondary" : "ghost"} onClick={() => setErasing((e) => !e)}>
              <Eraser className="size-3.5 mr-1" />Eraser
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => {
              const pad = padRef.current; if (!pad) return;
              const data = pad.toData(); if (data.length) { data.pop(); pad.fromData(data); }
            }}><Undo2 className="size-3.5 mr-1" />Undo</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => padRef.current?.clear()}>Clear</Button>
          </div>
        </div>
        <div className="border rounded-lg bg-white" style={{ touchAction: "none" }}>
          <SignatureCanvas
            ref={(r) => { padRef.current = r; }}
            penColor={erasing ? "#ffffff" : penColor}
            minWidth={erasing ? 12 : penWidth * 0.6}
            maxWidth={erasing ? 16 : penWidth}
            canvasProps={{ width: 900, height: 240, className: "w-full h-[240px] rounded-lg" }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t">
        <Button variant="outline" onClick={() => fire("print")} disabled={saving}><Printer className="size-4 mr-2" />Print A4</Button>
        <Button variant="outline" onClick={() => fire("download")} disabled={saving}><Download className="size-4 mr-2" />Download PDF</Button>
        <Button variant="outline" onClick={() => fire("whatsapp")} disabled={saving}><MessageCircle className="size-4 mr-2" />WhatsApp patient</Button>
        <Button variant="secondary" onClick={() => fire("bill")} disabled={saving}><Receipt className="size-4 mr-2" />Save &amp; proceed to Bill</Button>
        <Button onClick={() => fire("billing")} disabled={saving}>
          {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}Submit &amp; go to Billing
        </Button>
      </div>
    </Card>
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
