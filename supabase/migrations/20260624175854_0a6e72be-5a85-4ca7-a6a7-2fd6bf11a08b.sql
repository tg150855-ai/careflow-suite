DROP POLICY IF EXISTS "pkg public read" ON public.health_packages;
CREATE POLICY "pkg authenticated read" ON public.health_packages FOR SELECT TO authenticated USING (active = true OR public.is_staff(auth.uid()));
REVOKE SELECT ON public.health_packages FROM anon;
GRANT SELECT ON public.health_packages TO authenticated;