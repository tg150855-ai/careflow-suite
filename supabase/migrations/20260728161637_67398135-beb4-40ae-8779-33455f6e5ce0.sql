ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS handwriting_png text,
  ADD COLUMN IF NOT EXISTS signature_png text,
  ADD COLUMN IF NOT EXISTS notes text;