-- Native Meta text entry may flatten LF/CRLF into one space in its echo.
-- Accept only that exact transport transformation; retain every other guard.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.record_free_coaching_ready(uuid,uuid,text,jsonb)'::regprocedure);
  original text := 'm.text=s.receipt->>''final_text''';
  replacement text := $match$(m.text=s.receipt->>'final_text' or m.text=replace(replace(s.receipt->>'final_text', E'\r\n', ' '), E'\n', ' '))$match$;
BEGIN
  IF position(replacement in definition)>0 THEN RETURN; END IF;
  IF position(original in definition)=0 THEN
    RAISE EXCEPTION 'Unexpected coaching ready receipt definition; review before applying';
  END IF;
  EXECUTE replace(definition, original, replacement);
END;
$migration$;
