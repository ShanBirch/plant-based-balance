-- Persist confirmed native sends even when Meta does not return a webhook echo.
-- This records delivery evidence only: it never sends or claims a conversation.
CREATE OR REPLACE FUNCTION public.persist_ig_native_delivery_receipt(
    p_action_id uuid, p_version integer, p_thread_id uuid,
    p_source_id uuid, p_receipt jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
    v_source uuid;
    v_sent timestamptz;
    v_message uuid;
    v_key text;
    v_channel text;
BEGIN
    IF p_receipt->>'native_verified' IS DISTINCT FROM 'true'
       OR p_receipt->>'no_repeat' IS DISTINCT FROM 'true'
       OR coalesce(p_receipt->>'result', p_receipt->>'outcome', '') <> 'sent_attribution_pending'
       OR nullif(p_receipt->>'delivered_text', '') IS NULL
       OR nullif(p_receipt->>'screenshot', '') IS NULL
       OR nullif(p_receipt->>'claim_run_id', '') IS NULL THEN
        RETURN NULL;
    END IF;
    BEGIN
        v_source := coalesce(nullif(p_receipt->>'source_message_id', '')::uuid, p_source_id);
        v_sent := (p_receipt->>'sent_at')::timestamptz;
    EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
        RETURN NULL;
    END;
    IF v_source IS NULL OR v_sent IS NULL OR v_sent > now() + interval '1 minute' THEN RETURN NULL; END IF;
    -- Serialize with another receipt writer, including repeated reconciliation.
    SELECT channel INTO v_channel FROM public.ig_threads WHERE id = p_thread_id FOR UPDATE;
    IF v_channel NOT IN ('instagram', 'messenger') OR v_channel IS NULL THEN RETURN NULL; END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.ig_messages
        WHERE id = v_source AND thread_id = p_thread_id AND direction = 'in' AND created_at <= v_sent
    ) OR NOT EXISTS (
        SELECT 1 FROM public.ig_browser_shift_runs
        WHERE run_id = p_receipt->>'claim_run_id' AND browser_surface = 'meta_business_suite'
          AND started_at <= v_sent
          AND v_sent <= coalesce(ended_at, now()) + interval '1 minute'
    ) THEN RETURN NULL; END IF;
    v_key := 'native-receipt:' || p_action_id || ':v' || p_version;
    SELECT id INTO v_message FROM public.ig_messages
    WHERE thread_id = p_thread_id AND direction = 'out'
      AND (manychat_message_id = v_key OR (
          text = p_receipt->>'delivered_text'
          AND created_at BETWEEN v_sent - interval '2 minutes' AND v_sent + interval '2 minutes'
      ))
    ORDER BY created_at LIMIT 1;
    IF v_message IS NULL THEN
        INSERT INTO public.ig_messages (
            thread_id, direction, text, manychat_message_id, source, created_at,
            author_type, delivery_origin, training_eligible, training_provenance
        ) VALUES (
            p_thread_id, 'out', p_receipt->>'delivered_text', v_key,
            'codex_native_delivery_receipt', v_sent, 'balance_system',
            'instagram_native_inbox', false, 'system_generated'
        ) RETURNING id INTO v_message;
    END IF;
    UPDATE public.ig_threads SET last_outbound_at = greatest(last_outbound_at, v_sent)
    WHERE id = p_thread_id AND (last_outbound_at IS NULL OR last_outbound_at < v_sent);
    RETURN v_message;
END;
$$;
REVOKE ALL ON FUNCTION public.persist_ig_native_delivery_receipt(uuid, integer, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_ig_native_delivery_receipt(uuid, integer, uuid, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_ig_native_delivery_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_message uuid;
BEGIN
    IF NEW.receipt->>'native_verified' IS DISTINCT FROM 'true'
       OR NEW.receipt->>'no_repeat' IS DISTINCT FROM 'true'
       OR coalesce(NEW.receipt->>'result', NEW.receipt->>'outcome', '') <> 'sent_attribution_pending' THEN RETURN NEW; END IF;
    v_message := public.persist_ig_native_delivery_receipt(
        NEW.id, NEW.action_version, NEW.thread_id, NEW.source_message_id, NEW.receipt
    );
    IF v_message IS NOT NULL THEN
        NEW.receipt := NEW.receipt || jsonb_build_object(
            'canonical_outbound_message_id', v_message,
            'canonical_delivery_provenance', 'verified_native_receipt',
            'canonical_reconciled_at', now()
        );
        -- A confirmed send is terminal, even when the caller requested waiting.
        IF NEW.status = 'waiting' AND NEW.claim_token IS NULL THEN NEW.status := 'completed'; END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_ig_native_delivery_receipt() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ig_native_delivery_receipt() TO service_role;
CREATE TRIGGER trg_sync_ig_native_delivery_receipt
BEFORE INSERT OR UPDATE OF receipt ON public.ig_next_actions
FOR EACH ROW EXECUTE FUNCTION public.sync_ig_native_delivery_receipt();

-- Recover archived versions first, so distinct earlier replies retain chronology.
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT * FROM public.ig_next_action_receipts
        WHERE receipt->>'native_verified' = 'true' AND receipt->>'no_repeat' = 'true'
          AND coalesce(receipt->>'result', receipt->>'outcome') = 'sent_attribution_pending'
        ORDER BY completed_at
    LOOP
        PERFORM public.persist_ig_native_delivery_receipt(
            r.action_id, r.action_version, r.thread_id, NULL, r.receipt
        );
    END LOOP;
END;
$$;
UPDATE public.ig_next_actions SET receipt = receipt
WHERE receipt->>'native_verified' = 'true' AND receipt->>'no_repeat' = 'true'
  AND coalesce(receipt->>'result', receipt->>'outcome') = 'sent_attribution_pending';
