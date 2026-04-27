-- coach_alerts dedup cleanup + idempotency_key backfill
--
-- Run AFTER coach_alerts_idempotency_migration.sql is applied. This script:
--   1. Deletes duplicate alert rows (keeping the earliest per dedup key)
--      so the partial UNIQUE index can be populated without conflict.
--   2. Backfills `idempotency_key` on the remaining rows so future producer
--      retries collide with them and fail-fast at the DB instead of
--      duplicating in app code.
--
-- Idempotent — safe to re-run. Each block is wrapped so re-runs
-- against an already-clean table are no-ops.
--
-- Dedup keys mirror what the producer JS now writes (see
-- netlify/functions/_lib/client-context.js insertCoachAlert + each producer):
--   first_workout:               (client_id)
--   onboarding_welcome:          (coach_id, client_id)
--   onboarding_day_3/7/14/30:    (coach_id, client_id, alert_type)
--   incoming_dm:                 data->>nudge_id
--   badge_earned:                (client_id, sorted badge_ids)
--   win_to_celebrate:            data->>pb_history_id (when present)
--   weekly_digest / _checkin / plateau_reassess:
--                                (coach_id, client_id, DATE(created_at))
--   pulse alerts:                (coach_id, client_id, alert_type, DATE(created_at), data->>pulse_origin)

-- ============================================================
-- 1. ONCE-ONLY ALERT TYPES — delete dupes, keep earliest per (client[, coach])
-- ============================================================

-- first_workout: one per client lifetime
DELETE FROM public.coach_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at ASC, id ASC) AS rn
        FROM public.coach_alerts
        WHERE alert_type = 'first_workout'
    ) t WHERE t.rn > 1
);

UPDATE public.coach_alerts
SET idempotency_key = 'first_workout:' || client_id::text
WHERE alert_type = 'first_workout' AND idempotency_key IS NULL;

-- onboarding_welcome: one per (coach, client) lifetime
DELETE FROM public.coach_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY coach_id, client_id ORDER BY created_at ASC, id ASC) AS rn
        FROM public.coach_alerts
        WHERE alert_type = 'onboarding_welcome'
    ) t WHERE t.rn > 1
);

UPDATE public.coach_alerts
SET idempotency_key = 'onboarding_welcome:' || coach_id::text || ':' || client_id::text
WHERE alert_type = 'onboarding_welcome' AND idempotency_key IS NULL AND coach_id IS NOT NULL;

-- onboarding milestone scans (3/7/14/30): one per (coach, client, type) lifetime
DELETE FROM public.coach_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY coach_id, client_id, alert_type ORDER BY created_at ASC, id ASC) AS rn
        FROM public.coach_alerts
        WHERE alert_type IN ('onboarding_day_3','onboarding_day_7','onboarding_day_14','onboarding_day_30')
    ) t WHERE t.rn > 1
);

UPDATE public.coach_alerts
SET idempotency_key = alert_type || ':' || coach_id::text || ':' || client_id::text
WHERE alert_type IN ('onboarding_day_3','onboarding_day_7','onboarding_day_14','onboarding_day_30')
  AND idempotency_key IS NULL
  AND coach_id IS NOT NULL;

-- ============================================================
-- 2. EVENT-KEYED ALERT TYPES — collapse to the earliest per event
-- ============================================================

-- incoming_dm: one per nudge_id (the natural event identity)
DELETE FROM public.coach_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY (data->>'nudge_id') ORDER BY created_at ASC, id ASC) AS rn
        FROM public.coach_alerts
        WHERE alert_type = 'incoming_dm' AND data->>'nudge_id' IS NOT NULL
    ) t WHERE t.rn > 1
);

UPDATE public.coach_alerts
SET idempotency_key = 'incoming_dm:' || (data->>'nudge_id')
WHERE alert_type = 'incoming_dm'
  AND idempotency_key IS NULL
  AND data->>'nudge_id' IS NOT NULL;

-- win_to_celebrate: one per pb_history_id when present (rows pre-dating the
-- field stay NULL-keyed and don't participate in the unique index)
DELETE FROM public.coach_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY (data->>'pb_history_id') ORDER BY created_at ASC, id ASC) AS rn
        FROM public.coach_alerts
        WHERE alert_type = 'win_to_celebrate' AND data->>'pb_history_id' IS NOT NULL
    ) t WHERE t.rn > 1
);

UPDATE public.coach_alerts
SET idempotency_key = 'win_to_celebrate:' || (data->>'pb_history_id')
WHERE alert_type = 'win_to_celebrate'
  AND idempotency_key IS NULL
  AND data->>'pb_history_id' IS NOT NULL;

-- ============================================================
-- 3. PERIODIC ALERT TYPES — collapse same-day fires only
-- (legitimate week-over-week repeats stay; today's race-condition dupes don't)
-- ============================================================

-- weekly_digest, weekly_checkin, plateau_reassess: one per (coach, client, DATE)
DELETE FROM public.coach_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY alert_type, coach_id, client_id, DATE(created_at)
                   ORDER BY created_at ASC, id ASC
               ) AS rn
        FROM public.coach_alerts
        WHERE alert_type IN ('weekly_digest','weekly_checkin','plateau_reassess')
          AND coach_id IS NOT NULL
    ) t WHERE t.rn > 1
);

UPDATE public.coach_alerts
SET idempotency_key = alert_type || ':' || coach_id::text || ':' || client_id::text || ':' || DATE(created_at)::text
WHERE alert_type IN ('weekly_digest','weekly_checkin','plateau_reassess')
  AND idempotency_key IS NULL
  AND coach_id IS NOT NULL;

-- ============================================================
-- 4. PULSE ALERTS — collapse same-day same-pulse-origin fires
-- ============================================================

-- pulse alerts (morning/lunch/evening) tag data->>pulse_origin so the cooldown
-- can find them. One alert per (alert_type, coach, client, day, pulse_origin).
DELETE FROM public.coach_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY alert_type, coach_id, client_id, DATE(created_at), data->>'pulse_origin'
                   ORDER BY created_at ASC, id ASC
               ) AS rn
        FROM public.coach_alerts
        WHERE coach_id IS NOT NULL
          AND data->>'pulse_origin' IS NOT NULL
    ) t WHERE t.rn > 1
);

UPDATE public.coach_alerts
SET idempotency_key = alert_type || ':' || coach_id::text || ':' || client_id::text
                      || ':' || DATE(created_at)::text || ':' || (data->>'pulse_origin')
WHERE idempotency_key IS NULL
  AND coach_id IS NOT NULL
  AND data->>'pulse_origin' IS NOT NULL;

-- ============================================================
-- 5. BADGE_EARNED — collapse duplicate (client, sorted-badge-ids) sets
-- ============================================================

WITH keyed AS (
    SELECT id, client_id, created_at,
           (SELECT string_agg(elem, ',' ORDER BY elem)
            FROM jsonb_array_elements_text(data->'badge_ids') AS elem) AS badge_key
    FROM public.coach_alerts
    WHERE alert_type = 'badge_earned' AND data ? 'badge_ids'
),
ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY client_id, badge_key
                              ORDER BY created_at ASC, id ASC) AS rn
    FROM keyed
)
DELETE FROM public.coach_alerts WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

UPDATE public.coach_alerts a
SET idempotency_key = 'badge_earned:' || a.client_id::text || ':' || sub.badge_key
FROM (
    SELECT id,
           (SELECT string_agg(elem, ',' ORDER BY elem)
            FROM jsonb_array_elements_text(data->'badge_ids') AS elem) AS badge_key
    FROM public.coach_alerts
    WHERE alert_type = 'badge_earned'
      AND idempotency_key IS NULL
      AND data ? 'badge_ids'
) sub
WHERE a.id = sub.id;
