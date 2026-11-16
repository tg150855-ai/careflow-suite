-- Migration: Allow doctors to insert/manage medicines in pharmacy master,
-- and provide sync_opd_prescribed_medicine SECURITY DEFINER function
-- for seamless OPD prescription-to-pharmacy synchronization.

-- 1. Ensure doctors, pharmacists, and admins can insert and update medicines
DROP POLICY IF EXISTS "pharm write medicines" ON public.medicines;
CREATE POLICY "pharm write medicines" ON public.medicines FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'pharmacist')
    OR public.has_role(auth.uid(), 'doctor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'pharmacist')
    OR public.has_role(auth.uid(), 'doctor')
  );

-- 2. Stored function to cleanly sync OPD prescribed medicines into pharmacy master
CREATE OR REPLACE FUNCTION public.sync_opd_prescribed_medicine(
  p_name text,
  p_hospital_id uuid DEFAULT NULL,
  p_generic_name text DEFAULT NULL,
  p_unit text DEFAULT 'pcs'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_med_id uuid;
  v_clean_name text;
BEGIN
  v_clean_name := trim(p_name);
  IF v_clean_name IS NULL OR length(v_clean_name) = 0 THEN
    RETURN NULL;
  END IF;

  -- Check if medicine already exists (case-insensitive) for this hospital or globally
  SELECT id INTO v_med_id
  FROM public.medicines
  WHERE lower(trim(name)) = lower(v_clean_name)
    AND (p_hospital_id IS NULL OR hospital_id IS NULL OR hospital_id = p_hospital_id)
  ORDER BY (hospital_id IS NOT NULL) DESC
  LIMIT 1;

  IF v_med_id IS NOT NULL THEN
    RETURN v_med_id;
  END IF;

  -- Insert new medicine record for pharmacy master
  INSERT INTO public.medicines (
    name,
    generic_name,
    unit,
    gst_percent,
    minimum_stock,
    active,
    hospital_id
  ) VALUES (
    v_clean_name,
    nullif(trim(p_generic_name), ''),
    coalesce(nullif(trim(p_unit), ''), 'pcs'),
    12.00,
    10,
    true,
    p_hospital_id
  )
  RETURNING id INTO v_med_id;

  RETURN v_med_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_opd_prescribed_medicine(text, uuid, text, text) TO authenticated;

