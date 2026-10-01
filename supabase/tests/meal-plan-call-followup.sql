-- Run inside BEGIN/ROLLBACK. Synthetic records are never visible to senders.
DO $$
DECLARE tid uuid:=gen_random_uuid(); src uuid:=gen_random_uuid(); cid uuid;
 result jsonb; key text; a public.ig_next_actions%ROWTYPE;
BEGIN
 SELECT coach_id INTO cid FROM public.ig_threads WHERE coach_id IS NOT NULL LIMIT 1;
 INSERT INTO public.ig_threads(id,subscriber_id,coach_id,ig_username,profile_name,channel,lead_stage,custom_data)
 VALUES(tid,'meal-plan-rollback-'||tid,cid,'meal_plan_rollback_'||replace(tid::text,'-',''),
 'Rollback test','instagram','new','{}');
 INSERT INTO public.ig_messages(id,thread_id,direction,text,created_at,source)
 VALUES(src,tid,'out','https://plantbased-balance.org/book?source=plant_based_challenge',now()-interval '23 hours','rollback_test');
 result:=public.register_ig_meal_plan_followup(tid,src);
 IF result->>'registered'<>'true' THEN RAISE EXCEPTION 'valid invitation not registered: %',result; END IF;
 result:=public.register_ig_meal_plan_followup(tid,src);
 IF result->>'registered'<>'false' THEN RAISE EXCEPTION 'duplicate invitation registered'; END IF;
 key:=public.ig_meal_plan_person_key(tid);
 INSERT INTO public.ig_next_actions(subject_key,thread_id,owner,action_type,status,source_message_id,reason)
 VALUES(public.ig_next_action_subject_key(tid,NULL),tid,'dm_manager','close_sale','ready',src,
 '{"policy":"meal_plan_call_followup_v1"}') RETURNING * INTO a;
 UPDATE public.ig_meal_plan_followups SET action_id=a.id WHERE person_key=key;
 IF public.ig_meal_plan_action_eligible(a.id) THEN RAISE EXCEPTION '23h gift became eligible'; END IF;
 UPDATE public.ig_meal_plan_followups SET due_at=now()-interval '1 second' WHERE person_key=key;
 IF NOT public.ig_meal_plan_action_eligible(a.id) THEN RAISE EXCEPTION 'due gift not eligible'; END IF;
 UPDATE public.ig_threads SET custom_data='{"manual_takeover":true}' WHERE id=tid;
 IF public.ig_meal_plan_action_eligible(a.id) THEN RAISE EXCEPTION 'manual takeover bypass'; END IF;
 UPDATE public.ig_threads SET custom_data='{"do_not_follow_up":true}' WHERE id=tid;
 IF public.ig_meal_plan_action_eligible(a.id) THEN RAISE EXCEPTION 'opt-out bypass'; END IF;
 UPDATE public.ig_threads SET custom_data='{}',lead_stage='paying' WHERE id=tid;
 IF public.ig_meal_plan_action_eligible(a.id) THEN RAISE EXCEPTION 'paid client bypass'; END IF;
 UPDATE public.ig_threads SET lead_stage='new' WHERE id=tid;
 INSERT INTO public.balance_bookings(starts_at,ends_at,status,name,email,metadata)
 VALUES(now()+interval '100 days',now()+interval '100 days 1 hour','confirmed','Rollback test',
 'rollback-test@example.invalid',jsonb_build_object('ig_thread_id',tid));
 IF public.ig_meal_plan_action_eligible(a.id) THEN RAISE EXCEPTION 'booking bypass'; END IF;
 DELETE FROM public.balance_bookings WHERE metadata->>'ig_thread_id'=tid::text;
 INSERT INTO public.ig_messages(thread_id,direction,text,source) VALUES(tid,'out','Newer conversation turn','rollback_test');
 IF public.ig_meal_plan_action_eligible(a.id) THEN RAISE EXCEPTION 'newer turn bypass'; END IF;
 DELETE FROM public.ig_messages WHERE thread_id=tid AND id<>src;
 UPDATE public.ig_meal_plan_followups SET status='uncertain' WHERE person_key=key;
 IF public.ig_meal_plan_action_eligible(a.id) THEN RAISE EXCEPTION 'uncertain send retried'; END IF;
 UPDATE public.ig_meal_plan_followups SET status='reserved',reserved_claim_token=gen_random_uuid(),reserved_run_id='old_run' WHERE person_key=key;
 IF public.ig_meal_plan_action_eligible(a.id) THEN RAISE EXCEPTION 'reservation stolen'; END IF;
 UPDATE public.ig_meal_plan_followups SET status='waiting' WHERE person_key=key;
 UPDATE public.ig_messages SET text='We can call this a good start' WHERE id=src;
 DELETE FROM public.ig_meal_plan_followups WHERE person_key=key;
 result:=public.register_ig_meal_plan_followup(tid,src);
 IF result->>'registered'<>'false' THEN RAISE EXCEPTION 'unreviewed call keyword registered'; END IF;
 IF public.reserve_ig_meal_plan_offer(a.id,gen_random_uuid(),'missing_run','{}') THEN
 RAISE EXCEPTION 'missing claim/lease/review reserved'; END IF;
 IF has_function_privilege('anon','public.refresh_ig_meal_plan_followups(integer)','execute')
 OR has_table_privilege('authenticated','public.ig_meal_plan_followups','select')
 THEN RAISE EXCEPTION 'public permissions leak'; END IF;
END $$;
SELECT 'passed: delay, due, dedup, manual, opt-out, paid, booking, fresh turn, uncertainty, reservation, exact invitation, lease, privileges' AS verification;

