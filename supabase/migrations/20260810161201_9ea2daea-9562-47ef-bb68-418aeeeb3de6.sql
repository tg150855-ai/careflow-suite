ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL;

ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.hospitals ADD COLUMN IF NOT EXISTS status_reason text;
ALTER TABLE public.hospitals ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.hospitals ALTER COLUMN owner_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_hospital_id ON public.profiles(hospital_id);

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.current_hospital_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hospital_id FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "Allow public insert hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Allow public select hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Allow public update hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "super admin manage hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "members read own hospital" ON public.hospitals;

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitals TO authenticated;
GRANT ALL ON public.hospitals TO service_role;

CREATE POLICY "super admin manage hospitals" ON public.hospitals
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "members read own hospital" ON public.hospitals
  FOR SELECT TO authenticated
  USING (id = public.current_hospital_id());

DROP TRIGGER IF EXISTS trg_hospitals_updated ON public.hospitals;
CREATE TRIGGER trg_hospitals_updated BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();