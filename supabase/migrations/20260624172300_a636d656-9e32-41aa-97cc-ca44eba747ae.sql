CREATE OR REPLACE FUNCTION public.sync_opd_queue_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  queue_status text;
  queue_token integer;
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

  queue_token := COALESCE(NEW.token_no, nextval('public.queue_token_seq'::regclass));

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
    queue_token,
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
    issued_at = EXCLUDED.issued_at,
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

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_opd_queue_from_appointment ON public.appointments;
CREATE TRIGGER trg_sync_opd_queue_from_appointment
AFTER INSERT OR UPDATE OF patient_id, doctor_id, scheduled_at, token_no, status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_opd_queue_from_appointment();