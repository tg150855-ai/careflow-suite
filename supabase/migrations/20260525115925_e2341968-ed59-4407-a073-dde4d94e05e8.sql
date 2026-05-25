
-- Add search_path to remaining functions
CREATE OR REPLACE FUNCTION public.generate_uhid()
RETURNS TEXT LANGUAGE SQL VOLATILE SET search_path = public AS $$
  SELECT 'HMS-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.uhid_seq')::text, 6, '0')
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Lock down SECURITY DEFINER functions: only authenticated can call role checks; trigger fn only via system
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Tighten audit log insert: must be the acting user
DROP POLICY IF EXISTS "system writes audit" ON public.audit_logs;
CREATE POLICY "users write own audit" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
