
# Complete Module Updates — Phased Plan

This is a very large scope (15+ modules, ~80 discrete changes). To keep quality high and avoid breaking existing flows, I'll ship it in **7 phases**, each independently reviewable. Skipping **Payroll** and **Reports & Analytics** per instructions ([PANDIT]).

## Global reusable pieces (built once, used by every phase)

- **`DateRangeFilter`** component: `[From] [To] [Apply] [Reset]` — wraps existing `DayMonthYearTabs` pattern, emits `{from, to}` range.
- **`PatientSearchBox`** — thin wrapper around `SearchBox` with debounce=300ms, exposes `filter(rows, keys)` helper (name/UHID/mobile/bill#).
- **`whatsappShare(mobile, text)`** helper in `src/lib/share.ts` (already exists — extend if needed).
- **`attachReportToPatient(patientId, {type, title, url})`** — writes to `patient_documents` via UHID so lab/radiology reports appear across OPD/IPD/ICU/OT/Patient tabs automatically.
- **Priority badge** enum for Lab + Radiology (`normal` / `urgent`).

All lists already use `RecordActions` (Edit/Delete admin-gated/WhatsApp/Print/Download) from earlier phases — I'll extend the modules that don't have full coverage yet.

## Phase 1 — Laboratory (§①)
- Fix empty patient listing (audit the Supabase query in `laboratory.index.tsx` — likely missing/failed JOIN on `patients`).
- Add tabs: All / Pending / In Progress / Completed with count badges.
- Add `priority` column via migration (`lab_orders.priority text default 'normal'`); urgent orders float to top, red badge.
- From/To date filter, respected by Excel export.
- **Test Management** admin panel: reuse `lab_tests` table with Add/Edit/Delete; feeds the "new order" dropdown.
- On lab result verify → auto-insert row into `patient_documents` labelled `Lab Report — <test> — <date>` (visible everywhere via UHID).
- Edit modal for lab orders (test, ordered_by, notes, status).

## Phase 2 — Radiology (§②)
- Admin **Test/Modality Management** (add/edit/remove modalities feeding order form).
- Patient search bar (name/UHID/mobile, 300ms debounce).
- From/To date filter.
- Priority (normal/urgent) column via migration; urgent sorted top, red badge.
- Edit report modal (findings, impression, radiologist, date).
- Auto-attach completed reports to `patient_documents` via UHID.

## Phase 3 — Sidebar cleanup + Assets/Vendors/Blood Bank/Dialysis (§③④⑤⑥)
- Remove any remaining **Shift/Staffing** sidebar entry + delete `smart-staffing.tsx` route.
- Assets & Vendors: add search + from/to date filter.
- Blood Bank: add Edit modal on every row.
- Dialysis: Edit modal + delete + WhatsApp share; add `follow_up_at` (timestamp) + `follow_up_notes` (text) via migration; from/to date filter.

## Phase 4 — Birth & Death Registers (§⑦)
- Both modules: `RecordActions` set = Edit / Delete (admin) / Print (certificate w/ hospital header) / Report / WhatsApp.
- From/To date filter on both.

## Phase 5 — Billing + Insurance (§⑧⑩)
- **Billing** (`billing.index.tsx`): patient search (name/UHID/bill#/mobile), from/to filter, edit modal (amounts/discount/status/mode/notes), WhatsApp bill link.
- Verify cross-department bills already land in central billing (source: `billing-aggregator.ts`); patch any missing source.
- Revenue reports already in `billing.reports.tsx` — add Excel/PDF export.
- Insurance line-item deduction in bill totals (Total − Insurance − Discount).
- **Insurance**: page-level Export/Report/Print/WhatsApp, per-row full action set, patient search, from/to filter, Pending vs Completed tabs w/ count badges, **Insurance Company Management** (admin CRUD → dropdown source).

## Phase 6 — Pharmacy + Finance (§⑨⑪)
- **Pharmacy**: per-row Edit/Delete/WhatsApp; patient search auto-linking dispensed medicine to patient via UHID (visible in OPD/IPD/ICU medication tab).
- Recent sales from/to filter.
- **Stock management**: Add/Edit/Delete medicine (admin/pharmacist), low-stock alert threshold.
- **Finance & Accounting**: page-level Export/Report/WhatsApp, per-row Edit/Delete/Export/WhatsApp, search, from/to filter.

## Phase 7 — BI + HR (§⑬⑭⑮⑯⑱)
- **BI dashboard**: fix IPD amount card overflow (`truncate` + smaller fluid font, `overflow-hidden`), add WhatsApp Share of today's KPI snapshot.
- **HR Employees**: Documents tab on employee profile (upload PDF/JPG/PNG/DOCX ≤ 10MB → `employee_documents` bucket).
- **HR Attendance**: full actions, employee search, from/to filter, ensure all records saved & visible, Excel/PDF export.
- **HR Leave**: full actions, employee search, from/to filter, dashboard cards (Today / Next 7d / Next 30d / Pending Approvals with names).
- **HR Performance**: WhatsApp share + Excel/PDF export.

## Technical Notes

- Migrations needed: `lab_orders.priority`, `radiology_orders.priority`, `dialysis_sessions.follow_up_at + follow_up_notes`, optionally `insurance_companies` (exists), `patient_documents` category taxonomy (already exists).
- All lists already use React Query — invalidation via existing `queryClient.invalidateQueries` after mutations.
- No sidebar/theme/routing/auth changes beyond removing Shift/Staffing.
- Null coalesce helper: `const dash = (v) => v ?? "—"` — apply in existing renderers where missing.

## Delivery cadence

I'll ship **Phase 1 first**, verify build + a quick smoke of the Lab list, then continue phase-by-phase in subsequent messages so you can review incrementally and I can react to any regressions before piling on the next module.

Reply **"go"** to start Phase 1 (Laboratory), or tell me if you want a different phase order (e.g. start with Billing).
