
DROP TABLE IF EXISTS public.api_usage_logs CASCADE;
DROP TABLE IF EXISTS public.api_keys CASCADE;
DROP TABLE IF EXISTS public.api_products CASCADE;
DROP TABLE IF EXISTS public.developer_accounts CASCADE;
DROP TABLE IF EXISTS public.workflow_instances CASCADE;
DROP TABLE IF EXISTS public.workflows CASCADE;
DROP TABLE IF EXISTS public.notification_campaigns CASCADE;
DROP TABLE IF EXISTS public.notification_templates CASCADE;
DROP TABLE IF EXISTS public.saas_invoices CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.tenant_domains CASCADE;
DROP TABLE IF EXISTS public.tenant_branding CASCADE;
DROP TABLE IF EXISTS public.franchises CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.regions CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.analytics_warehouse CASCADE;
DROP TABLE IF EXISTS public.ai_forecasts CASCADE;
DROP TABLE IF EXISTS public.compliance_metrics CASCADE;
DROP TABLE IF EXISTS public.security_events CASCADE;
DROP TABLE IF EXISTS public.backup_jobs CASCADE;
DROP TABLE IF EXISTS public.master_data_registry CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.revenue_streams CASCADE;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  version integer NOT NULL DEFAULT 1,
  access_level text NOT NULL DEFAULT 'staff',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage documents" ON public.documents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version integer NOT NULL,
  file_url text NOT NULL,
  file_size_bytes bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage document_versions" ON public.document_versions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.document_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.document_access_logs TO authenticated;
GRANT ALL ON public.document_access_logs TO service_role;
ALTER TABLE public.document_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff view document_access_logs" ON public.document_access_logs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.predictive_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_type text NOT NULL,
  horizon_days integer NOT NULL DEFAULT 30,
  generated_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(5,2),
  generated_by text DEFAULT 'system'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictive_forecasts TO authenticated;
GRANT ALL ON public.predictive_forecasts TO service_role;
ALTER TABLE public.predictive_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage predictive_forecasts" ON public.predictive_forecasts FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.mobile_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  device_token text NOT NULL,
  app_role text NOT NULL DEFAULT 'patient',
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_token)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_device_tokens TO authenticated;
GRANT ALL ON public.mobile_device_tokens TO service_role;
ALTER TABLE public.mobile_device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mobile_device_tokens" ON public.mobile_device_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.kiosk_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_id text,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  check_in_method text NOT NULL DEFAULT 'qr',
  status text NOT NULL DEFAULT 'completed',
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_sessions TO authenticated;
GRANT ALL ON public.kiosk_sessions TO service_role;
ALTER TABLE public.kiosk_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage kiosk_sessions" ON public.kiosk_sessions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
