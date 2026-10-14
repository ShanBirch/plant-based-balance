-- Preserve exact user-authorised check-in eligibility while adding its MBS transport.
-- Reviewers remain read-only; only the existing owned dispatcher can claim/send.
CREATE OR REPLACE FUNCTION public.ig_mbs_review_followup_eligible(a public.ig_next_actions)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
SELECT coalesce(
  a.reason->>'review_contract' = 'twice_daily_conversation_review_v1'
  AND public.ig_user_requested_checkin_eligible(a)
  AND EXISTS (
    SELECT 1 FROM public.ig_threads t WHERE t.id=a.thread_id
      AND t.linked_user_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_each(coalesce(t.custom_data,'{}'::jsonb)) f
        WHERE f.key IN ('manual_only','manual_review_only','friend_manual_only',
          'codex_ai_opt_out','ai_automation_opt_out','do_not_follow_up',
          'blocked_by_shannon','human_takeover','personal_outreach')
          AND f.value='true'::jsonb
      )
  ), false);
$$;
DO $$
DECLARE
  d text;
  old_clause text;
  new_clause text;
BEGIN
  SELECT pg_get_functiondef('public.claim_ig_next_actions(text,integer,integer,text,uuid[])'::regprocedure) INTO d;
  old_clause := 'OR public.ig_mbs_free_zoom_invite_eligible(q)))';
  new_clause := 'OR public.ig_mbs_free_zoom_invite_eligible(q) OR public.ig_mbs_review_followup_eligible(q)))';
  IF position(old_clause IN d)=0 THEN RAISE EXCEPTION 'Unexpected claim function; review before changing'; END IF;
  EXECUTE replace(d,old_clause,new_clause);
  SELECT pg_get_functiondef('public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid)'::regprocedure) INTO d;
  old_clause := 'OR public.ig_mbs_free_zoom_invite_eligible(a)))';
  new_clause := 'OR public.ig_mbs_free_zoom_invite_eligible(a) OR public.ig_mbs_review_followup_eligible(a)))';
  IF position(old_clause IN d)=0 THEN RAISE EXCEPTION 'Unexpected ownership function; review before changing'; END IF;
  EXECUTE replace(d,old_clause,new_clause);
END $$;
