-- Meal Reminders Migration
-- Add meal reminder preferences and tracking for breakfast/lunch/dinner prompts

-- ============================================================
-- MEAL REMINDER PREFERENCES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_reminder_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Enable/disable reminders
  reminders_enabled BOOLEAN DEFAULT true,

  -- Reminder times (stored as HH:MM format in user's local time)
  breakfast_time TIME DEFAULT '08:00:00',
  lunch_time TIME DEFAULT '12:30:00',
  dinner_time TIME DEFAULT '18:30:00',

  -- Enable individual meal reminders
  breakfast_reminder BOOLEAN DEFAULT true,
  lunch_reminder BOOLEAN DEFAULT true,
  dinner_reminder BOOLEAN DEFAULT true,

  -- Reminder delay (minutes after meal time to send reminder if not logged)
  reminder_delay_minutes INTEGER DEFAULT 30,

  -- User timezone (for accurate local time reminders)
  timezone TEXT DEFAULT 'America/New_York',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================
-- MEAL REMINDER LOG (track sent reminders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_reminder_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Reminder details
  meal_type TEXT NOT NULL, -- 'breakfast', 'lunch', 'dinner'
  reminder_date DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Was the meal eventually logged?
  meal_logged BOOLEAN DEFAULT false,
  meal_log_id UUID REFERENCES public.meal_logs(id) ON DELETE SET NULL,

  -- Prevent duplicate reminders
  UNIQUE(user_id, meal_type, reminder_date)
);

-- ============================================================
-- ADD meal_type AND input_method COLUMNS TO meal_logs (if not exists)
-- ============================================================
DO $$
BEGIN
  -- Add meal_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'meal_logs'
    AND column_name = 'meal_type'
  ) THEN
    ALTER TABLE public.meal_logs ADD COLUMN meal_type TEXT;
  END IF;

  -- Add input_method column to track how meal was logged
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'meal_logs'
    AND column_name = 'input_method'
  ) THEN
    ALTER TABLE public.meal_logs ADD COLUMN input_method TEXT DEFAULT 'photo';
    -- Values: 'photo', 'text', 'voice'
  END IF;

  -- Add meal_description column for text/voice input
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'meal_logs'
    AND column_name = 'meal_description'
  ) THEN
    ALTER TABLE public.meal_logs ADD COLUMN meal_description TEXT;
  END IF;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE public.meal_reminder_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_reminder_log ENABLE ROW LEVEL SECURITY;

-- Users can only access their own reminder preferences
CREATE POLICY "Users can manage own reminder preferences" ON public.meal_reminder_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own reminder logs
CREATE POLICY "Users can view own reminder logs" ON public.meal_reminder_log
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to check if a meal has been logged for a specific meal type today
CREATE OR REPLACE FUNCTION has_logged_meal_type(
  p_user_id UUID,
  p_meal_type TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.meal_logs
    WHERE user_id = p_user_id
      AND meal_date = p_date
      AND meal_type = p_meal_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get users who need meal reminders
CREATE OR REPLACE FUNCTION get_users_needing_meal_reminders(
  p_meal_type TEXT,
  p_current_time TIME
)
RETURNS TABLE (
  user_id UUID,
  push_endpoint TEXT,
  push_p256dh TEXT,
  push_auth TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mrp.user_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth
  FROM public.meal_reminder_preferences mrp
  JOIN public.push_subscriptions ps ON ps.user_id = mrp.user_id
  WHERE mrp.reminders_enabled = true
    AND (
      (p_meal_type = 'breakfast' AND mrp.breakfast_reminder = true
        AND p_current_time >= mrp.breakfast_time + (mrp.reminder_delay_minutes || ' minutes')::interval
        AND p_current_time < mrp.breakfast_time + ((mrp.reminder_delay_minutes + 30) || ' minutes')::interval)
      OR
      (p_meal_type = 'lunch' AND mrp.lunch_reminder = true
        AND p_current_time >= mrp.lunch_time + (mrp.reminder_delay_minutes || ' minutes')::interval
        AND p_current_time < mrp.lunch_time + ((mrp.reminder_delay_minutes + 30) || ' minutes')::interval)
      OR
      (p_meal_type = 'dinner' AND mrp.dinner_reminder = true
        AND p_current_time >= mrp.dinner_time + (mrp.reminder_delay_minutes || ' minutes')::interval
        AND p_current_time < mrp.dinner_time + ((mrp.reminder_delay_minutes + 30) || ' minutes')::interval)
    )
    -- Check they haven't already logged this meal today
    AND NOT has_logged_meal_type(mrp.user_id, p_meal_type, CURRENT_DATE)
    -- Check we haven't already sent a reminder today for this meal
    AND NOT EXISTS (
      SELECT 1 FROM public.meal_reminder_log mrl
      WHERE mrl.user_id = mrp.user_id
        AND mrl.meal_type = p_meal_type
        AND mrl.reminder_date = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-detect meal type based on time
CREATE OR REPLACE FUNCTION detect_meal_type(p_time TIME)
RETURNS TEXT AS $$
BEGIN
  IF p_time < '11:00:00'::TIME THEN
    RETURN 'breakfast';
  ELSIF p_time < '15:00:00'::TIME THEN
    RETURN 'lunch';
  ELSIF p_time < '21:00:00'::TIME THEN
    RETURN 'dinner';
  ELSE
    RETURN 'snack';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update updated_at timestamp automatically
CREATE TRIGGER update_meal_reminder_preferences_updated_at
  BEFORE UPDATE ON public.meal_reminder_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-set meal_type based on time if not provided
CREATE OR REPLACE FUNCTION auto_set_meal_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.meal_type IS NULL THEN
    NEW.meal_type := detect_meal_type(NEW.meal_time);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_set_meal_type_trigger
  BEFORE INSERT ON public.meal_logs
  FOR EACH ROW EXECUTE FUNCTION auto_set_meal_type();
