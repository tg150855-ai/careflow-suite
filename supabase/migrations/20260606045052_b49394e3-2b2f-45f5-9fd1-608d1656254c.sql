
-- Phase 10: Smart Hospital OS
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  context jsonb DEFAULT '{}'::jsonb,
  messages jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON public.ai_conversations FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  target_type text,
  target_id uuid,
  title text NOT NULL,
  recommendation text NOT NULL,
  confidence numeric,
  status text DEFAULT 'open',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff ai recs" ON public.ai_recommendations FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.iot_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text NOT NULL,
  device_type text NOT NULL,
  serial_no text,
  location text,
  status text DEFAULT 'active',
  last_seen_at timestamptz,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iot_devices TO authenticated;
GRANT ALL ON public.iot_devices TO service_role;
ALTER TABLE public.iot_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff iot devices" ON public.iot_devices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.device_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.iot_devices(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  reading_type text,
  payload jsonb NOT NULL,
  is_alert boolean DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_readings TO authenticated;
GRANT ALL ON public.device_readings TO service_role;
ALTER TABLE public.device_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff readings" ON public.device_readings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.prediction_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL,
  description text,
  config jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prediction_models TO authenticated;
GRANT ALL ON public.prediction_models TO service_role;
ALTER TABLE public.prediction_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff models" ON public.prediction_models FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.forecast_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES public.prediction_models(id) ON DELETE CASCADE,
  domain text NOT NULL,
  forecast_date date NOT NULL,
  metric text NOT NULL,
  value numeric NOT NULL,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_results TO authenticated;
GRANT ALL ON public.forecast_results TO service_role;
ALTER TABLE public.forecast_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff forecasts" ON public.forecast_results FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.staffing_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  forecast_date date NOT NULL,
  required_doctors int DEFAULT 0,
  required_nurses int DEFAULT 0,
  required_support int DEFAULT 0,
  workload_score numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staffing_forecasts TO authenticated;
GRANT ALL ON public.staffing_forecasts TO service_role;
ALTER TABLE public.staffing_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff staffing fc" ON public.staffing_forecasts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  risk_type text NOT NULL,
  risk_level text NOT NULL,
  score numeric,
  factors jsonb DEFAULT '{}'::jsonb,
  recommendation text,
  status text DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_assessments TO authenticated;
GRANT ALL ON public.risk_assessments TO service_role;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff risks" ON public.risk_assessments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.pharmacy_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid REFERENCES public.medicines(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  predicted_demand int,
  current_stock int,
  reorder_qty int,
  expiry_risk numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pharmacy_forecasts TO authenticated;
GRANT ALL ON public.pharmacy_forecasts TO service_role;
ALTER TABLE public.pharmacy_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff pharm fc" ON public.pharmacy_forecasts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.security_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid,
  ip_address text,
  user_agent text,
  risk_score numeric DEFAULT 0,
  severity text DEFAULT 'low',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_monitoring TO authenticated;
GRANT ALL ON public.security_monitoring TO service_role;
ALTER TABLE public.security_monitoring ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin security" ON public.security_monitoring FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.patient_engagement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  engagement_type text NOT NULL,
  channel text,
  content text,
  status text DEFAULT 'sent',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_engagement_logs TO authenticated;
GRANT ALL ON public.patient_engagement_logs TO service_role;
ALTER TABLE public.patient_engagement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff engagement" ON public.patient_engagement_logs FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.remote_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  program_type text NOT NULL,
  vitals jsonb DEFAULT '{}'::jsonb,
  medication_compliance numeric,
  followup_status text,
  alert boolean DEFAULT false,
  notes text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.remote_monitoring TO authenticated;
GRANT ALL ON public.remote_monitoring TO service_role;
ALTER TABLE public.remote_monitoring ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff remote" ON public.remote_monitoring FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.compliance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard text NOT NULL,
  area text NOT NULL,
  score numeric,
  findings text,
  action_items jsonb DEFAULT '[]'::jsonb,
  assessed_by uuid REFERENCES auth.users(id),
  assessed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_assessments TO authenticated;
GRANT ALL ON public.compliance_assessments TO service_role;
ALTER TABLE public.compliance_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff compliance" ON public.compliance_assessments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.recovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_type text NOT NULL,
  status text NOT NULL,
  duration_seconds int,
  data_size_mb numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_logs TO authenticated;
GRANT ALL ON public.recovery_logs TO service_role;
ALTER TABLE public.recovery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin recovery" ON public.recovery_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  tags text[],
  version int DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO authenticated;
GRANT ALL ON public.knowledge_base TO service_role;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff kb" ON public.knowledge_base FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_name text NOT NULL,
  endpoint text,
  method text,
  status_code int,
  request_payload jsonb,
  response_payload jsonb,
  duration_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_logs TO authenticated;
GRANT ALL ON public.integration_logs TO service_role;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin integrations" ON public.integration_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
