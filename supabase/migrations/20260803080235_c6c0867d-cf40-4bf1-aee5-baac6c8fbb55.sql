DROP POLICY IF EXISTS "hr read emp" ON public.employees;
CREATE POLICY "hr read emp" ON public.employees
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'hr_manager'::app_role)
);

DROP POLICY IF EXISTS "user read own notif" ON public.notifications;
CREATE POLICY "user read own notif" ON public.notifications
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    target_role IS NOT NULL
    AND target_role <> 'patient'::app_role
    AND has_role(auth.uid(), target_role)
    AND is_staff(auth.uid())
  )
);