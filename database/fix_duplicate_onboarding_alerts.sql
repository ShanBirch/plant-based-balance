-- Fix duplicate onboarding milestone alerts
--
-- Problem: onboarding-scheduled-scan and onboarding-welcome-draft use a
-- check-then-insert dedup pattern. When Netlify runs the scheduled scan
-- with overlapping invocations (scheduler retry, 90-min bucket overlap,
-- etc.), two runs both pass the SELECT before either finishes the INSERT,
-- and each queues its own AI-drafted alert. The coach's phone buzzes
-- multiple times for the same milestone (see: "Josh — 1 week review"
-- appearing 3x with different draft replies).
--
-- Fix: enforce one alert per (coach_id, client_id, alert_type) for the
-- onboarding milestones at the DB layer. App inserts switch to
-- on_conflict=ignore-duplicates so the loser of a race becomes a silent
-- no-op instead of a second row.

-- 1. Drop existing duplicates. Keep the row that's already sent/actioned
--    (coach may have replied from it); otherwise keep the earliest created.
DELETE FROM public.coach_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY coach_id, client_id, alert_type
                   ORDER BY
                       CASE status
                           WHEN 'sent' THEN 0
                           WHEN 'snoozed' THEN 1
                           WHEN 'dismissed' THEN 2
                           ELSE 3
                       END,
                       created_at ASC
               ) AS rn
        FROM public.coach_alerts
        WHERE alert_type IN (
            'onboarding_welcome',
            'onboarding_day_3',
            'onboarding_day_7',
            'onboarding_day_14',
            'onboarding_day_30'
        )
    ) ranked
    WHERE rn > 1
);

-- 2. Prevent new duplicates. Partial unique index so other alert types
--    (incoming_dm, weekly_checkin, plateau_reassess) which legitimately
--    repeat over time are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coach_alerts_onboarding_milestone
ON public.coach_alerts (coach_id, client_id, alert_type)
WHERE alert_type IN (
    'onboarding_welcome',
    'onboarding_day_3',
    'onboarding_day_7',
    'onboarding_day_14',
    'onboarding_day_30'
);
