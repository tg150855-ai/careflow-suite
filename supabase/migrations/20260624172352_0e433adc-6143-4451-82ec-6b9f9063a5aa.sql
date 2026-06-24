DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'queue_tokens_patient_id_fkey'
      AND conrelid = 'public.queue_tokens'::regclass
  ) THEN
    ALTER TABLE public.queue_tokens
      ADD CONSTRAINT queue_tokens_patient_id_fkey
      FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
  END IF;
END $$;