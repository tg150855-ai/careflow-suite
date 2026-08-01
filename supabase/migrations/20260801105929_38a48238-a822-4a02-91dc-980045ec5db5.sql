ALTER TABLE public.ambulances
  ADD COLUMN IF NOT EXISTS attendant_name text,
  ADD COLUMN IF NOT EXISTS capacity integer,
  ADD COLUMN IF NOT EXISTS insurance_no text,
  ADD COLUMN IF NOT EXISTS insurance_expiry date,
  ADD COLUMN IF NOT EXISTS last_service_date date,
  ADD COLUMN IF NOT EXISTS next_service_due date,
  ADD COLUMN IF NOT EXISTS notes text;