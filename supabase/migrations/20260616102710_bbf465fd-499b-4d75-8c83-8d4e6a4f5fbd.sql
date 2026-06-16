-- Phase 13: Staff Management lifecycle additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS password_changed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS login_disabled boolean NOT NULL DEFAULT false;

-- Allow admins/super_admins to read/update any profile for staff mgmt
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Allow admins to view all employees (existing policies may be restrictive). Add if not present.
DROP POLICY IF EXISTS "Admins view all employees" ON public.employees;
CREATE POLICY "Admins view all employees" ON public.employees
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'hr_manager'));

-- Server fn to mark own password as changed (called after first-login change)
CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET password_changed = true, updated_at = now()
  WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.mark_password_changed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;