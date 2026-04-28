-- Adds 'ig_incoming_dm' to the coach_alerts.alert_type CHECK constraint so the
-- IG (ManyChat) draft producer (netlify/functions/ig-instant-draft.js) can
-- queue draft alerts for Instagram DMs. Same review-edit-send flow as the
-- existing 'incoming_dm' type, except send-coach-reply.js routes outbound
-- through ManyChat instead of nudges (it branches on data.channel === 'instagram').
--
-- The full alert_type whitelist below combines every type defined across the
-- prior migrations (coach_alerts_migration, coach_alerts_add_incoming_dm,
-- onboarding_sequence_migration, morning_pulse_migration,
-- first_workout_alert_type_migration, plateau_detection_alert_type_migration,
-- badge_earned_migration) plus the new 'ig_incoming_dm'. Replacing the
-- constraint with anything less than the full list violates the existing rows.
--
-- Safe to re-run.

ALTER TABLE public.coach_alerts
    DROP CONSTRAINT IF EXISTS coach_alerts_alert_type_check;

ALTER TABLE public.coach_alerts
    ADD CONSTRAINT coach_alerts_alert_type_check CHECK (alert_type IN (
        'inactive_client',
        'unread_message',
        'incoming_dm',
        'ig_incoming_dm',           -- Instagram DM via ManyChat (NEW)
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
        'onboarding_welcome',
        'onboarding_day_3',
        'onboarding_day_7',
        'onboarding_day_14',
        'onboarding_day_30',
        'morning_pulse',
        'first_workout',
        'weekly_checkin',
        'weekly_digest',
        'plateau_reassess',
        'badge_earned'
    ));
