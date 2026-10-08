-- Add only the new lessons to the existing guarded completion catalog.
-- Eight questions per lesson matches the canonical Foundations completion RPC.
-- No member completions, XP, journey weeks or assignment settings are changed.
INSERT INTO public.learning_lesson_catalog
  (lesson_id, unit_id, module_id, game_count, is_foundations, active)
VALUES
  ('mind-0-1', 'mind-0', 'mind', 8, TRUE, TRUE),
  ('mind-0-2', 'mind-0', 'mind', 8, TRUE, TRUE),
  ('mind-0-3', 'mind-0', 'mind', 8, TRUE, TRUE),
  ('mind-0-4', 'mind-0', 'mind', 8, TRUE, TRUE)
ON CONFLICT (lesson_id) DO UPDATE
SET unit_id = EXCLUDED.unit_id, module_id = EXCLUDED.module_id,
    game_count = EXCLUDED.game_count, is_foundations = EXCLUDED.is_foundations,
    active = EXCLUDED.active, updated_at = NOW();
