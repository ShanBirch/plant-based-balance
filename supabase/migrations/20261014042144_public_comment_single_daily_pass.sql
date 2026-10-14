-- A scheduled wake is one bounded discovery pass, never an automatic same-day
-- restart after an interruption or shortfall. History is retained permanently.
CREATE UNIQUE INDEX ig_public_comment_one_daily_pass
 ON public.ig_public_comment_runs(((started_at AT TIME ZONE 'Australia/Brisbane')::date))
 WHERE mode='daily';
