-- Change only the unanswered-inbound review predicate; preserve concurrent guard repairs.
DO $migration$
DECLARE fn text := pg_get_functiondef('public.claim_ig_story_action(uuid,integer,text,text,text,text,text,integer)'::regprocedure);
BEGIN
 IF position('conversation_review,sourceMessageIds' in fn)=0 THEN
  fn := replace(fn,$old$WHERE reviewed.receipt->>'source_message_id'=mi.id::text
  AND reviewed.completed_at>=mi.created_at$old$,$new$WHERE (reviewed.receipt->>'source_message_id'=mi.id::text
    OR (jsonb_typeof(reviewed.receipt#>'{conversation_review,sourceMessageIds}')='array'
        AND (reviewed.receipt#>'{conversation_review,sourceMessageIds}') ? mi.id::text))
  AND reviewed.completed_at>=mi.created_at$new$);
 END IF;
 IF position('AND mi.created_at>greatest' in fn)=0 THEN
  fn := replace(fn,$old$AND mi.created_at>coalesce(v_latest_attempt,'-infinity'::timestamptz)
 AND mi.created_at<=now()$old$,$new$AND mi.created_at>greatest(coalesce(v_latest_attempt,'-infinity'::timestamptz),
   coalesce((SELECT max(mo.created_at) FROM public.ig_messages mo
     WHERE mo.thread_id=ANY(v_alias_threads) AND mo.direction='out' AND mo.created_at<=now()),'-infinity'::timestamptz))
 AND mi.created_at<=now()$new$);
 END IF;
 IF position('conversation_review,sourceMessageIds' in fn)=0 OR position('AND mi.created_at>greatest' in fn)=0 THEN
  RAISE EXCEPTION 'Story review guard shape changed; review before migration';
 END IF;
 EXECUTE fn;
END $migration$;
