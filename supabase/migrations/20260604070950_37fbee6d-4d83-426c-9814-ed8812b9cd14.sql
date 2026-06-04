
-- EMR
CREATE TABLE public.emr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  record_type text NOT NULL,
  event_date timestamptz NOT NULL DEFAULT now(),
  department text,
  doctor_id uuid,
  title text NOT NULL,
  summary text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emr_records TO authenticated;
GRANT ALL ON public.emr_records TO service_role;
ALTER TABLE public.emr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage emr" ON public.emr_records FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "patient view own emr" ON public.emr_records FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.patient_portal_accounts a WHERE a.patient_id = emr_records.patient_id AND a.user_id = auth.uid()));

-- EHR
CREATE TABLE public.ehr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  external_facility text,
  record_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  shared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ehr_records TO authenticated;
GRANT ALL ON public.ehr_records TO service_role;
ALTER TABLE public.ehr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage ehr" ON public.ehr_records FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.patient_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  scope text,
  granted boolean NOT NULL DEFAULT false,
  granted_at timestamptz,
  expires_at timestamptz,
  signature_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_consents TO authenticated;
GRANT ALL ON public.patient_consents TO service_role;
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage consents" ON public.patient_consents FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- HL7
CREATE TABLE public.hl7_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type text NOT NULL,
  hl7_version text DEFAULT '2.5',
  direction text NOT NULL DEFAULT 'inbound',
  source_system text,
  destination_system text,
  raw_message text,
  parsed jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hl7_messages TO authenticated;
GRANT ALL ON public.hl7_messages TO service_role;
ALTER TABLE public.hl7_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage hl7" ON public.hl7_messages FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- FHIR
CREATE TABLE public.fhir_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  version_id int NOT NULL DEFAULT 1,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(resource_type, resource_id, version_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fhir_resources TO authenticated;
GRANT ALL ON public.fhir_resources TO service_role;
ALTER TABLE public.fhir_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage fhir" ON public.fhir_resources FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- NABH
CREATE TABLE public.quality_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_code text NOT NULL,
  name text NOT NULL,
  category text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  numerator numeric,
  denominator numeric,
  value numeric,
  target numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_indicators TO authenticated;
GRANT ALL ON public.quality_indicators TO service_role;
ALTER TABLE public.quality_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage qi" ON public.quality_indicators FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.compliance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL,
  title text NOT NULL,
  version text DEFAULT '1.0',
  department text,
  effective_date date,
  review_date date,
  status text NOT NULL DEFAULT 'active',
  file_url text,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_documents TO authenticated;
GRANT ALL ON public.compliance_documents TO service_role;
ALTER TABLE public.compliance_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage compdoc" ON public.compliance_documents FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- JCI
CREATE TABLE public.jci_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code text NOT NULL,
  standard_name text NOT NULL,
  category text,
  audit_date date NOT NULL DEFAULT CURRENT_DATE,
  auditor text,
  score numeric,
  status text NOT NULL DEFAULT 'open',
  findings text,
  recommendations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jci_audits TO authenticated;
GRANT ALL ON public.jci_audits TO service_role;
ALTER TABLE public.jci_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage jci" ON public.jci_audits FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Infection control
CREATE TABLE public.infection_control (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  infection_type text NOT NULL,
  is_hai boolean DEFAULT false,
  isolation_required boolean DEFAULT false,
  isolation_type text,
  antibiotic text,
  onset_date date,
  resolved_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.infection_control TO authenticated;
GRANT ALL ON public.infection_control TO service_role;
ALTER TABLE public.infection_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage infection" ON public.infection_control FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Quality metrics
CREATE TABLE public.quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL,
  department text,
  period date NOT NULL,
  value numeric NOT NULL,
  target numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_metrics TO authenticated;
GRANT ALL ON public.quality_metrics TO service_role;
ALTER TABLE public.quality_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage qm" ON public.quality_metrics FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Incidents
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_no text UNIQUE,
  incident_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  location text,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  reported_by uuid,
  description text NOT NULL,
  immediate_action text,
  status text NOT NULL DEFAULT 'open',
  root_cause text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage incidents" ON public.incidents FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  action text NOT NULL,
  owner text,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corrective_actions TO authenticated;
GRANT ALL ON public.corrective_actions TO service_role;
ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage ca" ON public.corrective_actions FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Patient safety
CREATE TABLE public.patient_safety_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  message text NOT NULL,
  active boolean DEFAULT true,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_safety_alerts TO authenticated;
GRANT ALL ON public.patient_safety_alerts TO service_role;
ALTER TABLE public.patient_safety_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage safety" ON public.patient_safety_alerts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Clinical audits
CREATE TABLE public.clinical_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_type text NOT NULL,
  scope text,
  audit_date date NOT NULL DEFAULT CURRENT_DATE,
  auditor text,
  sample_size int,
  compliance_pct numeric,
  findings text,
  recommendations text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_audits TO authenticated;
GRANT ALL ON public.clinical_audits TO service_role;
ALTER TABLE public.clinical_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage caudits" ON public.clinical_audits FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Consent forms
CREATE TABLE public.consent_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  form_type text NOT NULL,
  procedure text,
  content text,
  signed boolean DEFAULT false,
  signed_at timestamptz,
  signature_data text,
  witness_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_forms TO authenticated;
GRANT ALL ON public.consent_forms TO service_role;
ALTER TABLE public.consent_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage consent forms" ON public.consent_forms FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- MRD archive
CREATE TABLE public.medical_records_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  record_no text,
  archived_at timestamptz NOT NULL DEFAULT now(),
  location text,
  retention_until date,
  status text NOT NULL DEFAULT 'archived',
  destroyed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_records_archive TO authenticated;
GRANT ALL ON public.medical_records_archive TO service_role;
ALTER TABLE public.medical_records_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage mrd" ON public.medical_records_archive FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Privacy
CREATE TABLE public.privacy_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource text,
  ip_address text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.privacy_logs TO authenticated;
GRANT ALL ON public.privacy_logs TO service_role;
ALTER TABLE public.privacy_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff view privacy" ON public.privacy_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert privacy" ON public.privacy_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Enterprise audit logs
CREATE TABLE public.enterprise_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  entity text,
  entity_id text,
  before jsonb,
  after jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.enterprise_audit_logs TO authenticated;
GRANT ALL ON public.enterprise_audit_logs TO service_role;
ALTER TABLE public.enterprise_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff view eaudit" ON public.enterprise_audit_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert eaudit" ON public.enterprise_audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- CDSS
CREATE TABLE public.clinical_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  trigger_source text,
  message text NOT NULL,
  recommendation text,
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_alerts TO authenticated;
GRANT ALL ON public.clinical_alerts TO service_role;
ALTER TABLE public.clinical_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage cdss" ON public.clinical_alerts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Research
CREATE TABLE public.research_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_code text UNIQUE NOT NULL,
  title text NOT NULL,
  pi_name text,
  department text,
  phase text,
  status text NOT NULL DEFAULT 'planning',
  start_date date,
  end_date date,
  description text,
  ethics_approval text,
  target_enrollment int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_studies TO authenticated;
GRANT ALL ON public.research_studies TO service_role;
ALTER TABLE public.research_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage research" ON public.research_studies FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.study_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.research_studies(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  enrollment_date date NOT NULL DEFAULT CURRENT_DATE,
  arm text,
  status text NOT NULL DEFAULT 'enrolled',
  outcome text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_participants TO authenticated;
GRANT ALL ON public.study_participants TO service_role;
ALTER TABLE public.study_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage spart" ON public.study_participants FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['emr_records','ehr_records','patient_consents','hl7_messages','fhir_resources','quality_indicators','compliance_documents','jci_audits','infection_control','incidents','corrective_actions','patient_safety_alerts','clinical_audits','consent_forms','medical_records_archive','clinical_alerts','research_studies','study_participants'])
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;
