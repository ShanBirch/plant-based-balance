-- Native Instagram collapses paragraph whitespace in canonical echoes.
-- Compare only whitespace-normalized text; preserve recipient, direction,
-- one-use reservation, token, source and attempt-time checks.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.record_free_coaching_ready(uuid,uuid,text,jsonb)'::regprocedure);
  original text := $match$(m.text=s.receipt->>'final_text' or m.text=replace(replace(s.receipt->>'final_text', E'\r\n', ' '), E'\n', ' '))$match$;
  replacement text := $match$(regexp_replace(m.text, '\s+', ' ', 'g')=regexp_replace(s.receipt->>'final_text', '\s+', ' ', 'g'))$match$;
BEGIN
  IF position(replacement in definition)>0 THEN RETURN; END IF;
  IF position(original in definition)=0 THEN
    RAISE EXCEPTION 'Unexpected coaching ready receipt definition; review before applying';
  END IF;
  EXECUTE replace(definition, original, replacement);
END;
$migration$;
