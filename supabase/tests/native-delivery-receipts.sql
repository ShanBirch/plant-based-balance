BEGIN;
DO $$
DECLARE a public.ig_next_actions%ROWTYPE; v_id uuid; v_count bigint; v_after bigint; v_receipt jsonb;
BEGIN
 SELECT * INTO a FROM public.ig_next_actions
 WHERE receipt->>'canonical_delivery_provenance'='verified_native_receipt' ORDER BY created_at LIMIT 1;
 ASSERT a.id IS NOT NULL, 'expected a recovered verified receipt';
 SELECT count(*) INTO v_count FROM public.ig_messages WHERE thread_id=a.thread_id;
 v_id := public.persist_ig_native_delivery_receipt(a.id,a.action_version,a.thread_id,a.source_message_id,a.receipt);
 ASSERT v_id=(a.receipt->>'canonical_outbound_message_id')::uuid, 'reconciliation must reuse outbound';
 PERFORM public.persist_ig_native_delivery_receipt(a.id,a.action_version,a.thread_id,a.source_message_id,a.receipt);
 SELECT count(*) INTO v_after FROM public.ig_messages WHERE thread_id=a.thread_id;
 ASSERT v_after=v_count, 'repeated reconciliation duplicated a message';
 v_receipt := a.receipt || '{"native_verified":false}'::jsonb;
 ASSERT public.persist_ig_native_delivery_receipt(a.id,a.action_version,a.thread_id,a.source_message_id,v_receipt) IS NULL, 'unverified receipt logged';
 v_receipt := a.receipt - 'screenshot';
 ASSERT public.persist_ig_native_delivery_receipt(a.id,a.action_version,a.thread_id,a.source_message_id,v_receipt) IS NULL, 'missing proof logged';
 v_receipt := a.receipt || '{"source_message_id":"00000000-0000-0000-0000-000000000000"}'::jsonb;
 ASSERT public.persist_ig_native_delivery_receipt(a.id,a.action_version,a.thread_id,a.source_message_id,v_receipt) IS NULL, 'wrong source logged';
 v_receipt := a.receipt || '{"sent_at":"not-a-time"}'::jsonb;
 ASSERT public.persist_ig_native_delivery_receipt(a.id,a.action_version,a.thread_id,a.source_message_id,v_receipt) IS NULL, 'invalid time logged';
 v_receipt := a.receipt || '{"claim_run_id":"nonexistent-run"}'::jsonb;
 ASSERT public.persist_ig_native_delivery_receipt(a.id,a.action_version,a.thread_id,a.source_message_id,v_receipt) IS NULL, 'missing owned run logged';
 UPDATE public.ig_next_actions SET receipt=receipt WHERE id=a.id;
 SELECT count(*) INTO v_after FROM public.ig_messages WHERE thread_id=a.thread_id;
 ASSERT v_after=v_count, 'trigger duplicate';
 ASSERT NOT EXISTS (SELECT 1 FROM public.ig_messages WHERE id=v_id AND training_eligible), 'system reply mislabeled for training';
 DELETE FROM public.ig_messages WHERE id=v_id;
 UPDATE public.ig_next_actions SET receipt=receipt WHERE id=a.id;
 ASSERT EXISTS (SELECT 1 FROM public.ig_messages
   WHERE thread_id=a.thread_id AND source='codex_native_delivery_receipt'
     AND text=a.receipt->>'delivered_text'), 'trigger did not restore confirmed delivery';
 SELECT count(*) INTO v_after FROM public.ig_messages WHERE thread_id=a.thread_id;
 ASSERT v_after=v_count, 'trigger must restore exactly one delivery';
 ASSERT NOT has_function_privilege('anon','public.persist_ig_native_delivery_receipt(uuid,integer,uuid,uuid,jsonb)','execute'), 'public writer exposed';
END;
$$;
ROLLBACK;
SELECT 'native delivery regression checks passed' result;
