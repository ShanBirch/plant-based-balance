-- Never make a delivered or uncertain campaign action eligible for a fresh claim.
DO $migration$
DECLARE d text; old text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT d FROM pg_proc
 WHERE pronamespace='public'::regnamespace AND proname='ig_mbs_free_zoom_invite_eligible';
 old := ' IF a.owner IS DISTINCT FROM ''manual''';
 IF position(old in d)=0 THEN RAISE EXCEPTION 'Unexpected campaign predicate'; END IF;
 EXECUTE replace(d,old,
 ' IF coalesce(a.receipt,''{}''::jsonb)<>''{}''::jsonb THEN RETURN false; END IF;' || chr(10) || old);
END $migration$;
