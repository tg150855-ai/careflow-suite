
-- Add patient role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'patient';

-- Helper: staff role check
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','super_admin','doctor','nurse','receptionist',
                   'pharmacist','lab_tech','accountant','surgeon',
                   'insurance_officer','ot_coordinator','hr_manager',
                   'finance_manager','dept_head','procurement_officer')
  )
$$;

-- =========== Patient portal accounts ===========
CREATE TABLE public.patient_portal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  patient_id UUID NOT NULL,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_portal_accounts TO authenticated;
GRANT ALL ON public.patient_portal_accounts TO service_role;
ALTER TABLE public.patient_portal_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own portal" ON public.patient_portal_accounts FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- =========== Family members ===========
CREATE TABLE public.patient_family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_user_id UUID NOT NULL,
  member_patient_id UUID NOT NULL,
  relationship TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_book BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_family_members TO authenticated;
GRANT ALL ON public.patient_family_members TO service_role;
ALTER TABLE public.patient_family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own family" ON public.patient_family_members FOR ALL TO authenticated
  USING (primary_user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (primary_user_id = auth.uid() OR public.is_staff(auth.uid()));

-- =========== Telemedicine ===========
CREATE TABLE public.telemedicine_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID,
  patient_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  room_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telemedicine_sessions TO authenticated;
GRANT ALL ON public.telemedicine_sessions TO service_role;
ALTER TABLE public.telemedicine_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tele staff or own" ON public.telemedicine_sessions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR doctor_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.patient_portal_accounts p WHERE p.user_id = auth.uid() AND p.patient_id = patient_id
  ))
  WITH CHECK (public.is_staff(auth.uid()) OR doctor_id = auth.uid());

CREATE TABLE public.telemedicine_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.telemedicine_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  body TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telemedicine_messages TO authenticated;
GRANT ALL ON public.telemedicine_messages TO service_role;
ALTER TABLE public.telemedicine_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tele msg participants" ON public.telemedicine_messages FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR sender_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.telemedicine_sessions s
    WHERE s.id = session_id AND (s.doctor_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.patient_portal_accounts p WHERE p.user_id = auth.uid() AND p.patient_id = s.patient_id
    ))
  ))
  WITH CHECK (sender_id = auth.uid() OR public.is_staff(auth.uid()));

-- =========== AI insights ===========
CREATE TABLE public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO authenticated;
GRANT ALL ON public.ai_insights TO service_role;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai staff only" ON public.ai_insights FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========== WhatsApp campaigns ===========
CREATE TABLE public.whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  audience JSONB DEFAULT '{}'::jsonb,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  read_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_campaigns TO authenticated;
GRANT ALL ON public.whatsapp_campaigns TO service_role;
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa staff" ON public.whatsapp_campaigns FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========== CRM campaigns ===========
CREATE TABLE public.crm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  message TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  audience_filter JSONB DEFAULT '{}'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_campaigns TO authenticated;
GRANT ALL ON public.crm_campaigns TO service_role;
ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm staff" ON public.crm_campaigns FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========== Online payments ===========
CREATE TABLE public.online_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  bill_id UUID,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL,
  gateway TEXT,
  gateway_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  purpose TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_payments TO authenticated;
GRANT ALL ON public.online_payments TO service_role;
ALTER TABLE public.online_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments staff or own" ON public.online_payments FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.patient_portal_accounts p WHERE p.user_id = auth.uid() AND p.patient_id = online_payments.patient_id
  ))
  WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.patient_portal_accounts p WHERE p.user_id = auth.uid() AND p.patient_id = online_payments.patient_id
  ));

-- =========== Digital health records (unified timeline) ===========
CREATE TABLE public.health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  record_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_table TEXT,
  source_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_records TO authenticated;
GRANT ALL ON public.health_records TO service_role;
ALTER TABLE public.health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "records staff or own" ON public.health_records FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.patient_portal_accounts p WHERE p.user_id = auth.uid() AND p.patient_id = health_records.patient_id
  ))
  WITH CHECK (public.is_staff(auth.uid()));

-- =========== Vaccinations ===========
CREATE TABLE public.vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  vaccine_name TEXT NOT NULL,
  dose_number INT DEFAULT 1,
  due_date DATE,
  given_date DATE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  administered_by UUID,
  batch_no TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccinations TO authenticated;
GRANT ALL ON public.vaccinations TO service_role;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vax staff or own" ON public.vaccinations FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.patient_portal_accounts p WHERE p.user_id = auth.uid() AND p.patient_id = vaccinations.patient_id
  ))
  WITH CHECK (public.is_staff(auth.uid()));

-- =========== Health packages ===========
CREATE TABLE public.health_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price NUMERIC(12,2) NOT NULL,
  duration_days INT DEFAULT 1,
  includes JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.health_packages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.health_packages TO authenticated;
GRANT ALL ON public.health_packages TO service_role;
ALTER TABLE public.health_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pkg public read" ON public.health_packages FOR SELECT USING (active = true OR public.is_staff(auth.uid()));
CREATE POLICY "pkg staff write" ON public.health_packages FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "pkg staff update" ON public.health_packages FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "pkg staff delete" ON public.health_packages FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.health_package_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.health_packages(id),
  patient_id UUID NOT NULL,
  booked_for DATE,
  status TEXT NOT NULL DEFAULT 'booked',
  amount NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_package_bookings TO authenticated;
GRANT ALL ON public.health_package_bookings TO service_role;
ALTER TABLE public.health_package_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pkg book staff or own" ON public.health_package_bookings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.patient_portal_accounts p WHERE p.user_id = auth.uid() AND p.patient_id = health_package_bookings.patient_id
  ))
  WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.patient_portal_accounts p WHERE p.user_id = auth.uid() AND p.patient_id = health_package_bookings.patient_id
  ));

-- =========== Queue management ===========
CREATE SEQUENCE IF NOT EXISTS public.queue_token_seq;
CREATE TABLE public.queue_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_no INT NOT NULL DEFAULT nextval('public.queue_token_seq'),
  counter TEXT NOT NULL,
  patient_id UUID,
  status TEXT NOT NULL DEFAULT 'waiting',
  estimated_minutes INT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_tokens TO authenticated;
GRANT ALL ON public.queue_tokens TO service_role;
ALTER TABLE public.queue_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue staff or own" ON public.queue_tokens FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.patient_portal_accounts p WHERE p.user_id = auth.uid() AND p.patient_id = queue_tokens.patient_id
  ))
  WITH CHECK (public.is_staff(auth.uid()));

-- =========== Communication logs ===========
CREATE TABLE public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  patient_id UUID,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  template TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_logs TO authenticated;
GRANT ALL ON public.communication_logs TO service_role;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comm staff" ON public.communication_logs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Indices
CREATE INDEX idx_health_records_patient ON public.health_records(patient_id, record_date DESC);
CREATE INDEX idx_tele_sessions_patient ON public.telemedicine_sessions(patient_id);
CREATE INDEX idx_tele_sessions_doctor ON public.telemedicine_sessions(doctor_id);
CREATE INDEX idx_vax_patient ON public.vaccinations(patient_id);
CREATE INDEX idx_queue_status ON public.queue_tokens(status, issued_at);
CREATE INDEX idx_online_pay_patient ON public.online_payments(patient_id);
