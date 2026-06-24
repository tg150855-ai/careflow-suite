ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'in_consultation';

ALTER TABLE public.appointments
  ALTER COLUMN token_no SET DEFAULT nextval('public.queue_token_seq'::regclass);

ALTER TABLE public.queue_tokens
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'queue_tokens_appointment_id_key'
      AND conrelid = 'public.queue_tokens'::regclass
  ) THEN
    ALTER TABLE public.queue_tokens
      ADD CONSTRAINT queue_tokens_appointment_id_key UNIQUE (appointment_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_opd_queue_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  queue_status text;
BEGIN
  IF NEW.status = 'cancelled' THEN
    queue_status := 'cancelled';
  ELSIF NEW.status = 'completed' THEN
    queue_status := 'completed';
  ELSIF NEW.status = 'in_consultation' THEN
    queue_status := 'in_consultation';
  ELSIF NEW.status IN ('checked_in', 'waiting') THEN
    queue_status := 'waiting';
  ELSE
    queue_status := 'confirmed';
  END IF;

  INSERT INTO public.queue_tokens (
    token_no,
    counter,
    patient_id,
    doctor_id,
    appointment_id,
    status,
    issued_at,
    called_at,
    served_at
  ) VALUES (
    COALESCE(NEW.token_no, nextval('public.queue_token_seq'::regclass)),
    'OPD',
    NEW.patient_id,
    NEW.doctor_id,
    NEW.id,
    queue_status,
    COALESCE(NEW.scheduled_at, now()),
    CASE WHEN queue_status = 'in_consultation' THEN now() ELSE NULL END,
    CASE WHEN queue_status = 'completed' THEN now() ELSE NULL END
  )
  ON CONFLICT (appointment_id) DO UPDATE SET
    token_no = COALESCE(EXCLUDED.token_no, public.queue_tokens.token_no),
    patient_id = EXCLUDED.patient_id,
    doctor_id = EXCLUDED.doctor_id,
    status = EXCLUDED.status,
    called_at = CASE
      WHEN EXCLUDED.status = 'in_consultation' THEN COALESCE(public.queue_tokens.called_at, now())
      WHEN EXCLUDED.status IN ('confirmed', 'waiting') THEN NULL
      ELSE public.queue_tokens.called_at
    END,
    served_at = CASE
      WHEN EXCLUDED.status = 'completed' THEN COALESCE(public.queue_tokens.served_at, now())
      WHEN EXCLUDED.status IN ('confirmed', 'waiting', 'in_consultation') THEN NULL
      ELSE public.queue_tokens.served_at
    END;

  IF NEW.token_no IS NULL THEN
    NEW.token_no := (
      SELECT token_no FROM public.queue_tokens WHERE appointment_id = NEW.id
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_opd_queue_from_appointment ON public.appointments;
CREATE TRIGGER trg_sync_opd_queue_from_appointment
BEFORE INSERT OR UPDATE OF patient_id, doctor_id, scheduled_at, token_no, status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_opd_queue_from_appointment();

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['appointments','queue_tokens','opd_visits','prescriptions','prescription_items','bills','bill_items','payments','emr_records','vitals']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;