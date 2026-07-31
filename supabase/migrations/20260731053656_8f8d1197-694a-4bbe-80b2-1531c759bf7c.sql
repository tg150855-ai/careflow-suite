DROP TRIGGER IF EXISTS trg_sync_opd_queue ON public.appointments;
CREATE TRIGGER trg_sync_opd_queue
AFTER INSERT OR UPDATE OF status, token_no, scheduled_at, patient_id, doctor_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_opd_queue_from_appointment();