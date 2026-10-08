-- New lesson two: preserve every existing completion and guarded quiz format.
INSERT INTO public.learning_lesson_catalog
  (lesson_id, unit_id, module_id, game_count, is_foundations, active)
VALUES ('mind-0-5', 'mind-0', 'mind', 8, TRUE, TRUE)
ON CONFLICT (lesson_id) DO UPDATE
SET unit_id = EXCLUDED.unit_id, module_id = EXCLUDED.module_id,
    game_count = EXCLUDED.game_count, is_foundations = EXCLUDED.is_foundations,
    active = EXCLUDED.active, updated_at = NOW();
