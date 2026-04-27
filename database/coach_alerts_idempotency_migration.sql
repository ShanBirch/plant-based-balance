-- coach_alerts idempotency_key + dedup cleanup
--
-- Background: producers like first-workout-celebration, onboarding-welcome,
-- onboarding-scheduled-scan, badge-earned, pb-celebration, instant-coach-draft,
-- pulse-runner, weekly-coach-digest, weekly-checkin-scan and plateau-detection
-- all guard against duplicate alerts with an application-level SELECT-then-INSERT
-- check. That check races: if two trigger fires (e.g. finishWorkout() doing N
-- back-to-back per-set INSERTs) hit the netlify function in parallel, all of
-- them see "no existing alert" and all of them INSERT.
--
-- Real-world consequence (2026-04-27): the first-workout trigger fired 5x for
-- a single client, two of which auto-sent — Shannon got 5 push notifications
-- and the client got 2 welcome DMs.
--
-- Fix: every producer now sets a deterministic `idempotency_key` per event,
-- and a partial UNIQUE index makes the race fail with sqlstate 23505 atomically
-- instead of inserting the dupe row. Producers catch 23505, look up the existing
-- alert id, and skip their push so the second/third/Nth trigger fire is a
-- no-op.
--
-- Idempotency key format per producer:
--   first_workout:             first_workout:<client_id>
--   onboarding_welcome:        onboarding_welcome:<coach_id>:<client_id>
--   onboarding_day_3/7/14/30:  <alert_type>:<coach_id>:<client_id>
--   incoming_dm:               incoming_dm:<nudge_id>
--   badge_earned:              badge_earned:<client_id>:<sorted-badge-ids>
--   win_to_celebrate:          win_to_celebrate:<client_id>:<pb_history_id>
--   pulse alerts:              <alert_type>:<coach_id>:<client_id>:<YYYY-MM-DD>:<pulse_origin>
--   weekly_digest:             weekly_digest:<coach_id>:<client_id>:<ISO-week>
--   weekly_checkin:            weekly_checkin:<coach_id>:<client_id>:<ISO-week>
--   plateau_reassess:          plateau_reassess:<coach_id>:<client_id>:<ISO-week>
--
-- Safe to re-run.

ALTER TABLE public.coach_alerts
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Partial unique index — only rows with a non-null key participate, so legacy
-- rows that pre-date this migration don't all fight for the same NULL slot.
CREATE UNIQUE INDEX IF NOT EXISTS coach_alerts_idempotency_key_unique
    ON public.coach_alerts (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.coach_alerts.idempotency_key IS
    'Deterministic per-event key. Producers set this and rely on the partial UNIQUE index to fail duplicate inserts atomically (sqlstate 23505) instead of relying on a racy SELECT-then-INSERT check.';
