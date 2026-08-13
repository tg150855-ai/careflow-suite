-- 1. allowed roles per hospital (super admin controlled)
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS allowed_roles jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. add hospital_id + restrictive tenant isolation to every data table
DO $$
DECLARE
  t text;
  skip text[] := ARRAY[
    'hospitals','profiles','user_roles','super_admins','super_admin_audit_logs',
    'hospital_registrations','hospital_subscriptions','role_permissions'
  ];
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT (c.relname = ANY(skip))
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS hospital_id uuid DEFAULT public.current_hospital_id() REFERENCES public.hospitals(id) ON DELETE CASCADE', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (hospital_id)', 'idx_' || t || '_hospital_id', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I AS RESTRICTIVE TO authenticated
         USING (public.is_super_admin(auth.uid()) OR hospital_id IS NOT DISTINCT FROM public.current_hospital_id())
         WITH CHECK (public.is_super_admin(auth.uid()) OR hospital_id IS NOT DISTINCT FROM public.current_hospital_id())', t);
  END LOOP;
END $$;