
# HMIS — Phase 1 Build Plan

Full-stack from day one using **Lovable Cloud** (Postgres + Auth + server functions). No mock data. Design direction: **Clinical Calm** (white + emerald + soft blue, Apple Settings spaciousness).

## 1. Backend (Lovable Cloud)

Enable Cloud, then create schema:

**Tables**
- `profiles` — id (FK auth.users), full_name, phone, avatar_url, created_at
- `user_roles` — id, user_id, role (enum) — separate table per security rules
- `patients` — uhid (auto), full_name, mobile, email, gender, dob, blood_group, address fields, aadhaar, emergency contact, allergies, chronic diseases, photo_url, created_by, timestamps
- `doctors` — id, user_id (nullable), name, specialization, department, consultation_fee, active
- `departments` — id, name, code
- `appointments` — id, patient_id, doctor_id, scheduled_at, token_no, status (booked/checked_in/waiting/completed/cancelled), notes
- `opd_visits` — id, patient_id, doctor_id, appointment_id, chief_complaints, symptoms, diagnosis, clinical_findings, vitals (jsonb: bp, pulse, temp, spo2, weight, height), notes, follow_up_date, created_at
- `prescriptions` — id, opd_visit_id, created_at
- `prescription_items` — id, prescription_id, medicine_name, dosage, timing, food_instruction, duration_days, notes
- `audit_logs` — id, user_id, action, entity, entity_id, payload, created_at

**Enums**
- `app_role`: admin, doctor, receptionist, nurse, pharmacist, lab_technician, accountant
- `appointment_status`: booked, checked_in, waiting, completed, cancelled

**RLS** — enabled on every table. `has_role(uuid, app_role)` security-definer function. Policies:
- patients/appointments/opd_visits/prescriptions: any authenticated staff role can read; only admin/receptionist/doctor can write (per entity)
- user_roles: only admin can mutate; users can read their own
- profiles: users read/update own; admin reads all

**Triggers**
- Auto-create `profiles` row on signup
- UHID generator: `HMS-YYYYMM-XXXXXX` sequential per month

## 2. Auth + RBAC

- `/login` — split-screen, email/password (Cloud default). Role badge shown post-login from `user_roles`.
- `_authenticated` layout route — `beforeLoad` redirects to `/login`
- `useAuth()` hook — current user + roles + `hasRole()` helper
- Sidebar items filtered by role
- Seed first admin via signup flow (first user becomes admin)

## 3. App Shell

- Collapsible left sidebar (Dashboard, OPD, Patients, Appointments, + future module placeholders disabled)
- Top navbar: hospital name, live date/time, global search (patients by name/UHID/mobile), notifications stub, profile menu
- Clinical Calm theme tokens in `src/styles.css` (oklch): off-white bg, deep blue primary, emerald accent, soft slate text. Generous radii, soft shadows.

## 4. Core Modules (real CRUD)

**Dashboard** — server fn aggregates: today's OPD count, today's appointments, total patients, pending appointments. Recent activity feed. Simple revenue chart placeholder (no billing yet — empty state).

**Patient Registration** — `/patients`
- List view: searchable, paginated table
- `/patients/new` — single-page form (react-hook-form + zod), auto UHID, instant duplicate detection by mobile
- `/patients/$uhid` — profile with timeline of visits

**Appointments** — `/appointments`
- Daily view with doctor columns, time slots
- Quick-book dialog (patient search + doctor + time)
- Status transitions (check in → waiting → completed)

**OPD Consultation** — `/opd/$appointmentId`
- 3-pane layout: timeline (left) / consultation form (center) / prescription builder (right)
- Save creates `opd_visits` + `prescriptions` + items in one server fn
- Print-friendly prescription view at `/prescriptions/$id/print`

## 5. Out of Phase 1 (sidebar shows but routes are "Coming soon" stubs)

IPD, Pharmacy, Lab, OT, Nurse Station, Billing, Insurance, Reports, Staff, Backup, Settings → phase 2-4 per your roadmap.

## 6. Technical notes

- TanStack Start + TanStack Query (template default)
- Server functions for all DB access via `requireSupabaseAuth` middleware
- `client.server` admin client only for admin-role-management ops
- All forms: react-hook-form + zod schemas shared client/server
- Framer Motion for page/list transitions
- No browser dictation/webcam in Phase 1 (can add later — kept scope tight)

## Deliverables this turn

Schema migration, RLS policies, role infra, login page, app shell with role-gated sidebar, Dashboard, Patients (list + new + profile), Appointments (day view + booking), OPD consultation page + print view. Real Postgres, real auth.

Approve to proceed.
