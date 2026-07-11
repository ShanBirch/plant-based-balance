-- Raise Tahlia's seeded daily XP range for future daily plans.
UPDATE private.seed_xp_automation_rules
SET daily_min_xp = 60,
    daily_max_xp = 120,
    updated_at = NOW()
WHERE rule_key = 'tahlia_brooks_xp_autopilot';
