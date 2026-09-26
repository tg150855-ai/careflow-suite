import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, MessageSquare, ArrowLeft, Download } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { PrintHeader, PrintFooter } from "@/components/print-header";
import { shareOnWhatsApp } from "@/lib/share";

export const Route = createFileRoute("/ipd-dossier/$id/print")({ component: PrintIpdPatientFile });

function inr(n?: number | null) {
  return "₹" + Number(n ?? 0).toLocaleString("en-IN");
}

function PrintIpdPatientFile() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["ipd-complete-file", id],
    queryFn: async () => {
      // 1. Admission details
      const { data: adm, error: admErr } = await supabase
        .from("admissions")
        .select("*, patients(*), doctors(name, specialization), wards(name, type), beds(bed_number, charge_per_day)")
        .eq("id", id)
        .single();
      if (admErr || !adm) throw admErr || new Error("Admission not found");

      const patientId = adm.patient_id;

      // Parallel query for all clinical records of this admission
      const [
        vitalsRes,
        roundsRes,
        marRes,
        nursingRes,
        surgeriesRes,
        labsRes,
        radRes,
        billRes,
        dischargeRes,
      ] = await Promise.all([
        supabase.from("vitals").select("*").eq("admission_id", id).order("recorded_at", { ascending: true }),
        supabase.from("doctor_rounds").select("*, doctors(name)").eq("admission_id", id).order("rounded_at", { ascending: true }),
        supabase.from("medication_administration").select("*").eq("admission_id", id).order("scheduled_at", { ascending: true }),
        (supabase as any).from("nursing_notes").select("*").eq("admission_id", id).order("created_at", { ascending: true }),
        (supabase as any).from("surgeries").select("*, primary:primary_surgeon_id(name), ot_rooms(name)").or(`admission_id.eq.${id},patient_id.eq.${patientId}`).order("created_at", { ascending: true }),
        supabase.from("lab_orders").select("*, lab_results(*)").or(`admission_id.eq.${id},patient_id.eq.${patientId}`).order("created_at", { ascending: true }),
        (supabase as any).from("radiology_orders").select("*, radiology_reports(*)").or(`admission_id.eq.${id},patient_id.eq.${patientId}`).order("created_at", { ascending: true }),
        supabase.from("bills").select("*, bill_items(*), payments(*)").eq("admission_id", id).maybeSingle(),
        supabase.from("discharge_summaries").select("*, discharge_medications(*)").eq("admission_id", id).maybeSingle(),
      ]);

      return {
        adm,
        vitals: vitalsRes.data ?? [],
        rounds: roundsRes.data ?? [],
        mar: marRes.data ?? [],
        nursing: nursingRes.data ?? [],
        surgeries: surgeriesRes.data ?? [],
        labs: labsRes.data ?? [],
        radiology: radRes.data ?? [],
        bill: billRes.data,
        discharge: dischargeRes.data,
      };
    },
  });

  if (isLoading || !data) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Generating Complete IPD Patient Dossier...</div>;
  }

  const { adm, vitals, rounds, mar, nursing, surgeries, labs, radiology, bill, discharge } = data;
  const p = adm.patients;
  const days = Math.max(1, differenceInDays(adm.discharged_at ? new Date(adm.discharged_at) : new Date(), new Date(adm.admitted_at)) + 1);

  const handleWhatsApp = () => {
    const msg = `*Complete IPD Patient File / Dossier — SBG Arogya Plus*\n` +
      `Patient: ${p?.full_name} (${p?.uhid})\n` +
      `Admission: #${adm.admission_no}\n` +
      `Ward: ${adm.wards?.name ?? "—"} / Bed ${adm.beds?.bed_number ?? "—"}\n` +
      `Treating Consultant: Dr. ${adm.doctors?.name ?? "—"}\n` +
      `Stay Duration: ${days} day(s)\n` +
      `Status: ${adm.status?.toUpperCase()}\n` +
      (discharge?.final_diagnosis ? `Final Diagnosis: ${discharge.final_diagnosis}\n` : "") +
      (bill ? `Total Bill: ${inr(bill.total)} | Outstanding: ${inr(bill.pending)}\n` : "") +
      `\nDigital patient record verified by CareFlow Hospital Suite.`;
    shareOnWhatsApp(msg, undefined, p?.mobile);
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans pb-12">
      {/* ACTION BAR (HIDDEN IN PRINT) */}
      <div className="no-print bg-slate-900 text-white py-3 px-6 sticky top-0 z-50 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-slate-800">
              <Link to="/ipd/$id" params={{ id }}><ArrowLeft className="size-4 mr-1.5" />Back to IPD Record</Link>
            </Button>
            <div className="font-semibold text-sm">
              Complete IPD Patient File — {p?.full_name} ({adm.admission_no})
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="bg-transparent text-white border-slate-700 hover:bg-slate-800" onClick={handleWhatsApp}>
              <MessageSquare className="size-4 mr-1.5 text-emerald-400" />WhatsApp
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => window.print()}>
              <Printer className="size-4 mr-1.5" />Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      {/* PRINTABLE DOSSIER CONTAINER */}
      <div className="max-w-4xl mx-auto p-8 print:p-0 space-y-6">
        {/* HOSPITAL HEADER */}
        <PrintHeader
          title="Complete Inpatient Medical Record (IPD Dossier)"
          documentNo={adm.admission_no}
          timestamp={adm.admitted_at}
          rightSlot={
            <div className="text-right text-xs">
              <div className="font-semibold text-sm">Treating: Dr. {adm.doctors?.name}</div>
              <div className="text-gray-600">{adm.doctors?.specialization}</div>
              <Badge variant="outline" className="mt-1 font-mono uppercase text-[10px]">{adm.status}</Badge>
            </div>
          }
        />

        {/* 1. PATIENT & ADMISSION SUMMARY BANNER */}
        <div className="border rounded-md p-4 bg-slate-50 text-xs grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-gray-500 uppercase block font-semibold text-[10px]">Patient Name</span>
            <span className="font-bold text-sm text-gray-900">{p?.full_name}</span>
            <div className="text-gray-600">{p?.gender} · {p?.dob ? `${new Date().getFullYear() - new Date(p.dob).getFullYear()} yrs` : "—"}</div>
          </div>
          <div>
            <span className="text-gray-500 uppercase block font-semibold text-[10px]">UHID / Mobile</span>
            <span className="font-medium text-gray-900">{p?.uhid}</span>
            <div className="text-gray-600">{p?.mobile ?? "—"}</div>
          </div>
          <div>
            <span className="text-gray-500 uppercase block font-semibold text-[10px]">Admission Details</span>
            <span className="font-medium text-gray-900">Adm #{adm.admission_no}</span>
            <div className="text-gray-600">{format(new Date(adm.admitted_at), "dd MMM yyyy, p")} ({days} days)</div>
          </div>
          <div>
            <span className="text-gray-500 uppercase block font-semibold text-[10px]">Ward & Bed</span>
            <span className="font-medium text-gray-900">{adm.wards?.name ?? "—"}</span>
            <div className="text-gray-600">Bed: {adm.beds?.bed_number ?? "—"} ({inr(adm.beds?.charge_per_day)}/day)</div>
          </div>
        </div>

        {/* 2. ADMISSION & CLINICAL DIAGNOSIS */}
        <div className="border-t pt-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b pb-1 mb-2">1. Clinical Assessment & Diagnosis</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold block text-gray-700">Initial Admission Diagnosis:</span>
              <p className="mt-0.5 text-gray-900">{adm.initial_diagnosis || "—"}</p>
            </div>
            {discharge?.final_diagnosis && (
              <div>
                <span className="font-semibold block text-gray-700">Final Discharge Diagnosis:</span>
                <p className="mt-0.5 text-gray-900 font-medium">{discharge.final_diagnosis}</p>
              </div>
            )}
            {adm.notes && (
              <div className="col-span-2">
                <span className="font-semibold block text-gray-700">Admission Notes:</span>
                <p className="mt-0.5 text-gray-900 whitespace-pre-wrap">{adm.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. VITALS PROGRESSION */}
        {vitals.length > 0 && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b pb-1 mb-2">2. Inpatient Vitals Monitoring</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="py-1 px-2">Date/Time</th>
                    <th className="py-1 px-2">BP (mmHg)</th>
                    <th className="py-1 px-2">Pulse (bpm)</th>
                    <th className="py-1 px-2">Temp (°F)</th>
                    <th className="py-1 px-2">SpO₂ (%)</th>
                    <th className="py-1 px-2">Resp Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-800">
                  {vitals.map((v: any) => (
                    <tr key={v.id}>
                      <td className="py-1 px-2">{format(new Date(v.recorded_at), "dd MMM yyyy, HH:mm")}</td>
                      <td className="py-1 px-2 font-mono">{v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}</td>
                      <td className="py-1 px-2">{v.pulse ?? "—"}</td>
                      <td className="py-1 px-2">{v.temperature ? `${v.temperature}°F` : "—"}</td>
                      <td className="py-1 px-2">{v.spo2 ? `${v.spo2}%` : "—"}</td>
                      <td className="py-1 px-2">{v.respiratory_rate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. DOCTOR ROUNDS */}
        {rounds.length > 0 && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b pb-1 mb-2">3. Doctor Rounds & Clinical Notes</h2>
            <div className="space-y-2">
              {rounds.map((r: any) => (
                <div key={r.id} className="p-2.5 bg-gray-50 rounded border text-xs">
                  <div className="flex justify-between items-center text-gray-600 mb-1">
                    <span className="font-semibold text-gray-900">Dr. {r.doctors?.name ?? adm.doctors?.name}</span>
                    <span>{format(new Date(r.rounded_at), "dd MMM yyyy, HH:mm")}</span>
                  </div>
                  {r.clinical_findings && <div className="text-gray-800 mb-0.5"><span className="font-medium text-gray-700">Findings:</span> {r.clinical_findings}</div>}
                  {r.progress_notes && <div className="text-gray-800 mb-0.5"><span className="font-medium text-gray-700">Progress Notes:</span> {r.progress_notes}</div>}
                  {r.follow_up_orders && <div className="text-gray-800"><span className="font-medium text-gray-700">Orders:</span> {r.follow_up_orders}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. MEDICATION ADMINISTRATION RECORD (MAR) */}
        {mar.length > 0 && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b pb-1 mb-2">4. Inpatient Medication Administration (MAR)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="py-1 px-2">Medicine</th>
                    <th className="py-1 px-2">Dosage</th>
                    <th className="py-1 px-2">Route</th>
                    <th className="py-1 px-2">Scheduled</th>
                    <th className="py-1 px-2">Administered</th>
                    <th className="py-1 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-gray-800">
                  {mar.map((m: any) => (
                    <tr key={m.id}>
                      <td className="py-1 px-2 font-medium">{m.medicine_name}</td>
                      <td className="py-1 px-2">{m.dosage ?? "—"}</td>
                      <td className="py-1 px-2">{m.route ?? "Oral"}</td>
                      <td className="py-1 px-2">{format(new Date(m.scheduled_at), "dd MMM, HH:mm")}</td>
                      <td className="py-1 px-2">{m.administered_at ? format(new Date(m.administered_at), "dd MMM, HH:mm") : "—"}</td>
                      <td className="py-1 px-2 capitalize">{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. SURGERIES / PROCEDURES */}
        {surgeries.length > 0 && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b pb-1 mb-2">5. Surgical Interventions & Procedures</h2>
            <div className="space-y-2">
              {surgeries.map((s: any) => (
                <div key={s.id} className="p-2.5 bg-gray-50 rounded border text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-900">{s.procedure_name} (#{s.surgery_no})</span>
                    <Badge variant="outline" className="capitalize text-[10px]">{s.status}</Badge>
                  </div>
                  <div className="text-gray-600">Surgeon: Dr. {s.primary?.name ?? "—"} · Room: {s.ot_rooms?.name ?? "—"}</div>
                  {s.notes && <div className="mt-1 text-gray-800"><span className="font-medium">Operative Notes:</span> {s.notes}</div>}
                  {s.implants_used && <div className="mt-0.5 text-gray-800"><span className="font-medium">Implants:</span> {s.implants_used}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. DIAGNOSTIC INVESTIGATIONS (LAB & RADIOLOGY) */}
        {(labs.length > 0 || radiology.length > 0) && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b pb-1 mb-2">6. Diagnostic Investigations & Reports</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {labs.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Laboratory Orders</h3>
                  <div className="space-y-1">
                    {labs.map((lo: any) => (
                      <div key={lo.id} className="p-2 bg-gray-50 rounded border">
                        <div className="font-medium text-gray-900">Order #{lo.order_no} ({lo.status})</div>
                        {(lo.lab_results ?? []).map((r: any) => (
                          <div key={r.id} className="text-[11px] text-gray-700 flex justify-between">
                            <span>{r.test_name}</span>
                            <span className="font-mono">{r.result_value} {r.unit ?? ""} {r.flag ? `[${r.flag}]` : ""}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {radiology.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-1">Radiology & Imaging</h3>
                  <div className="space-y-1">
                    {radiology.map((ro: any) => (
                      <div key={ro.id} className="p-2 bg-gray-50 rounded border">
                        <div className="font-medium text-gray-900">{ro.modality} — {ro.test_name || ro.investigation}</div>
                        {(ro.radiology_reports ?? []).map((rp: any) => (
                          <div key={rp.id} className="text-[11px] text-gray-700 mt-1">
                            {rp.impression && <div><span className="font-medium">Impression:</span> {rp.impression}</div>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. NURSING CARE NOTES */}
        {nursing.length > 0 && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b pb-1 mb-2">7. Nursing Shift Notes</h2>
            <div className="space-y-1 text-xs">
              {nursing.slice(-6).map((n: any) => (
                <div key={n.id} className="p-1.5 bg-gray-50 rounded border flex justify-between items-start gap-2">
                  <div className="text-gray-800">
                    <span className="font-semibold capitalize text-gray-700">{n.shift} Shift:</span> {n.note}
                  </div>
                  <span className="text-[10px] text-gray-500 shrink-0">{format(new Date(n.created_at), "dd MMM, HH:mm")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. DISCHARGE & FOLLOW-UP INSTRUCTIONS */}
        {discharge && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b pb-1 mb-2">8. Discharge Summary & Take-Home Instructions</h2>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-semibold text-gray-700 block">Condition at Discharge:</span>
                  <p>{discharge.condition_at_discharge || "Stable"}</p>
                </div>
                {discharge.follow_up_date && (
                  <div>
                    <span className="font-semibold text-gray-700 block">Follow-Up Review Date:</span>
                    <p className="font-bold text-gray-900">{format(new Date(discharge.follow_up_date), "dd MMM yyyy")}</p>
                  </div>
                )}
              </div>
              {discharge.follow_up_instructions && (
                <div>
                  <span className="font-semibold text-gray-700 block">Follow-Up Instructions:</span>
                  <p className="whitespace-pre-wrap">{discharge.follow_up_instructions}</p>
                </div>
              )}
              {discharge.advice && (
                <div>
                  <span className="font-semibold text-gray-700 block">Advice on Discharge:</span>
                  <p className="whitespace-pre-wrap">{discharge.advice}</p>
                </div>
              )}
              {(discharge.discharge_medications ?? []).length > 0 && (
                <div>
                  <span className="font-semibold text-gray-700 block mb-1">Discharge Medications (Take Home):</span>
                  <table className="w-full text-xs border rounded divide-y">
                    <thead className="bg-gray-100">
                      <tr><th className="py-1 px-2 text-left">Medicine</th><th className="py-1 px-2 text-left">Dosage</th><th className="py-1 px-2 text-left">Duration</th><th className="py-1 px-2 text-left">Instructions</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {discharge.discharge_medications.map((m: any) => (
                        <tr key={m.id}><td className="py-1 px-2 font-medium">{m.medicine_name}</td><td className="py-1 px-2">{m.dosage}</td><td className="py-1 px-2">{m.duration}</td><td className="py-1 px-2">{m.instructions}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 10. BILLING & FINANCIAL SUMMARY */}
        {bill && (
          <div className="border-t pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b pb-1 mb-2">9. IPD Financial & Billing Summary</h2>
            <div className="bg-slate-50 border rounded p-3 text-xs flex justify-between items-center flex-wrap gap-4">
              <div>
                <span className="text-gray-500 block">Invoice Number:</span>
                <span className="font-mono font-bold text-sm">{bill.bill_no}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Total Amount:</span>
                <span className="font-bold text-sm">{inr(bill.total)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Amount Paid:</span>
                <span className="font-bold text-sm text-emerald-600">{inr(bill.paid)}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Balance Pending:</span>
                <span className="font-bold text-sm text-rose-600">{inr(bill.pending)}</span>
              </div>
              <div>
                <Badge variant="outline" className="capitalize">{bill.status}</Badge>
              </div>
            </div>
          </div>
        )}

        {/* SIGNATURE BLOCK */}
        <div className="mt-12 pt-8 border-t flex justify-between items-end text-xs text-gray-600">
          <div>
            <div className="border-t border-gray-400 w-44 mb-1"></div>
            <div>Patient / Attender Signature</div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 w-44 mb-1"></div>
            <div>Nursing Supervisor</div>
          </div>
          <div className="text-right">
            <div className="border-t border-gray-400 w-44 mb-1"></div>
            <div className="font-semibold text-gray-900">Dr. {adm.doctors?.name}</div>
            <div>Treating Consultant</div>
          </div>
        </div>

        {/* HOSPITAL PRINT FOOTER */}
        <PrintFooter />
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          @page { margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
