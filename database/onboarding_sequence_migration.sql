-- 30-Day Client Onboarding Sequence — Alert Type Migration
--
-- Adds 5 new alert_type values for the automated onboarding sequence:
--   onboarding_welcome   — day 0 (fires on coach_clients INSERT via trigger)
--   onboarding_day_3     — first check-in
--   onboarding_day_7     — first-week review
--   onboarding_day_14    — mid-month progress
--   onboarding_day_30    — first-month celebration
--
-- Uses the DROP+ADD pattern proven in coach_alerts_add_incoming_dm.sql.
-- Idempotent (DROP IF EXISTS + ADD). Safe to re-run.

ALTER TABLE public.coach_alerts DROP CONSTRAINT IF EXISTS coach_alerts_alert_type_check;

ALTER TABLE public.coach_alerts
    ADD CONSTRAINT coach_alerts_alert_type_check CHECK (alert_type IN (
        'inactive_client',
        'unread_message',
        'incoming_dm',
        'challenge_dropout',
        'streak_broken',
        'milestone_near',
        'nutrition_gap',
        'coaching_idea',
        'win_to_celebrate',
        'general_idea',
        'new_user_onboarding',
        'not_in_challenge',
        'level_up',
        'comeback',
        'mood_low',
        'mood_pattern',
        'workout_dropoff',
        'meal_dropoff',
        'wearable_insight',
        'checkin_due',
        -- NEW — 30-day onboarding sequence
        'onboarding_welcome',
        'onboarding_day_3',
        'onboarding_day_7',
        'onboarding_day_14',
        'onboarding_day_30'
    ));

-- Verify:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.coach_alerts'::regclass AND conname LIKE '%alert_type%';
