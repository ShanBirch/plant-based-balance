-- Emoji reactions do not impose a human-review veto. Keep contact counters unchanged.
DO $migration$
DECLARE fn text := pg_get_functiondef('public.claim_ig_story_action(uuid,integer,text,text,text,text,text,integer)'::regprocedure);
BEGIN
 IF position('(attachment|photo|image|video|audio|voice|reaction)' in fn)=0 THEN
  fn := replace(fn,$old$WHERE mi.thread_id=ANY(v_alias_threads) AND mi.direction='in'
 AND mi.created_at>greatest$old$,$new$WHERE mi.thread_id=ANY(v_alias_threads) AND mi.direction='in'
 AND regexp_replace((CASE WHEN mi.text LIKE '%Raw IG message:%' THEN regexp_replace(mi.text,'^[\s\S]*Raw IG message:\s*','') ELSE mi.text END),'^replied to your story \(story media attached\)\s*','','i') ~ '[[:alpha:]]'
 AND regexp_replace((CASE WHEN mi.text LIKE '%Raw IG message:%' THEN regexp_replace(mi.text,'^[\s\S]*Raw IG message:\s*','') ELSE mi.text END),'^replied to your story \(story media attached\)\s*','','i') !~* '^\[(attachment|photo|image|video|audio|voice|reaction)\]'

 AND mi.created_at>greatest$new$);
 END IF;
 IF position('(attachment|photo|image|video|audio|voice|reaction)' in fn)=0 THEN
  RAISE EXCEPTION 'Story reaction guard shape changed; review before migration';
 END IF;
 EXECUTE fn;
END $migration$;
