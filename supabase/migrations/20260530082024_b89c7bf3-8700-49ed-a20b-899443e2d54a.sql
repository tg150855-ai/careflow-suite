
-- Enums
DO $$ BEGIN CREATE TYPE public.surgery_priority AS ENUM ('emergency','urgent','elective'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.surgery_status AS ENUM ('scheduled','in_progress','completed','cancelled','postponed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.claim_status AS ENUM ('draft','submitted','under_review','approved','rejected','settled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.triage_level AS ENUM ('red','orange','yellow','green'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.emergency_status AS ENUM ('waiting','in_treatment','admitted','discharged','referred','deceased'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ambulance_status AS ENUM ('available','on_duty','maintenance','out_of_service'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.dispatch_status AS ENUM ('requested','dispatched','en_route','arrived','returning','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.comm_status AS ENUM ('queued','sent','delivered','read','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_priority AS ENUM ('low','normal','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SEQUENCE IF NOT EXISTS public.surgery_no_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.claim_no_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.emergency_no_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.dispatch_no_seq START 1;

CREATE OR REPLACE FUNCTION public.gen_surgery_no() RETURNS text LANGUAGE sql SET search_path=public AS $$
  SELECT 'OT-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.surgery_no_seq')::text,6,'0')
$$;
CREATE OR REPLACE FUNCTION public.gen_claim_no() RETURNS text LANGUAGE sql SET search_path=public AS $$
  SELECT 'CLM-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.claim_no_seq')::text,6,'0')
$$;
CREATE OR REPLACE FUNCTION public.gen_emergency_no() RETURNS text LANGUAGE sql SET search_path=public AS $$
  SELECT 'ER-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.emergency_no_seq')::text,6,'0')
$$;
CREATE OR REPLACE FUNCTION public.gen_dispatch_no() RETURNS text LANGUAGE sql SET search_path=public AS $$
  SELECT 'AMB-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.dispatch_no_seq')::text,6,'0')
$$;

CREATE TABLE public.ot_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ot_rooms TO authenticated;
GRANT ALL ON public.ot_rooms TO service_role;
ALTER TABLE public.ot_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read ot_rooms" ON public.ot_rooms FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "admin write ot_rooms" ON public.ot_rooms FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.surgeries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_no text NOT NULL UNIQUE DEFAULT gen_surgery_no(),
  patient_id uuid NOT NULL,
  admission_id uuid,
  ot_room_id uuid,
  primary_surgeon_id uuid,
  anesthetist_id uuid,
  procedure_name text NOT NULL,
  procedure_code text,
  priority surgery_priority NOT NULL DEFAULT 'elective',
  status surgery_status NOT NULL DEFAULT 'scheduled',
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  estimated_cost numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_surgeries_scheduled ON public.surgeries(scheduled_start);
CREATE INDEX idx_surgeries_patient ON public.surgeries(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgeries TO authenticated;
GRANT ALL ON public.surgeries TO service_role;
ALTER TABLE public.surgeries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read surgeries" ON public.surgeries FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "ot write surgeries" ON public.surgeries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'ot_coordinator'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'ot_coordinator'));
CREATE TRIGGER trg_surgeries_updated BEFORE UPDATE ON public.surgeries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.surgery_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id uuid NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  role text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgery_team TO authenticated;
GRANT ALL ON public.surgery_team TO service_role;
ALTER TABLE public.surgery_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read team" ON public.surgery_team FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "ot write team" ON public.surgery_team FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'ot_coordinator'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'ot_coordinator'));

CREATE TABLE public.surgery_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id uuid NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
  consent_signed boolean NOT NULL DEFAULT false,
  insurance_approved boolean NOT NULL DEFAULT false,
  blood_available boolean NOT NULL DEFAULT false,
  lab_completed boolean NOT NULL DEFAULT false,
  anesthesia_clearance boolean NOT NULL DEFAULT false,
  fitness_clearance boolean NOT NULL DEFAULT false,
  notes text,
  verified_by uuid,
  verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_surgery_checklist ON public.surgery_checklists(surgery_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgery_checklists TO authenticated;
GRANT ALL ON public.surgery_checklists TO service_role;
ALTER TABLE public.surgery_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read checklist" ON public.surgery_checklists FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "ot write checklist" ON public.surgery_checklists FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse') OR has_role(auth.uid(),'ot_coordinator'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse') OR has_role(auth.uid(),'ot_coordinator'));
CREATE TRIGGER trg_checklist_updated BEFORE UPDATE ON public.surgery_checklists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.surgery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id uuid NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
  procedure_performed text,
  findings text,
  complications text,
  blood_loss_ml numeric,
  implants_used text,
  remarks text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surgery_notes TO authenticated;
GRANT ALL ON public.surgery_notes TO service_role;
ALTER TABLE public.surgery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read snotes" ON public.surgery_notes FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "surgeon write snotes" ON public.surgery_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'doctor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'doctor'));

CREATE TABLE public.recovery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surgery_id uuid NOT NULL REFERENCES public.surgeries(id) ON DELETE CASCADE,
  recovery_status text,
  vitals jsonb DEFAULT '{}'::jsonb,
  icu_transfer boolean NOT NULL DEFAULT false,
  notes text,
  discharge_recommendation text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_notes TO authenticated;
GRANT ALL ON public.recovery_notes TO service_role;
ALTER TABLE public.recovery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read rec" ON public.recovery_notes FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write rec" ON public.recovery_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'surgeon') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

CREATE TABLE public.insurance_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  policy_type text,
  contact_person text,
  phone text,
  email text,
  tpa text,
  coverage_rules text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_companies TO authenticated;
GRANT ALL ON public.insurance_companies TO service_role;
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read ins_co" ON public.insurance_companies FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "ins write ins_co" ON public.insurance_companies FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer'));

CREATE TABLE public.patient_insurance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  company_id uuid REFERENCES public.insurance_companies(id),
  policy_number text NOT NULL,
  coverage_limit numeric NOT NULL DEFAULT 0,
  valid_from date,
  valid_to date,
  authorization_number text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pat_ins_patient ON public.patient_insurance(patient_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_insurance TO authenticated;
GRANT ALL ON public.patient_insurance TO service_role;
ALTER TABLE public.patient_insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read pat_ins" ON public.patient_insurance FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "ins write pat_ins" ON public.patient_insurance FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer') OR has_role(auth.uid(),'receptionist'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer') OR has_role(auth.uid(),'receptionist'));

CREATE TABLE public.insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_no text NOT NULL UNIQUE DEFAULT gen_claim_no(),
  patient_id uuid NOT NULL,
  patient_insurance_id uuid REFERENCES public.patient_insurance(id),
  bill_id uuid,
  admission_id uuid,
  claim_amount numeric NOT NULL DEFAULT 0,
  approved_amount numeric NOT NULL DEFAULT 0,
  status claim_status NOT NULL DEFAULT 'draft',
  pre_auth_no text,
  submitted_at timestamptz,
  settled_at timestamptz,
  rejection_reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_claims TO authenticated;
GRANT ALL ON public.insurance_claims TO service_role;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read claims" ON public.insurance_claims FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "ins write claims" ON public.insurance_claims FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer') OR has_role(auth.uid(),'accountant'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer') OR has_role(auth.uid(),'accountant'));
CREATE TRIGGER trg_claims_updated BEFORE UPDATE ON public.insurance_claims FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.insurance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_url text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_documents TO authenticated;
GRANT ALL ON public.insurance_documents TO service_role;
ALTER TABLE public.insurance_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read ins_docs" ON public.insurance_documents FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "ins write ins_docs" ON public.insurance_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer'));

CREATE TABLE public.scheme_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  scheme_name text NOT NULL,
  scheme_id text NOT NULL,
  family_id text,
  eligibility_status text NOT NULL DEFAULT 'pending',
  coverage_balance numeric NOT NULL DEFAULT 0,
  verified_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheme_beneficiaries TO authenticated;
GRANT ALL ON public.scheme_beneficiaries TO service_role;
ALTER TABLE public.scheme_beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read benef" ON public.scheme_beneficiaries FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "ins write benef" ON public.scheme_beneficiaries FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer') OR has_role(auth.uid(),'receptionist'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer') OR has_role(auth.uid(),'receptionist'));

CREATE TABLE public.scheme_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_name text NOT NULL,
  package_code text NOT NULL,
  package_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheme_packages TO authenticated;
GRANT ALL ON public.scheme_packages TO service_role;
ALTER TABLE public.scheme_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read pkg" ON public.scheme_packages FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "admin write pkg" ON public.scheme_packages FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.scheme_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id uuid NOT NULL REFERENCES public.scheme_beneficiaries(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.scheme_packages(id),
  patient_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status claim_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheme_claims TO authenticated;
GRANT ALL ON public.scheme_claims TO service_role;
ALTER TABLE public.scheme_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sclaims" ON public.scheme_claims FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "ins write sclaims" ON public.scheme_claims FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'insurance_officer'));

CREATE TABLE public.emergency_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_no text NOT NULL UNIQUE DEFAULT gen_emergency_no(),
  patient_id uuid,
  full_name text NOT NULL,
  mobile text,
  gender text,
  approx_age integer,
  emergency_type text,
  chief_complaint text,
  arrival_time timestamptz NOT NULL DEFAULT now(),
  treatment_start timestamptz,
  treatment_end timestamptz,
  triage triage_level,
  status emergency_status NOT NULL DEFAULT 'waiting',
  attending_doctor_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_er_status ON public.emergency_cases(status);
CREATE INDEX idx_er_arrival ON public.emergency_cases(arrival_time);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emergency_cases TO authenticated;
GRANT ALL ON public.emergency_cases TO service_role;
ALTER TABLE public.emergency_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read er" ON public.emergency_cases FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write er" ON public.emergency_cases FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse') OR has_role(auth.uid(),'receptionist'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse') OR has_role(auth.uid(),'receptionist'));
CREATE TRIGGER trg_er_updated BEFORE UPDATE ON public.emergency_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.triage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emergency_case_id uuid NOT NULL REFERENCES public.emergency_cases(id) ON DELETE CASCADE,
  level triage_level NOT NULL,
  vitals jsonb DEFAULT '{}'::jsonb,
  assessment text,
  assessed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.triage_records TO authenticated;
GRANT ALL ON public.triage_records TO service_role;
ALTER TABLE public.triage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read triage" ON public.triage_records FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write triage" ON public.triage_records FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'doctor') OR has_role(auth.uid(),'nurse'));

CREATE TABLE public.ambulances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text NOT NULL UNIQUE,
  vehicle_type text,
  driver_name text,
  driver_phone text,
  equipment text,
  status ambulance_status NOT NULL DEFAULT 'available',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambulances TO authenticated;
GRANT ALL ON public.ambulances TO service_role;
ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read amb" ON public.ambulances FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "admin write amb" ON public.ambulances FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist'));
CREATE TRIGGER trg_amb_updated BEFORE UPDATE ON public.ambulances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ambulance_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_no text NOT NULL UNIQUE DEFAULT gen_dispatch_no(),
  ambulance_id uuid REFERENCES public.ambulances(id),
  patient_id uuid,
  caller_name text,
  caller_phone text,
  pickup_location text NOT NULL,
  pickup_lat numeric,
  pickup_lng numeric,
  destination text,
  destination_lat numeric,
  destination_lng numeric,
  dispatched_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  eta_minutes integer,
  status dispatch_status NOT NULL DEFAULT 'requested',
  fare numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambulance_dispatches TO authenticated;
GRANT ALL ON public.ambulance_dispatches TO service_role;
ALTER TABLE public.ambulance_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read disp" ON public.ambulance_dispatches FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write disp" ON public.ambulance_dispatches FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'ambulance_driver'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'receptionist') OR has_role(auth.uid(),'ambulance_driver'));
CREATE TRIGGER trg_disp_updated BEFORE UPDATE ON public.ambulance_dispatches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid,
  recipient text NOT NULL,
  message_type text NOT NULL,
  body text NOT NULL,
  status comm_status NOT NULL DEFAULT 'queued',
  reference_id uuid,
  reference_type text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_logs TO authenticated;
GRANT ALL ON public.whatsapp_logs TO service_role;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read wa" ON public.whatsapp_logs FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write wa" ON public.whatsapp_logs FOR ALL TO authenticated USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));

CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid,
  recipient text NOT NULL,
  message_type text NOT NULL,
  body text NOT NULL,
  status comm_status NOT NULL DEFAULT 'queued',
  reference_id uuid,
  reference_type text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_logs TO authenticated;
GRANT ALL ON public.sms_logs TO service_role;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read sms" ON public.sms_logs FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write sms" ON public.sms_logs FOR ALL TO authenticated USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid,
  recipient text NOT NULL,
  subject text NOT NULL,
  message_type text NOT NULL,
  body text,
  status comm_status NOT NULL DEFAULT 'queued',
  reference_id uuid,
  reference_type text,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read em" ON public.email_logs FOR SELECT TO authenticated USING (has_any_role(auth.uid()));
CREATE POLICY "staff write em" ON public.email_logs FOR ALL TO authenticated USING (has_any_role(auth.uid())) WITH CHECK (has_any_role(auth.uid()));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  target_role app_role,
  title text NOT NULL,
  body text,
  category text NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'normal',
  link text,
  reference_id uuid,
  reference_type text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, read_at);
CREATE INDEX idx_notif_role ON public.notifications(target_role, read_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user read own notif" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (target_role IS NOT NULL AND has_role(auth.uid(), target_role)) OR has_role(auth.uid(),'admin'));
CREATE POLICY "staff write notif" ON public.notifications FOR INSERT TO authenticated WITH CHECK (has_any_role(auth.uid()));
CREATE POLICY "user update own notif" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete notif" ON public.notifications FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- Seed OT rooms and a few insurance companies and ambulance
INSERT INTO public.ot_rooms (name, location) VALUES
  ('OT-1','Ground Floor'),
  ('OT-2','Ground Floor'),
  ('OT-3','First Floor'),
  ('Minor OT','OPD Block')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.insurance_companies (name, policy_type, tpa) VALUES
  ('Star Health','Cashless','MediAssist'),
  ('HDFC Ergo','Cashless / Reimbursement','Paramount'),
  ('ICICI Lombard','Cashless','MDIndia'),
  ('New India Assurance','Reimbursement','Health India')
ON CONFLICT DO NOTHING;

INSERT INTO public.scheme_packages (scheme_name, package_code, package_name, amount) VALUES
  ('Ayushman Bharat','AB-MS-001','General Medical Management',5000),
  ('Ayushman Bharat','AB-SG-014','Appendectomy',25000),
  ('Ayushman Bharat','AB-SG-031','Cataract Surgery (Phaco)',7500),
  ('CGHS','CGHS-CON-01','General Consultation',300),
  ('CGHS','CGHS-SG-12','Hernia Repair',18000)
ON CONFLICT DO NOTHING;

INSERT INTO public.ambulances (vehicle_number, vehicle_type, driver_name, driver_phone, equipment) VALUES
  ('MH-12-AB-1001','Basic Life Support','Ramesh Kumar','9876500001','Oxygen, Stretcher, First Aid'),
  ('MH-12-AB-1002','Advanced Life Support','Suresh Patil','9876500002','Ventilator, Defibrillator, ECG, Oxygen'),
  ('MH-12-AB-1003','Patient Transport','Anil Sharma','9876500003','Stretcher, Oxygen')
ON CONFLICT (vehicle_number) DO NOTHING;
