-- Store the lead's selected way to take the Balance call. Booking records remain
-- service-role only, as defined by the original booking-system migration.
ALTER TABLE public.balance_bookings
    ADD COLUMN IF NOT EXISTS call_type TEXT NOT NULL DEFAULT 'phone'
        CHECK (call_type IN ('phone', 'video', 'whatsapp')),
    ADD COLUMN IF NOT EXISTS meeting_url TEXT;

COMMENT ON COLUMN public.balance_bookings.call_type IS
    'Lead-selected contact method: phone, video (Google Meet), or WhatsApp.';
COMMENT ON COLUMN public.balance_bookings.meeting_url IS
    'Google Meet URL created for video bookings when it is immediately available.';

NOTIFY pgrst, 'reload schema';
