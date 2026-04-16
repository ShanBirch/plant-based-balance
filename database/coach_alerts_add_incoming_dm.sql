-- Add 'incoming_dm' to the coach_alerts alert_type CHECK constraint.
--
-- The original coach_alerts_migration.sql had a fixed whitelist of alert_types.
-- The ai-client-monitor.js has since introduced many more types (level_up,
-- comeback, mood_low, wearable_insight, etc.) and we're adding one more here
-- for the instant-DM-draft trigger.
--
-- Run this in the Supabase SQL Editor AFTER the original coach_alerts
-- migration and BEFORE deploying instant_coach_draft_trigger.sql.

ALTER TABLE public.coach_alerts
    DROP CONSTRAINT IF EXISTS coach_alerts_alert_type_check;

-- Relax to a broad whitelist. Listed types match what ai-client-monitor.js
-- and instant-coach-draft.js actually emit.
ALTER TABLE public.coach_alerts
    ADD CONSTRAINT coach_alerts_alert_type_check CHECK (alert_type IN (
        'inactive_client',
        'unread_message',        -- legacy batch-detected unread DM (phasing out for admins)
        'incoming_dm',           -- instant-draft event: client just sent a DM to an admin
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
        'checkin_due'
    ));
