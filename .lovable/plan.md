## Scope

This is a large, multi-module incremental enhancement. Nothing existing will be removed, renamed, or restyled. All work is additive and reuses the current design tokens, card style, and navigation. PACS is **hidden, not deleted**. Payroll is **untouched**.

Because the request touches ~10 modules and dozens of routes, I will ship it in **6 sequential phases**, each independently verifiable. After every phase I will confirm existing routes still load before starting the next.

---

## Phase 0 — Shared primitives (foundation, ~1 turn)

Build once, reuse everywhere — this is what keeps the rollout non-destructive and visually consistent.

1. `src/components/common/action-bar.tsx` — `<ModuleActionBar />` rendering only the buttons passed in as props (Add, Edit, Delete, Save, Download PDF, Print, Export CSV/XLSX, Settings, WhatsApp Share). Each button is opt-in so existing pages don't get duplicate buttons.
2. `src/components/common/date-range-tabs.tsx` — `<DayMonthYearTabs />` with Day / Month / Year / Custom, returning `{from, to}`.
3. `src/components/common/search-box.tsx` — debounced search input (reuses existing Input styling).
4. `src/lib/share.ts` — `shareOnWhatsApp(text, url?)` → opens `https://wa.me/?text=...`.
5. `src/lib/export.ts` — `exportCsv(rows, filename)`, `exportXlsx(...)` (xlsx already in deps), `printNode(ref)`, `downloadPdf(node, filename)` using existing print routes / `window.print()` pattern.

No DB changes. No route changes. No visual changes to existing pages.

## Phase 1 — Laboratory

- Mount `<ModuleActionBar/>` on `laboratory.index.tsx` and `laboratory.tests.tsx`.
- Add filter tabs `All | Pending | Complete` on lab orders (mirror radiology pattern already in repo).
- Add `test_stage` column to `lab_orders` (enum: `patient | opd | ipd | icu`, default `patient`); auto-set on insert based on source (admission_id → ipd/icu, appointment_id → opd, else patient). GRANTs + RLS preserved.
- Add `notes` column to `lab_orders` if missing; surface in entry form.
- Lab Assistant role: add `lab_orders.upload` and `lab_results.create` to `role_permissions`. Patient detail page already renders lab results — add stage badge + "Send on WhatsApp" per row.
- Add Scheduling sub-tab (new lightweight table `lab_schedules` with Add + WhatsApp share).
- Add Add/Remove test toggle inside an order (soft-remove via existing `status`).
- "Patients with lab orders" view: filtered list on `laboratory.index.tsx`.

## Phase 2 — Radiology + PACS hide

- Mount action bar on `radiology.tsx`.
- Add `test_stage` to `radiology_orders` (same enum) with auto-attach; quick-attach chips on patient page.
- Add `priority` field (`normal | urgent`) — column already nullable, add UI dropdown.
- Add "Template Edit" dialog (stores JSON in `radiology_reports.template`).
- Add patient search, Day/Month/Year filters, and `All | Referring | Complete` tabs.
- Attachments section reused from shared component for OPD/IPD/ICU patient tabs.
- **PACS hide**: comment out PACS, Queue Display, and Queue routes in `src/components/app-shell.tsx` sidebar with `// disabled per request — module preserved for potential future re-enable.` Routes and tables remain.

## Phase 3 — Blood Bank, Dialysis, Beds, Death Register

- Action bar + patient search on Blood Bank.
- Dialysis: action bar, patient search, Day/Month/Year filters, "Follow-up Due" panel (derive from `dialysis_sessions.next_session_at`).
- `ipd.beds.tsx`: action bar.
- `ipd.death-register.tsx`: action bar, patient search, Day/Month/Year filters.

## Phase 4 — Finance (Billing, Insurance, Accounting)

- **Billing** (`billing.index.tsx`, `billing.$id.tsx`, `billing.new.tsx`):
  - Action bar + bill/patient search.
  - Add `discount_amount`, `advance_amount` columns to `bills` (default 0); surface in form and totals math.
  - Day/Month/Year filter tabs on Recent Bills.
  - Resize: Monthly Revenue card → `lg:col-span-1`; Recent Bills → `lg:col-span-3` (Tailwind grid only, no data change).
  - Auto-populate is already wired from OPD/IPD/ICU/OT; verify and add the same hook for any module missing it (lab/radiology line items only when result is final).
  - New `payments` rows already cover Repayments; add a "Repayments" tab on `billing.$id.tsx`. "Payout Deposits" → small section on accounting page.
- **Insurance**: action bar, search, Add/Remove insurer CRUD on `insurance_companies`, Day/Month/Year on claims, "Insurance" line on final bill summary (read from `insurance_claims` linked to bill).
- **Finance & Accounting**: action bar, search, Day/Month/Year on transactions, Revenue Reports shell card (marked "Coming soon"), Executive BI summary card with WhatsApp share.

## Phase 5 — Pharmacy + HR + Cross-cutting

- **Pharmacy**: action bar, patient/bill search, Day/Month/Year on Recent Sales. "Stock" already exists in `pharmacy.medicines.tsx` — confirm Add flow is full (name/price/qty/expiry). Doctor Consultation medicines combobox: extend existing medicine search to also show live `stock_qty` from `medicine_batches`.
- **HR Employees**: action bar; add Documents tab using existing `employee_documents`; switch New Employee form to single column (Tailwind only).
- **HR Attendance / Leave**: action bar, employee search, Day/Month/Year filters. Leave dashboard widget: Today / This week / Next month counts.
- **HR Performance**: add Download Report + WhatsApp Share buttons only.
- **HR removals**: hide "Shipping" link from nav (comment, do not delete).
- **Inventory "Ideal New" group**: add sidebar group containing existing Assets, Vendors, Procurement, Biomedical routes (no new routes, just grouping). Action bar + search on each.
- **Cross-cutting**: shared Attachments component already used in Phase 2; mount on OPD/IPD/ICU patient tabs that lack it. Day/Month/Year filter on "Recent Orders" lists. Patient search in Food Reimbursement (if route exists; otherwise skip and note).

## Technical notes (for review)

- DB migrations are minimal and additive only: 3 columns (`lab_orders.test_stage`, `lab_orders.notes` if missing, `radiology_orders` already has needed fields, `bills.discount_amount`, `bills.advance_amount`), 1 new table (`lab_schedules`), 1 enum (`test_stage`). All include `GRANT` + RLS per project rules.
- No edits to `routeTree.gen.ts`, `client.ts`, `types.ts`, `.env`, `config.toml`, or Nurse Station files.
- Sidebar hides (PACS, Queue Display, Queue, HR Shipping) are commented links — routes remain reachable by URL.
- After each phase: run `tsgo`, click through the touched routes in preview, confirm console is clean.

## Out of scope (explicitly deferred per your prompt)

- Payroll changes
- Admin / Digital / Patient / Compliance / Smart OS placeholders (left as code comment backlog only)

---

**Estimated turns:** Phase 0 = 1, Phases 1–5 = 2–3 each → ~12–15 turns total.

Approve and I'll start with Phase 0 + Phase 1 in the next turn.