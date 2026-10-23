DO $migration$
DECLARE definition text; old_gate text := $old$(a.reason->>'post_published_at')::timestamptz NOT BETWEEN now()-interval '72 hours' AND now()+interval '30 seconds'$old$;
new_gate text := $new$(
 (a.reason->>'post_published_at')::timestamptz > now()+interval '30 seconds'
 OR ((a.reason->>'post_published_at')::timestamptz < now()-interval '72 hours'
 AND NOT (
  coalesce(r.cursor->>'warm_only','')='true'
  AND coalesce(r.cursor->>'older_posts_allowed','')='true'
  AND coalesce(a.reason->>'older_post_authorization','')='shannon_20261024'
  AND nullif(btrim(a.reason->>'warm_audience_evidence'),'') IS NOT NULL
 )))$new$;
BEGIN
 definition := pg_get_functiondef('public.claim_ig_public_comment(text,text,uuid,integer,text,text,text)'::regprocedure);
 IF strpos(definition,old_gate)=0 OR strpos(substr(definition,strpos(definition,old_gate)+length(old_gate)),old_gate)>0 THEN
 RAISE EXCEPTION 'Expected exactly one existing post age gate'; END IF;
 EXECUTE replace(definition,old_gate,new_gate);
END $migration$;
