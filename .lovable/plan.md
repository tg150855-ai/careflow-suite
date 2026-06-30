# SBG Arogya Plus — Phased Build Plan

This is a large, cross-module change set. To stay safe (no regressions to OPD/IPD/OT/ICU/Nurse Station that already work), I'll ship it in **8 phases**, each independently verifiable. Reply `continue` after each phase to move on.

---

## Phase 0 — Foundations (shared, no UI change)
Build the primitives every later phase reuses so we don't repeat work or break existing screens.

- **`super_admin` role gate**: helper `useIsSuperAdmin()` + `<RequireSuperAdmin>` wrapper. `Delete` buttons everywhere will use this — non–super-admins won't even see them.
- **`<RecordActions>` component**: standard Edit / Delete / Print / Save / Download / WhatsApp button group, each opt-in via props (reuses existing `ModuleActionBar` pattern).
- **`<DateRangeFilter From → To>`**: pairs with existing `useDateRange`.
- **`lib/billing-aggregator.ts`**: single source-of-truth function `getPatientBillingSummary(patientId)` that pulls from `bills`, `bill_items`, `payments`, `pharmacy_sales`, `lab_orders`, `radiology_orders`, `surgeries`, `icu_procedures`, `nursing_service_catalog` usage, `bed_transfers` (room/bed days), `emergency_cases`. Returns department-wise breakdown + totals + pending.
- **`lib/whatsapp-share.ts`**: already partially exists (`lib/share.ts`) — extend with PDF-link share helper.

No DB change, no visual change.

---

## Phase 1 — Sidebar + Centralized Billing module shell
- Remove **Appointments** from sidebar (route preserved).
- Add **Billing** sidebar item directly below IPD.
- New route `/billing-center` (keeps existing `/billing` invoice routes intact):
  - Patient search by UHID / Patient ID / IPD ID.
  - Summary screen wired to `getPatientBillingSummary`.
  - Department-wise table, itemized list, payments, discounts, tax, pending, total, payment status badge.
  - Record Payment dialog (writes to `payments` and updates root bill).
  - `RecordActions`: Print / Save (PDF) / Download (Excel) / WhatsApp.

---

## Phase 2 — Discharge gate (critical rule)
- Extend `ipd.$id.discharge.tsx`: on load, call `getPatientBillingSummary`. If `pending > 0`, disable Discharge button + show blocking banner with the exact copy required.
- After discharge, ensure admission_date + discharge_date always render on IPD patient page (already stored — just surface).
- Add **"Discharged patients" search** tab in IPD list with From→To filter.

---

## Phase 3 — OPD upgrades
- Consultation fee → read from `hospital_settings` (new column `default_consultation_fee` + per-doctor override already exists).
- Fix bill totals: recompute `subtotal = Σ(qty × rate)`, `total = subtotal − discount + gst`. Add unit-tested helper.
- Add Edit/Delete (super-admin) on every OPD bill row + consultation record.
- WhatsApp prescription PDF share button on consultation screen.
- OPD Reports: PDF + Excel export (xlsx already in tree), From→To filter, old vs new patient split.

---

## Phase 4 — IPD upgrades
- Inline edit of patient demographics from IPD detail.
- From→To filter on admissions list.
- IPD Billing: Discount field, From→To report, **Package Billing** (new table `billing_packages` + `apply package` action that seeds bill items).
- Discharge summary: Edit/Delete/Print/Save/WhatsApp via `RecordActions`.

---

## Phase 5 — Emergency + OT + ICU action-set parity
- Emergency: full `RecordActions`. Verify UHID linkage to OPD/IPD/OT/ICU (already FK-able — surface "Linked records" panel).
- Emergency charges → push to `bills` via aggregator hook on case close.
- OT: Reports route with From→To, doctor, room, status filters. Ensure `syncBillToIPD` already pushes to central aggregator (it does).
- ICU: confirm Add/Transfer flow, add Delete (super-admin), apply `RecordActions`.

---

## Phase 6 — Nurse Station fixes
- Edit dialogs for vitals, MAR entries, nursing notes.
- Fix Critical Alerts vitals formatting: validate BP `systolic/diastolic` both non-null before render; show `—` otherwise. Format as `BP 120/80`.
- Apply `RecordActions` (no UI rewrite — per user's prior "do not modify Nurse Station UI" memo, this is additive only).

---

## Phase 7 — Patients module
- Patient Dashboard tab: demographics + visit timeline (OPD/IPD/ER/ICU/OT) + billing summary + documents.
- CSV/Excel **Import** with template download + row-level validation report.
- Excel + PDF **Export** of patient list with date filter.

---

## Technical notes
- **New tables (Phase 1, 4)**: `billing_packages(name, charges jsonb, total)`, `billing_package_applications(bill_id, package_id)`. Existing `bills` schema is sufficient for the aggregator.
- **No destructive migrations**. All additive columns have defaults.
- **RBAC**: extend `permissions.ts` with `delete` action checked against `super_admin` role for every module.
- **Realtime**: aggregator subscribes to `bills`, `pharmacy_sales`, `lab_orders`, `radiology_orders` channels — billing screen updates live.
- **PDF**: reuse existing print routes (`/billing/$id`, `/prescriptions/$id/print`, `/discharge/$id/print`) + `window.print()`. Excel via existing `lib/export.ts`.

---

Reply **continue** and I'll start with **Phase 0 + Phase 1** (foundations + sidebar + centralized Billing shell) in one go since they're tightly coupled and non-breaking.