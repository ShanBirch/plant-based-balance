-- Copy review provenance into existing completion receipts so the ordinary
-- archive retains it when the single current action row is reused.
CREATE OR REPLACE FUNCTION public.capture_dm_decisions_review_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF NEW.owner = 'dm_manager' AND NEW.status = 'completed'
       AND jsonb_typeof(NEW.reason->'decisions_review') = 'object'
       AND NEW.reason->'decisions_review'->>'version' = 'dm_decisions_review_20261029_v1'
       AND NEW.reason->'decisions_review'->>'sourceMessageId' = NEW.source_message_id::text
       AND NEW.reason->'decisions_review'->>'threadId' = NEW.thread_id::text
       AND NEW.reason->'decisions_review'->>'sendAuthorized' = 'false' THEN
        NEW.receipt := coalesce(NEW.receipt,'{}'::jsonb) || jsonb_build_object(
            'decisions_review', NEW.reason->'decisions_review',
            'conversation_policy_version', NEW.reason->>'conversation_policy_version');
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_dm_decisions_review_receipt() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_dm_decisions_review_receipt() TO service_role;
DROP TRIGGER IF EXISTS trg_capture_dm_decisions_review_receipt ON public.ig_next_actions;
CREATE TRIGGER trg_capture_dm_decisions_review_receipt
BEFORE INSERT OR UPDATE OF status,receipt ON public.ig_next_actions
FOR EACH ROW EXECUTE FUNCTION public.capture_dm_decisions_review_receipt();
