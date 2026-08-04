import { supabase } from "@/integrations/supabase/client";

/**
 * Renders the discharge summary as a self-contained printable HTML file and
 * files it under the patient's documents (department: IPD) so it shows up in
 * Document Management / patient history automatically.
 */
export async function archiveDischargeDocument(opts: {
  patientId: string;
  admissionNo?: string | null;
  patientName?: string | null;
  uhid?: string | null;
  doctorName?: string | null;
  dischargeId: string;
  fields: Record<string, string>;
  meds: { medicine_name: string; dosage?: string; duration?: string; instructions?: string }[];
  uploadedBy?: string | null;
  uploadedByName?: string | null;
}) {
  const rows = Object.entries(opts.fields)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `<h3>${escapeHtml(k)}</h3><p>${escapeHtml(v).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const medRows = opts.meds
    .filter((m) => m.medicine_name?.trim())
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.medicine_name)}</td><td>${escapeHtml(m.dosage ?? "")}</td><td>${escapeHtml(
          m.duration ?? "",
        )}</td><td>${escapeHtml(m.instructions ?? "")}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Discharge Summary — ${escapeHtml(opts.patientName ?? "")}</title>
<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#111;max-width:800px;margin:32px auto;padding:0 24px}
h1{font-size:20px}h3{font-size:13px;text-transform:uppercase;border-bottom:1px solid #ddd;margin:16px 0 4px}
p{font-size:13px;white-space:pre-wrap;margin:0}table{width:100%;border-collapse:collapse;font-size:13px}
td,th{border-bottom:1px dashed #ccc;text-align:left;padding:4px 2px}@page{size:A4;margin:14mm}</style></head><body>
<h1>Discharge Summary</h1>
<p><b>Patient:</b> ${escapeHtml(opts.patientName ?? "")} &nbsp; <b>UHID:</b> ${escapeHtml(opts.uhid ?? "")}<br/>
<b>Admission:</b> ${escapeHtml(opts.admissionNo ?? "")} &nbsp; <b>Treating doctor:</b> ${escapeHtml(opts.doctorName ?? "")}<br/>
<b>Generated:</b> ${new Date().toLocaleString()}</p>
${rows}
${medRows ? `<h3>Medicines at discharge</h3><table><thead><tr><th>Medicine</th><th>Dose</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${medRows}</tbody></table>` : ""}
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const fileName = `Discharge-Summary-${(opts.admissionNo ?? opts.dischargeId).replace(/[^\w-]/g, "")}.html`;
  const path = `${opts.patientId}/discharge/${Date.now()}-${fileName}`;

  const { error: upErr } = await supabase.storage.from("patient-documents").upload(path, blob, {
    contentType: "text/html",
    upsert: true,
  });
  if (upErr) throw upErr;

  const { error } = await (supabase as any).from("patient_documents").insert({
    patient_id: opts.patientId,
    department: "IPD",
    file_name: fileName,
    file_type: "text/html",
    file_size: blob.size,
    storage_path: path,
    description: `Discharge summary — ${opts.admissionNo ?? ""}`.trim(),
    uploaded_by: opts.uploadedBy ?? null,
    uploaded_by_name: opts.uploadedByName ?? null,
  });
  if (error) throw error;
  return path;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
