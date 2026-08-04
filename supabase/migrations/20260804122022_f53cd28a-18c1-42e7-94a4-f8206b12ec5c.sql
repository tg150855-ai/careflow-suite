
DROP POLICY IF EXISTS "rad_test_master_read" ON public.radiology_test_master;
CREATE POLICY "rad_test_master_read" ON public.radiology_test_master
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "rad_templates_read" ON public.radiology_report_templates;
CREATE POLICY "rad_templates_read" ON public.radiology_report_templates
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "user read own notif" ON public.notifications;
CREATE POLICY "user read own notif" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      user_id IS NULL
      AND target_role IS NOT NULL
      AND target_role <> 'patient'::app_role
      AND public.is_staff(auth.uid())
      AND public.has_role(auth.uid(), target_role)
    )
  );
