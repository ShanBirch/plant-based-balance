-- Keep channel-specific identities and 24-hour reply windows separate.
ALTER TABLE public.ig_threads DROP CONSTRAINT ig_threads_channel_check;
ALTER TABLE public.ig_threads ADD CONSTRAINT ig_threads_channel_check CHECK (channel IN ('instagram','messenger','whatsapp'));
-- Preserve every existing alert type while adding WhatsApp conversation alerts.
DO $$ DECLARE existing_definition text; BEGIN
 SELECT pg_get_constraintdef(oid) INTO existing_definition FROM pg_constraint WHERE conrelid='public.coach_alerts'::regclass AND conname='coach_alerts_alert_type_check';
 IF existing_definition NOT LIKE '%whatsapp_incoming_message%' THEN
  EXECUTE 'ALTER TABLE public.coach_alerts DROP CONSTRAINT coach_alerts_alert_type_check';
  EXECUTE 'ALTER TABLE public.coach_alerts ADD CONSTRAINT coach_alerts_alert_type_check CHECK ((' || substring(existing_definition from 8 for length(existing_definition)-8) || ') OR alert_type = ''whatsapp_incoming_message'')';
 END IF;
END $$;
