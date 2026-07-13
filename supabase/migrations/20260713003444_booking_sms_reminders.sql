-- Public bookings are intentionally limited to the next five calendar days.
ALTER TABLE public.balance_booking_settings
  DROP CONSTRAINT IF EXISTS balance_booking_settings_booking_window_days_check;

ALTER TABLE public.balance_booking_settings
  ALTER COLUMN booking_window_days SET DEFAULT 5;

UPDATE public.balance_booking_settings
SET booking_window_days = 5
WHERE id = TRUE;

ALTER TABLE public.balance_booking_settings
  ADD CONSTRAINT balance_booking_settings_booking_window_days_check
  CHECK (booking_window_days = 5);

-- Transactional SMS state is service-role only through the booking functions.
ALTER TABLE public.balance_bookings
  ADD COLUMN IF NOT EXISTS sms_confirmation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_reminder_claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS balance_bookings_pending_sms_reminder_idx
  ON public.balance_bookings (starts_at)
  WHERE status = 'confirmed'
    AND phone IS NOT NULL
    AND sms_reminder_sent_at IS NULL
    AND sms_reminder_claimed_at IS NULL;

COMMENT ON COLUMN public.balance_bookings.sms_confirmation_sent_at IS
  'When the transactional booking confirmation text was accepted by the SMS provider.';
COMMENT ON COLUMN public.balance_bookings.sms_reminder_sent_at IS
  'When the two-hour transactional booking reminder text was accepted by the SMS provider.';
COMMENT ON COLUMN public.balance_bookings.sms_reminder_claimed_at IS
  'Temporary concurrency claim while the scheduled SMS reminder worker delivers a message.';

NOTIFY pgrst, 'reload schema';
