
ALTER TABLE public.surgeries
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_scheduled_start timestamptz,
  ADD COLUMN IF NOT EXISTS last_reschedule_reason text,
  ADD COLUMN IF NOT EXISTS last_rescheduled_at timestamptz;
