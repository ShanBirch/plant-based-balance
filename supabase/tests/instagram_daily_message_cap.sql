-- No native sends or persistent test messages: every fixture is rolled back.
BEGIN;
DO $test$
DECLARE
    v_a uuid:=gen_random_uuid();
    v_b uuid:=gen_random_uuid();
    v_budget jsonb;
    v_used integer;
    v_day date;
    v_future timestamptz;
    v_done record;
    v_before integer;
BEGIN
    v_budget:=public.ig_daily_message_budget_status('shan_n_sunny');
    IF (v_budget->>'limit')::integer<>100 THEN RAISE EXCEPTION 'limit must be100'; END IF;
    IF v_budget->>'timezone'<>'Australia/Brisbane' THEN RAISE EXCEPTION 'timezone'; END IF;
    v_day:=(v_budget->>'local_day')::date;
    IF v_day<>(now() AT TIME ZONE 'Australia/Brisbane')::date THEN RAISE EXCEPTION 'local day'; END IF;
    v_future:=(v_budget->>'resets_at')::timestamptz;
    IF (public.ig_daily_message_budget_status('shan_n_sunny',v_future)->>'local_day')::date<>v_day+1
        THEN RAISE EXCEPTION 'midnight must start next Brisbane day'; END IF;

    -- Temporarily change only this uncommitted transaction's allowance to test the last slot.
    -- Other sessions keep seeing the actual100 limit; rollback restores all fixture state.
    PERFORM pg_advisory_xact_lock(hashtextextended('ig_daily_message_budget:shan_n_sunny:'||v_day::text,0));
    v_used:=(v_budget->>'used')::integer;
    UPDATE public.ig_daily_message_limits SET max_messages=v_used+1 WHERE account='shan_n_sunny';
    IF NOT public.ig_reserve_daily_message_slot('shan_n_sunny',v_a,1,'daily-cap-rollback-test',NULL)
        THEN RAISE EXCEPTION 'last slot not allocated'; END IF;
    IF NOT public.ig_reserve_daily_message_slot('shan_n_sunny',v_a,1,'daily-cap-rollback-test',NULL)
        THEN RAISE EXCEPTION 'pre-Send recheck must reuse slot'; END IF;
    IF public.ig_reserve_daily_message_slot('shan_n_sunny',v_b,1,'daily-cap-rollback-test',NULL)
        THEN RAISE EXCEPTION 'second action exceeded shared cap'; END IF;
    IF public.ig_reserve_daily_message_slot('shan_n_sunny',v_a,1,'different-run',NULL)
        THEN RAISE EXCEPTION 'different run reused exact reservation'; END IF;
    v_budget:=public.ig_daily_message_budget_status('shan_n_sunny');
    IF (v_budget->>'used')::integer<>v_used+1 THEN RAISE EXCEPTION 'reservation counted twice'; END IF;
    IF NOT (v_budget->>'exhausted')::boolean THEN RAISE EXCEPTION 'last slot not exhausted'; END IF;

    -- A reconciled canonical delivery must not also consume a reservation slot.
    SELECT a.id,a.action_version,a.completed_at INTO v_done
    FROM public.ig_next_actions a
    WHERE a.status='completed' AND a.completed_at IS NOT NULL
      AND a.thread_id<>'77929dab-2ae2-4bd5-898d-cf0cae566023'
      AND EXISTS (
          SELECT 1 FROM public.ig_messages m JOIN public.ig_threads t ON t.id=m.thread_id
          WHERE m.id::text IN(a.receipt->>'canonical_outbound_message_id',a.receipt->>'canonical_message_id')
            AND m.direction='out' AND t.custom_data->>'bot_account'='shan_n_sunny'
            AND (m.created_at AT TIME ZONE 'Australia/Brisbane')::date=v_day
      ) LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'missing verified receipt fixture'; END IF;
    v_before:=(public.ig_daily_message_budget_status('shan_n_sunny')->>'used')::integer;
    INSERT INTO public.ig_daily_message_reservations(account,local_day,action_id,action_version,run_id,reserved_at)
    VALUES('shan_n_sunny',v_day,v_done.id,v_done.action_version,'dedupe-rollback-test',v_done.completed_at-interval '1 second');
    IF (public.ig_daily_message_budget_status('shan_n_sunny')->>'used')::integer<>v_before
        THEN RAISE EXCEPTION 'verified delivery double counted'; END IF;
    IF has_function_privilege('anon','public.ig_daily_message_budget_status(text,timestamptz)','EXECUTE')
       OR has_function_privilege('authenticated','public.ig_reserve_daily_message_slot(text,uuid,integer,text,uuid)','EXECUTE')
        THEN RAISE EXCEPTION 'budget RPC exposed to client role'; END IF;

    -- An invalid lease/action must still fail before reserving any slot.
    IF public.ig_browser_action_owned('daily-cap-invalid-run','instagram','invalid-tab',
        v_b,1,gen_random_uuid(),NULL) THEN RAISE EXCEPTION 'ownership guard bypassed'; END IF;
END;
$test$;
ROLLBACK;
SELECT 'daily cap rollback checks passed' AS result;
