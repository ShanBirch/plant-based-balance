-- Retire every remaining Tahlia-generated activity path while preserving her
-- existing account, posts, comments and XP as historical records.

UPDATE private.seed_xp_automation_rules
SET enabled = FALSE,
    updated_at = NOW()
WHERE rule_key = 'tahlia_brooks_xp_autopilot';

-- Close any unapplied awards so they cannot be released if the rule is ever
-- inspected or the worker is invoked manually.
UPDATE private.seed_xp_awards awards
SET skipped_reason = 'tahlia_wound_down',
    applied_at = NOW(),
    xp_amount = 0
FROM private.seed_xp_daily_plans plans
JOIN private.seed_xp_automation_rules rules ON rules.id = plans.rule_id
WHERE awards.plan_id = plans.id
  AND rules.rule_key = 'tahlia_brooks_xp_autopilot'
  AND awards.applied_at IS NULL;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'tahlia-brooks-xp-autopilot';

UPDATE public.coach_alerts
SET status = 'dismissed',
    actioned_at = COALESCE(actioned_at, NOW()),
    data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
        'dismiss_reason', 'tahlia_wound_down',
        'dismissed_at', NOW(),
        'operator_queue', 'retired',
        'needs_you_required', FALSE,
        'needs_shannon_approval', FALSE
    )
WHERE status = 'pending'
  AND (
      client_name = 'Tahlia Brooks'
      OR data->>'source' = 'tahlia-social-worker'
      OR data->>'subtype' = 'tahlia_social_approval'
      OR data->>'tahlia_profile_key' = 'tahlia_brooks'
  );
