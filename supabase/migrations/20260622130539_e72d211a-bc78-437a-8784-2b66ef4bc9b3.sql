
-- 1. Fix broken telemedicine_sessions RLS (self-join bug exposing all sessions)
DROP POLICY IF EXISTS "tele staff or own" ON public.telemedicine_sessions;
CREATE POLICY "tele staff or own" ON public.telemedicine_sessions
FOR ALL TO authenticated
USING (
  is_staff(auth.uid())
  OR doctor_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.patient_portal_accounts p
    WHERE p.user_id = auth.uid()
      AND p.patient_id = telemedicine_sessions.patient_id
  )
)
WITH CHECK (
  is_staff(auth.uid()) OR doctor_id = auth.uid()
);

-- 2. Restrict salary_slips and salary_structures reads to admin/HR/finance only
DROP POLICY IF EXISTS "staff read slip" ON public.salary_slips;
CREATE POLICY "hr read slip" ON public.salary_slips
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
);

DROP POLICY IF EXISTS "staff read sal" ON public.salary_structures;
CREATE POLICY "hr read sal" ON public.salary_structures
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
);

-- 3. Restrict hospital-assets storage reads to staff users only
DROP POLICY IF EXISTS "hospital-assets staff read" ON storage.objects;
CREATE POLICY "hospital-assets staff read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'hospital-assets'
  AND public.is_staff(auth.uid())
);

-- 4. Switch SECURITY DEFINER helpers to SECURITY INVOKER so signed-in users
--    cannot execute elevated functions. RLS on user_roles/role_permissions
--    already scopes results to the caller's own rows, so behavior is preserved.
ALTER FUNCTION public.has_role(uuid, app_role) SECURITY INVOKER;
ALTER FUNCTION public.has_any_role(uuid) SECURITY INVOKER;
ALTER FUNCTION public.is_staff(uuid) SECURITY INVOKER;
ALTER FUNCTION public.has_module_permission(uuid, text, text) SECURITY INVOKER;
ALTER FUNCTION public.mark_password_changed() SECURITY INVOKER;
ALTER FUNCTION public.log_audit_event(text, text, text, jsonb, jsonb) SECURITY INVOKER;
