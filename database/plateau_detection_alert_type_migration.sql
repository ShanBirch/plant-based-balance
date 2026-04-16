-- Plateau Detection — Alert Type Migration
--
-- Adds `plateau_reassess` to coach_alerts.alert_type CHECK.
-- Fired by plateau-detection-scan scheduled Netlify function (weekly).
-- Idempotent.

ALTER TABLE public.coach_alerts DROP CONSTRAINT IF EXISTS coach_alerts_alert_type_check;

ALTER TABLE public.coach_alerts
    ADD CONSTRAINT coach_alerts_alert_type_check CHECK (alert_type IN (
        'inactive_client','unread_message','incoming_dm','challenge_dropout','streak_broken',
        'milestone_near','nutrition_gap','coaching_idea','win_to_celebrate','general_idea',
        'new_user_onboarding','not_in_challenge','level_up','comeback','mood_low','mood_pattern',
        'workout_dropoff','meal_dropoff','wearable_insight','checkin_due',
        'onboarding_welcome','onboarding_day_3','onboarding_day_7','onboarding_day_14','onboarding_day_30',
        'morning_pulse','first_workout','weekly_checkin','weekly_digest',
        -- NEW
        'plateau_reassess'
    ));
