-- Silent outreach spacing, measured from the latest proactive attempt.
create or replace function public.ig_story_silent_wait(unanswered integer)
returns interval language sql immutable set search_path = ''
as $$ select case when unanswered >= 3 then null::interval
when unanswered = 2 then interval '7 days'
when unanswered = 1 then interval '3 days'
else interval '24 hours' end $$;
revoke all on function public.ig_story_silent_wait(integer) from public, anon, authenticated;
grant execute on function public.ig_story_silent_wait(integer) to service_role;

do $migration$
declare definition text;
old_guard text := 'IF v_unanswered>=3 OR v_latest_attempt>now()-interval ''24 hours'' THEN RETURN; END IF;';
new_guard text := $guard$
IF v_unanswered>=3 OR v_latest_attempt>now()-public.ig_story_silent_wait(v_unanswered) THEN RETURN; END IF;
-- A new inbound of any type requires the sole responder's review first.
-- Emoji/media/voice do not silently reset the proactive budget.
IF EXISTS (
 SELECT 1 FROM public.ig_messages mi
 WHERE mi.thread_id=ANY(v_alias_threads) AND mi.direction='in'
 AND mi.created_at>coalesce(v_latest_attempt,'-infinity'::timestamptz)
 AND mi.created_at<=now()
 AND NOT EXISTS (
  SELECT 1 FROM (
   SELECT receipt,completed_at FROM public.ig_next_actions
   WHERE action_type='reply_inbound' AND status IN ('completed','cancelled')
   UNION ALL
   SELECT receipt,completed_at FROM public.ig_next_action_receipts
   WHERE action_type='reply_inbound' AND terminal_status IN ('completed','cancelled')
  ) reviewed
  WHERE reviewed.receipt->>'source_message_id'=mi.id::text
  AND reviewed.completed_at>=mi.created_at
 )
) THEN RETURN; END IF;
$guard$;
begin
 select pg_get_functiondef('public.claim_ig_story_action(uuid,integer,text,text,text,text,text,integer)'::regprocedure) into definition;
 if position(old_guard in definition)=0 then
  raise exception 'Expected Story contact guard missing; inspect before migration';
 end if;
 execute replace(definition,old_guard,new_guard);
end $migration$;

