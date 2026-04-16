-- First Workout Celebration — Alert Type Migration
--
-- Adds `first_workout` to coach_alerts.alert_type CHECK.
-- Fired by the coach_clients-gated first-workout trigger on `workouts` INSERT.
-- Idempotent.

ALTER TABLE public.coach_alerts DROP CONSTRAINT IF EXISTS coach_alerts_alert_type_check;

ALTER TABLE public.coach_alerts
    ADD CONSTRAINT coach_alerts_alert_type_check CHECK (alert_type IN (
        'inactive_client','unread_message','incoming_dm','challenge_dropout','streak_broken',
        'milestone_near','nutrition_gap','coaching_idea','win_to_celebrate','general_idea',
        'new_user_onboarding','not_in_challenge','level_up','comeback','mood_low','mood_pattern',
        'workout_dropoff','meal_dropoff','wearable_insight','checkin_due',
        'onboarding_welcome','onboarding_day_3','onboarding_day_7','onboarding_day_14','onboarding_day_30',
        'morning_pulse',
        -- NEW
        'first_workout',
        -- Reserved for the weekly check-in extension past day 30
        'weekly_checkin',
        -- Reserved for the Sunday per-client digest (coach-only, not sent to client)
        'weekly_digest'
    ));
