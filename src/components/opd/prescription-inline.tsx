import { useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useHospitalProfile } from "@/components/print-header";
import { format, differenceInCalendarDays } from "date-fns";
import { Printer, Download, MessageCircle, Save, Eraser, Undo2, Receipt, Loader2, FileSignature, Plus, X } from "lucide-react";

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

const RX_RED = "#8B0000";

/**
 * Inline (non-modal) digital prescription section rendered at the bottom of the
 * consultation page. Preview auto-syncs from the live consultation form state.
 * Supports extra continuation pages (notes + own canvas) with A4 print breaks.
 */
export function PrescriptionInline({
  ctx,
  saving,
  onAction,
  bare,
}: {
  ctx: InlineRxContext;
  saving?: boolean;
  onAction: (action: InlineRxAction, payload: InlineRxPayload) => void;
  /** render without the outer Card (used inside the prescription modal/drawer) */
  bare?: boolean;
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
  const { data: hosp } = useHospitalProfile();

  const padRef = useRef<SignatureCanvas | null>(null);
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penWidth, setPenWidth] = useState(PEN_SIZES[1].value);
  const [erasing, setErasing] = useState(false);
  const [advice, setAdvice] = useState("");
  const [extraPages, setExtraPages] = useState<Array<{ id: number; text: string }>>([]);

  const autoApplySig = tpl?.auto_apply_signature && tpl?.signature_url;
  const totalPages = 1 + extraPages.length;

  const patientAge = useMemo(() => {
    const dob = ctx.patient?.dob;
    if (!dob) return "—";
    try { return `${new Date().getFullYear() - new Date(dob).getFullYear()}y`; } catch { return "—"; }
  }, [ctx.patient?.dob]);

  const vit = ctx.visit?.vitals ?? {};
  const vitals = [
    vit.bp && `BP: ${vit.bp}`,
    vit.pulse && `Pulse: ${vit.pulse}`,
    vit.temp && `Temp: ${vit.temp}`,
    vit.spo2 && `SpO₂: ${vit.spo2}`,
    vit.weight && `Wt: ${vit.weight}kg`,
    vit.height && `Ht: ${vit.height}cm`,
  ].filter(Boolean) as string[];

  const followUpDays = useMemo(() => {
    if (!ctx.visit.follow_up_date) return null;
    try { return differenceInCalendarDays(new Date(ctx.visit.follow_up_date), new Date()); } catch { return null; }
  }, [ctx.visit.follow_up_date]);

  const adviceLines = advice.split("\n").map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);

  function fire(action: InlineRxAction) {
    const handwriting = padRef.current && !padRef.current.isEmpty() ? padRef.current.getCanvas().toDataURL("image/png") : null;
    let signature: string | null = sigRef.current && !sigRef.current.isEmpty() ? sigRef.current.getCanvas().toDataURL("image/png") : null;
    if (!signature && autoApplySig) signature = tpl.signature_url;
    onAction(action, { handwriting, signature, advice });
  }

  const doctorName = ctx.doctor?.name ?? "—";
  const doctorQual = ctx.doctor?.qualification || ctx.doctor?.specialization || "";
  const doctorReg = ctx.doctor?.registration_no || ctx.doctor?.reg_no || "";

  const PageHeader = ({ page }: { page: number }) => (
    <header className="rx-header">
      <div className="flex items-start gap-4 pb-2">
        {hosp?.logo_url ? (
          <img src={hosp.logo_url} alt={hosp.hospital_name} style={{ maxHeight: 60, maxWidth: 120, objectFit: "contain" }} className="shrink-0" />
        ) : null}
        <div className="flex-1 min-w-0">
          <div style={{ color: hosp?.primary_color || "#0F172A", fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>
            {hosp?.hospital_name}
          </div>
          {hosp?.address && <div className="text-[11px] text-gray-700 whitespace-pre-line mt-0.5">{hosp.address}</div>}
          <div className="text-[11px] text-gray-700">
            {[hosp?.phone && `Ph: ${hosp.phone}`, hosp?.email && `Email: ${hosp.email}`, hosp?.gst_no && `GST: ${hosp.gst_no}`].filter(Boolean).join("  |  ")}
          </div>
        </div>
        <div className="text-right text-[11px] shrink-0 border-l pl-3">
          <div className="font-semibold text-[12px]">{doctorName}</div>
          {doctorQual && <div className="text-gray-600">{doctorQual}</div>}
          {doctorReg && <div className="text-gray-600">Reg No: {doctorReg}</div>}
        </div>
      </div>
      <div className="h-[2px] w-full" style={{ background: hosp?.primary_color || "#0EA5E9" }} />
      <div className="flex items-center justify-between py-1.5 text-[12px]">
        <div className="font-semibold uppercase tracking-wider" style={{ color: RX_RED }}>✦ Prescription{page > 1 ? " (continued)" : ""}</div>
        <div className="text-gray-600">Date: {format(new Date(), "dd/MM/yyyy")}&nbsp;&nbsp;{format(new Date(), "HH:mm")}</div>
      </div>
      <div className="h-px w-full bg-gray-300" />
    </header>
  );

  const PageFooter = ({ page }: { page: number }) => (
    <footer className="rx-footer mt-6 pt-2 border-t text-[10px] text-gray-500 flex justify-between">
      <span>This is a computer-generated prescription.</span>
      <span>Page {page} of {totalPages}</span>
    </footer>
  );

  const pageStyle: React.CSSProperties = {
    maxWidth: "794px",
    minHeight: "1000px",
    padding: "16mm",
    fontFamily: tpl?.font_family || "ui-sans-serif, system-ui, sans-serif",
    fontSize: tpl?.font_size ? `${tpl.font_size}px` : "13px",
  };

  const body = (
    <div className="space-y-4">
      <div className="flex items-center gap-2 no-print">
        <FileSignature className="size-4 text-primary" />
        <h2 className="font-semibold text-sm">Digital prescription</h2>
        <span className="text-xs text-muted-foreground hidden sm:inline">· auto-synced from the sections above</span>
      </div>

      <div className="space-y-4">
        {/* A4 pages */}
        <div className="bg-muted/30 rounded-xl p-2 sm:p-4 overflow-x-auto prescription-print-area space-y-6 rx-scale-wrap">
          {/* PAGE 1 */}
          <div className="rx-page bg-white text-black shadow-md border mx-auto relative" style={pageStyle}>

            {tpl?.watermark && (
              <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ opacity: 0.06, fontSize: 96, transform: "rotate(-30deg)", fontWeight: 800 }}>
                {tpl.watermark}
              </div>
            )}
            <PageHeader page={1} />
            {tpl?.header && <div className="mt-2 text-[11px] whitespace-pre-line text-gray-700">{tpl.header}</div>}

            {/* Patient block */}
            <section className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] mt-3" style={{ background: "#f8f9fa", border: "1px solid #dee2e6", padding: 12 }}>
              <div><span className="text-gray-500">Patient: </span><span className="font-semibold">{ctx.patient?.full_name}</span></div>
              <div><span className="text-gray-500">UHID: </span>{ctx.patient?.uhid}</div>
              <div><span className="text-gray-500">Age/Sex: </span>{patientAge} / <span className="capitalize">{ctx.patient?.gender}</span></div>
              <div><span className="text-gray-500">Date: </span>{format(new Date(), "dd MMM yyyy  HH:mm")}</div>
              <div><span className="text-gray-500">Mobile: </span>{ctx.patient?.mobile ?? "—"}</div>
              <div><span className="text-gray-500">Ref. Doctor: </span>______________</div>
              {ctx.patient?.address && <div className="col-span-2"><span className="text-gray-500">Address: </span>{ctx.patient.address}</div>}
            </section>

            {/* Vitals strip */}
            {vitals.length > 0 && (
              <div className="text-[11px] text-gray-600 py-2 border-b">{vitals.join("  |  ")}</div>
            )}

            {ctx.visit.chief_complaints && (
              <div className="py-2 border-b text-[12.5px]"><span className="font-bold" style={{ color: RX_RED }}>C/O: </span>{ctx.visit.chief_complaints}</div>
            )}
            {ctx.visit.clinical_findings && (
              <div className="py-2 border-b text-[12.5px]"><span className="font-bold" style={{ color: RX_RED }}>O/E: </span>{ctx.visit.clinical_findings}</div>
            )}
            {ctx.visit.diagnosis && (
              <div className="py-2 border-b text-[12.5px]"><span className="font-bold" style={{ color: RX_RED }}>Dx: </span>{ctx.visit.diagnosis}</div>
            )}

            {/* Medicines table */}
            {ctx.medicines.length > 0 && (
              <section className="py-3">
                <div aria-hidden style={{ color: RX_RED, fontSize: 30, fontWeight: 800, lineHeight: 1 }} className="font-serif italic mb-2">℞</div>
                <table className="w-full text-[11.5px] border-collapse print-zebra">
                  <thead>
                    <tr style={{ background: "#eef2f7" }}>
                      {["#", "Medicine", "Strength", "Route", "Frequency", "Duration", "Instructions"].map((h) => (
                        <th key={h} className="border border-gray-300 px-1.5 py-1 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ctx.medicines.map((m, i) => (
                      <tr key={i} className="medicine-row" style={{ background: i % 2 ? "#f7fbff" : "#fff" }}>
                        <td className="border border-gray-300 px-1.5 py-1">{i + 1}</td>
                        <td className="border border-gray-300 px-1.5 py-1 font-semibold">{m.name}</td>
                        <td className="border border-gray-300 px-1.5 py-1">{m.strength || "—"}</td>
                        <td className="border border-gray-300 px-1.5 py-1">{m.route || "—"}</td>
                        <td className="border border-gray-300 px-1.5 py-1">{m.frequency || "—"}</td>
                        <td className="border border-gray-300 px-1.5 py-1">{m.duration ? `${m.duration} days` : "—"}{m.quantity ? ` · Qty ${m.quantity}` : ""}</td>
                        <td className="border border-gray-300 px-1.5 py-1">{[m.food, m.instructions].filter(Boolean).join(" · ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Investigations */}
            {ctx.investigations.length > 0 && (
              <section className="py-2 border-t text-[12.5px]">
                <div className="font-bold mb-1">Investigations Ordered:</div>
                <ul className="space-y-0.5">
                  {ctx.investigations.map((i, k) => <li key={k}>☐ {i}</li>)}
                </ul>
              </section>
            )}

            {/* Procedures */}
            {ctx.procedures.length > 0 && (
              <section className="py-2 border-t text-[12.5px]">
                <div className="font-bold mb-1">Procedures:</div>
                <ul className="space-y-0.5">{ctx.procedures.map((p, k) => <li key={k}>• {p}</li>)}</ul>
              </section>
            )}

            {/* Advice */}
            <section className="py-2 border-t text-[12.5px]">
              <div className="font-bold mb-1">Advice:</div>
              <ul className="space-y-0.5 mb-2">
                {adviceLines.map((l, k) => <li key={k}>• {l}</li>)}
              </ul>
              <Textarea
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                rows={3}
                className="text-sm no-print"
                placeholder="One advice per line — rest, fluids, diet, red-flag instructions…"
              />
            </section>

            {/* Follow-up */}
            {ctx.visit.follow_up_date && (
              <section className="py-2 border-t text-[12.5px]">
                <span className="font-bold">Follow-up: </span>
                {format(new Date(ctx.visit.follow_up_date), "dd MMM yyyy")}
                {followUpDays != null && followUpDays > 0 ? `  (after ${followUpDays} days)` : ""}
                <div className="text-[11px] text-gray-600">Review if symptoms persist before follow-up date.</div>
              </section>
            )}

            {/* Signature block */}
            <section className="grid grid-cols-2 gap-4 pt-6 mt-4 border-t">
              <div className="text-[11.5px]">
                {autoApplySig ? (
                  <img src={tpl.signature_url} alt="Doctor signature" className="max-h-14 mb-1" />
                ) : (
                  <div className="border rounded bg-white mb-1 no-print" style={{ touchAction: "none", width: 230 }}>
                    <SignatureCanvas ref={(r) => { sigRef.current = r; }} penColor="#111827" canvasProps={{ width: 230, height: 64, className: "w-full h-[64px]" }} />
                  </div>
                )}
                <div className="border-t border-black w-56 pt-0.5 font-semibold">{doctorName}</div>
                {doctorQual && <div className="text-gray-600">{doctorQual}</div>}
                {doctorReg && <div className="text-gray-600">Reg No: {doctorReg}</div>}
                <div className="text-gray-600">Date: {format(new Date(), "dd/MM/yyyy")}</div>
              </div>
              <div className="text-[11px] text-gray-400 border border-dashed rounded flex items-center justify-center min-h-[90px]">
                Hospital Stamp
              </div>
            </section>

            {tpl?.footer && <div className="text-[10px] text-gray-600 whitespace-pre-line mt-2">{tpl.footer}</div>}
            {tpl?.footer_disclaimer && <div className="text-[10px] italic text-gray-500">{tpl.footer_disclaimer}</div>}
            <PageFooter page={1} />
          </div>

          {/* Handwriting canvas (page 1) */}
          <div className="rx-page bg-white text-black shadow-md border mx-auto space-y-2" style={{ ...pageStyle, minHeight: "auto" }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs uppercase tracking-wide text-gray-500">Additional Notes / Diagram:</Label>
              <div className="flex items-center gap-2 flex-wrap no-print">
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
                  const data = pad.toData(); if (data.length) { redoRef.current.push(data.pop()); pad.fromData(data); }
                }}><Undo2 className="size-3.5 mr-1" />Undo</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => {
                  const pad = padRef.current; if (!pad) return;
                  const stroke = redoRef.current.pop(); if (!stroke) return;
                  pad.fromData([...pad.toData(), stroke]);
                }}><Redo2 className="size-3.5 mr-1" />Redo</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { redoRef.current = []; padRef.current?.clear(); }}>Clear</Button>

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

          {/* Continuation pages */}
          {extraPages.map((p, idx) => (
            <ContinuationPage
              key={p.id}
              pageStyle={pageStyle}
              index={idx + 2}
              total={totalPages}
              header={<PageHeader page={idx + 2} />}
              footer={<PageFooter page={idx + 2} />}
              text={p.text}
              onText={(v) => setExtraPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, text: v } : x)))}
              onRemove={() => setExtraPages((ps) => ps.filter((x) => x.id !== p.id))}
            />
          ))}
        </div>

        {/* Sticky action bar */}
        <div className="no-print sticky bottom-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur border-t">
          <div className="flex flex-wrap items-center gap-2">
            <Button className="flex-1 min-w-[180px]" onClick={() => fire("billing")} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}Submit &amp; go to Billing
            </Button>
            <Button variant="secondary" onClick={() => fire("bill")} disabled={saving}><Receipt className="size-4 mr-2" />Save &amp; Bill</Button>
            <Button variant="outline" onClick={() => fire("print")} disabled={saving}><Printer className="size-4 mr-2" />Print A4</Button>
            <Button variant="outline" onClick={() => fire("download")} disabled={saving}><Download className="size-4 mr-2" />PDF</Button>
            <Button variant="outline" onClick={() => fire("whatsapp")} disabled={saving}><MessageCircle className="size-4 mr-2" />WhatsApp</Button>
            <Button variant="ghost" onClick={() => setExtraPages((ps) => [...ps, { id: Date.now(), text: "" }])}>
              <Plus className="size-4 mr-2" />Add Page
            </Button>
            <span className="text-[11px] text-muted-foreground ml-auto">{totalPages} page{totalPages > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (bare) return body;
  return <Card className="p-5">{body}</Card>;
}


function ContinuationPage({
  pageStyle, index, header, footer, text, onText, onRemove,
}: {
  pageStyle: React.CSSProperties; index: number; total: number;
  header: React.ReactNode; footer: React.ReactNode;
  text: string; onText: (v: string) => void; onRemove: () => void;
}) {
  const padRef = useRef<SignatureCanvas | null>(null);
  return (
    <div className="rx-page bg-white text-black shadow-md border mx-auto relative" style={pageStyle}>
      <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7 no-print" onClick={onRemove} aria-label={`Remove page ${index}`}>
        <X className="size-4" />
      </Button>
      {header}
      <section className="py-3">
        <Label className="text-xs uppercase text-gray-500 mb-1 block">Additional notes (page {index})</Label>
        {text && <div className="text-[12.5px] whitespace-pre-line mb-2">{text}</div>}
        <Textarea value={text} onChange={(e) => onText(e.target.value)} rows={4} className="text-sm no-print" placeholder="Continue the prescription here…" />
      </section>
      <section className="space-y-2">
        <Label className="text-xs uppercase text-gray-500">Notes / Diagram</Label>
        <div className="border rounded-lg bg-white" style={{ touchAction: "none" }}>
          <SignatureCanvas ref={(r) => { padRef.current = r; }} penColor="#111827" canvasProps={{ width: 900, height: 220, className: "w-full h-[220px] rounded-lg" }} />
        </div>
        <div className="flex justify-end no-print">
          <Button type="button" size="sm" variant="ghost" onClick={() => padRef.current?.clear()}>Clear</Button>
        </div>
      </section>
      {footer}
    </div>
  );
}
