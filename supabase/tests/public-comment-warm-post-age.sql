DO $test$ DECLARE d text; gate text := $gate$(
 (a.reason->>'post_published_at')::timestamptz > now()+interval '30 seconds'
 OR ((a.reason->>'post_published_at')::timestamptz < now()-interval '72 hours'
 AND NOT (
  coalesce(r.cursor->>'warm_only','')='true'
  AND coalesce(r.cursor->>'older_posts_allowed','')='true'
  AND coalesce(a.reason->>'older_post_authorization','')='shannon_20261024'
  AND nullif(btrim(a.reason->>'warm_audience_evidence'),'') IS NOT NULL
 )))$gate$; c record; rejected boolean; BEGIN
d:=pg_get_functiondef('public.claim_ig_public_comment(text,text,uuid,integer,text,text,text)'::regprocedure);
IF strpos(d,gate)=0 THEN RAISE EXCEPTION 'deployed gate differs'; END IF;
FOR c IN SELECT * FROM (VALUES
('old authorized warm',now()-interval '1 year','true','true','shannon_20261024','saved verified viewer evidence',false),
('old cold',now()-interval '1 year','false','true','shannon_20261024','saved verified viewer evidence',true),
('old missing evidence',now()-interval '1 year','true','true','shannon_20261024','',true),
('old missing authorization',now()-interval '1 year','true','true','','saved verified viewer evidence',true),
('future',now()+interval '1 day','true','true','shannon_20261024','saved verified viewer evidence',true),
('recent normal',now()-interval '1 day','false','false','','',false)
) AS cases(label,published,warm,older,auth_source,evidence,expected)
LOOP
EXECUTE 'select '||gate||' from (select $1::jsonb as reason) a cross join (select $2::jsonb as cursor) r'
INTO rejected USING jsonb_build_object('post_published_at',c.published,'older_post_authorization',c.auth_source,'warm_audience_evidence',c.evidence),jsonb_build_object('warm_only',c.warm,'older_posts_allowed',c.older);
IF rejected IS DISTINCT FROM c.expected THEN RAISE EXCEPTION 'failed %',c.label; END IF;
END LOOP;
END $test$; select 'six deployed age gate checks passed' as result;
