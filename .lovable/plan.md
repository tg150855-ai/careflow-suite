## Digital Prescription Workflow — Post OPD Consultation

Extend the existing OPD consultation flow (`opd.$appointmentId.tsx`) with a full prescription writing screen that opens automatically after "Save & Complete". The existing consultation save logic is preserved — the new screen sits between save and close.

### 1. Consultation → Prescription handoff
- In `src/routes/_authenticated/opd.$appointmentId.tsx`, when the doctor clicks **Complete Consultation**, keep the current save call but then open a new `PrescriptionComposer` dialog instead of closing the page. A **Skip** option remains so the flow is not blocked.
- The composer receives: visit id, prescription id (auto-created if missing), patient, doctor, vitals, complaints, diagnosis, medicines, investigations, procedures, advice, follow-up.

### 2. Prescription Composer (new component)
`src/components/opd/prescription-composer.tsx` — full-screen dialog with 3 stacked sections on an A4 preview:
- **Auto-loaded template** from `hospital_settings.prescription` (header, footer, watermark, signature URL, paper size, margins, font, QR toggle, disclaimer). Read-only preview using the existing `useHospitalProfile` + `PrintHeader`/`PrintFooter`.
- **Auto-filled clinical block** — patient (name, UHID, age, gender), consultation meta, vitals, diagnosis, complaints, medicines table (editable inline), investigations, procedures, advice, follow-up date. All prefilled from the consultation state already in the page.
- **Handwriting canvas** — `react-signature-canvas` powered smooth pad with pen thickness slider, black/blue color, undo, clear. Saved as PNG data URL and embedded into the prescription record + print.
- **Doctor signature** — draws or auto-applies `hospital_settings.prescription.signature_url` if `auto_apply_signature` is enabled.

### 3. Storage
- Add two nullable columns to `public.prescriptions`: `handwriting_png text`, `signature_png text`, `notes text`. No breaking change; keeps existing rows intact.
- Extend `hospital_settings.prescription` JSON with new keys (font_family, font_size, paper_size, margins, qr_enabled, show_gst, show_registration, show_contact, auto_apply_signature, auto_generate_pdf, enable_whatsapp, enable_print, number_format, footer_disclaimer, signature_url, watermark). No schema change — it's already `jsonb`.
- Add fields to the Prescription tab in `settings.tsx`.

### 4. Print template
- Upgrade `src/routes/prescriptions.$id.print.tsx` to render the professional A4 layout using `PrintHeader`/`PrintFooter`, apply the template settings (watermark, font, margins), render medicines/investigations/procedures, embed the handwriting PNG below, and the signature PNG in the footer. Add optional QR code (patient/prescription URL).

### 5. Post-submit actions
- After submit inside the composer show three buttons: **Print** (opens `/prescriptions/:id/print` and auto-triggers `window.print()`), **Download PDF** (uses browser print-to-PDF via the same route with `?download=1` hint), **WhatsApp Patient** (uses `shareOnWhatsApp` with a link to the print page and the standard message). If `enable_whatsapp` false or no phone → toast "WhatsApp not configured".

### 6. Timeline / history
- Patient history already reads `prescriptions` per visit — no change needed beyond the extra columns, which will surface automatically. Add a small "Rx" badge on the visit card in the existing timeline showing print/whatsapp icons that reuse the same handlers.

### Technical notes
- Handwriting: use `react-signature-canvas` (small, no native deps). Store PNG in DB (small; typical <200 KB) — simpler than uploading to storage and avoids new bucket policies.
- No changes to billing calculations, RLS on prescriptions, or existing consultation save path.
- No new routes; composer is a dialog. Print route is upgraded in place.

### Files touched
- Migration: add `handwriting_png`, `signature_png`, `notes` to `public.prescriptions`.
- `src/components/opd/prescription-composer.tsx` (new).
- `src/routes/_authenticated/opd.$appointmentId.tsx` (open composer after save).
- `src/routes/prescriptions.$id.print.tsx` (professional A4 template + handwriting/signature).
- `src/routes/_authenticated/settings.tsx` (extra Prescription fields).
- `package.json`: add `react-signature-canvas`.

Approve to proceed.
