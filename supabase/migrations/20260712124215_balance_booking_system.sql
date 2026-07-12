-- Balance call booking: public slots are served only through the Netlify
-- function. These tables deliberately have no browser-facing RLS policies.

CREATE TABLE IF NOT EXISTS public.balance_booking_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  booking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  event_name TEXT NOT NULL DEFAULT 'Balance call',
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 15 AND 90),
  minimum_notice_hours INTEGER NOT NULL DEFAULT 24 CHECK (minimum_notice_hours BETWEEN 1 AND 168),
  booking_window_days INTEGER NOT NULL DEFAULT 28 CHECK (booking_window_days BETWEEN 7 AND 90),
  timezone TEXT NOT NULL DEFAULT 'Australia/Brisbane',
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  location TEXT NOT NULL DEFAULT 'Online, link sent after booking',
  weekly_hours JSONB NOT NULL DEFAULT '{
    "1": [{"start":"10:00","end":"15:00"}],
    "2": [{"start":"10:00","end":"15:00"}],
    "3": [{"start":"10:00","end":"15:00"}],
    "4": [{"start":"10:00","end":"15:00"}],
    "5": []
  }'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.balance_booking_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.balance_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320),
  phone TEXT,
  goal TEXT,
  timezone TEXT NOT NULL DEFAULT 'Australia/Brisbane',
  calendar_event_id TEXT,
  confirmation_email_sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  CHECK (ends_at <= starts_at + INTERVAL '90 minutes')
);

-- All booking slots have one configured duration. The partial unique index
-- makes competing requests for the same live slot resolve safely at the DB.
CREATE UNIQUE INDEX IF NOT EXISTS balance_bookings_confirmed_starts_at_key
  ON public.balance_bookings (starts_at)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS balance_bookings_active_window_idx
  ON public.balance_bookings (starts_at, ends_at)
  WHERE status = 'confirmed';

ALTER TABLE public.balance_booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_bookings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.balance_booking_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.balance_bookings FROM anon, authenticated;
GRANT ALL ON TABLE public.balance_booking_settings TO service_role;
GRANT ALL ON TABLE public.balance_bookings TO service_role;

DROP TRIGGER IF EXISTS update_balance_booking_settings_updated_at ON public.balance_booking_settings;
CREATE TRIGGER update_balance_booking_settings_updated_at
  BEFORE UPDATE ON public.balance_booking_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_balance_bookings_updated_at ON public.balance_bookings;
CREATE TRIGGER update_balance_bookings_updated_at
  BEFORE UPDATE ON public.balance_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.balance_booking_settings IS
  'Single-owner configuration for the public Balance call booking page. Updated only through the authenticated booking setup surface.';

COMMENT ON TABLE public.balance_bookings IS
  'Confirmed and cancelled Balance call bookings. Public users can only interact through the Netlify booking function.';

NOTIFY pgrst, 'reload schema';
