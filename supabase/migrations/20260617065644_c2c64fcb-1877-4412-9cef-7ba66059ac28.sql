
CREATE TABLE IF NOT EXISTS public.hospital_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  hospital_name text NOT NULL DEFAULT 'SBG Arogya Plus',
  tagline text,
  registration_no text,
  nabh_no text,
  gst_no text,
  website text,
  email text,
  phone text,
  address text,
  logo_url text,
  primary_color text DEFAULT '#0EA5E9',
  secondary_color text DEFAULT '#0F172A',
  accent_color text DEFAULT '#22C55E',
  prescription jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing jsonb NOT NULL DEFAULT '{"gst_percent":18,"invoice_prefix":"INV","receipt_prefix":"RCT","currency":"INR"}'::jsonb,
  printers jsonb NOT NULL DEFAULT '{}'::jsonb,
  messaging jsonb NOT NULL DEFAULT '{}'::jsonb,
  security jsonb NOT NULL DEFAULT '{"session_minutes":60,"max_attempts":5,"min_password_length":8}'::jsonb,
  departments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.hospital_settings TO authenticated;
GRANT ALL ON public.hospital_settings TO service_role;

ALTER TABLE public.hospital_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings read for staff" ON public.hospital_settings;
CREATE POLICY "settings read for staff" ON public.hospital_settings
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "settings write admins" ON public.hospital_settings;
CREATE POLICY "settings write admins" ON public.hospital_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "settings insert admins" ON public.hospital_settings;
CREATE POLICY "settings insert admins" ON public.hospital_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS hospital_settings_set_updated ON public.hospital_settings;
CREATE TRIGGER hospital_settings_set_updated
  BEFORE UPDATE ON public.hospital_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.hospital_settings (id) VALUES ('00000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO NOTHING;
