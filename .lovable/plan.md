# IPD Enhancements + Discharge Module + Package Billing — Phased Delivery

This is a large 14-task batch. To avoid regressions, I'll ship it in 4 focused phases. Reply "go" to start Phase A, or reorder as you like.

## Phase A — IPD Core Edits + Date Filter (Tasks 1, 2, 3)

**IPD admission detail page (`ipd.$id.tsx`)**
- Add **Edit** button in top action bar (next to Transfer/Discharge)
- Modal to edit: ward/bed, attending doctor, department, diagnosis, admission reason, emergency contact, notes, admission date

**IPD admissions list (`ipd.index.tsx`)**
- Add row-level `RecordActions` (Edit / Print / WhatsApp / Download / Delete-admin) on Active tab (Discharged tab already has it)
- Add **date range filter** (From / To + Today / Week / Month quick buttons) filtering by `admitted_at`
- Excel/PDF export respects filter

**OPD Registration list**
- Ensure per-row Edit / Delete / Print / WhatsApp / Download via `RecordActions`

## Phase B — Discharge Module + Auto Summary (Tasks 4, 5, 6, 8)

- New sidebar item **Discharge** under Clinical, after IPD → route `/discharge`
- Stats cards: Total Discharged, Today, This Month, Pending Summary
- Filters: date range, search (name/UHID/adm no/doctor/mobile), summary-status filter (debounced 300ms)
- Table with per-row actions: View Summary / Edit / Print / WhatsApp / Download / Delete
- **Auto-generate discharge summary** on Confirm Discharge: pull diagnosis (rounds), OT surgeries, ICU stay, medications, last vitals, lab summary, full bill, discharge form data → save to `discharge_summaries`, print via existing `discharge.$id.print` route with hospital branding

## Phase C — Billing Reports + Package Billing (Tasks 7, 10)

**IPD Billing Reports sub-tab**
- Date-range filter + report table (Bill # / Date / Patient / Dept / Total / Paid / Pending / Status)
- Totals footer + Excel/PDF/Print

**Package Billing** (in IPD Billing + Billing Center)
- Uses existing `health_packages` + `scheme_packages`
- List packages with Edit / Delete / Apply-to-Patient
- Admin **+ New Package** form: name, description, line-items (service+price), total (auto/override), duration, department, status
- Apply → inserts package as bill line items

## Phase D — Cross-Cutting Global Passes (Tasks 9, 11, 12, 13, 14)

- **Task 12 — OT Reports** date-range filter + filtered export; OT Schedule date filter
- **Task 13 — Nurse Station MAR** row Edit modal (medicine/dose/route/frequency/timing/instructions/status), Delete (admin), MAR Print + WhatsApp; Nursing Notes already have Edit/Delete
- **Task 9 — Download** button audit across every list module; add where missing (Excel default, PDF for summaries), filename `[Module]_Export_DD-MM-YYYY`
- **Task 11 — Delete** button audit; ensure `RecordActions` present on: HR Attendance, HR Performance, Finance/Accounting, Insurance, Bed Management list, ICU list, OPD Consultation list, any missing lab/rad rows
- **Task 14 — WhatsApp Share** audit; add where missing (report-level + row-level)

## Technical Notes

- Reuse existing `RecordActions`, `ModuleActionBar`, `DateRangeTabs`, `PatientAttachments`, `PrintHeader`, `exportCsv`/`exportXlsx`, `shareOnWhatsApp`, `billing-aggregator`.
- `discharge_summaries` table already exists (13 cols) — reuse.
- No schema changes for Phases A/B/D. Phase C may need a `packages` table if `health_packages`/`scheme_packages` don't fit line-items → I'll evaluate before migrating.
- Delete gating continues to use `useIsSuperAdmin` hook (already covers Admin + Super Admin).
- All mutations invalidate React Query keys.

## Suggested order

**A → B → C → D**, one phase per turn, each ends with a build check.

Reply **go** to start Phase A, or tell me a different order/subset.
