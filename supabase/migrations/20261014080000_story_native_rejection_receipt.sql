-- A native Sent toast is not delivery proof. Save a full-reload rejection on
-- the immutable original reservation, even after inbound/lease supersession.
CREATE OR REPLACE FUNCTION public.record_ig_story_rejection(
 p_action_id uuid,p_action_version integer,p_original_claim_token uuid,
 p_original_run_id text,p_native_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h public.ig_next_action_receipts%ROWTYPE; r jsonb;
BEGIN
 SELECT * INTO h FROM public.ig_next_action_receipts
 WHERE action_id=p_action_id AND action_version=p_action_version FOR UPDATE;
 IF NOT FOUND OR h.action_type<>'story_reply'
  OR h.receipt->>'original_claim_token' IS DISTINCT FROM p_original_claim_token::text
  OR h.receipt->>'run_id' IS DISTINCT FROM p_original_run_id
  OR h.receipt->>'outbound_attempted' IS DISTINCT FROM 'true'
  OR h.receipt->>'target_credit'='1' THEN
  RAISE EXCEPTION 'original uncredited Story reservation required';
 END IF;
 IF p_native_proof->>'native_reloaded_verified' IS DISTINCT FROM 'true'
  OR p_native_proof->>'native_account' IS DISTINCT FROM 'shan_n_sunny'
  OR p_native_proof->>'ig_username' IS DISTINCT FROM h.ig_username
  OR p_native_proof->>'story_id' IS DISTINCT FROM h.receipt->>'story_id'
  OR p_native_proof->>'final_text' IS DISTINCT FROM h.receipt->>'final_text'
  OR nullif(trim(p_native_proof->>'native_rejection'),'') IS NULL
  OR nullif(trim(p_native_proof->>'native_screenshot'),'') IS NULL
  OR coalesce(p_native_proof->>'native_conversation_url','') !~ '^https://www.instagram.com/direct/t/[0-9]+/$' THEN
  RAISE EXCEPTION 'exact full-reload rejection proof required';
 END IF;
 r:=h.receipt||jsonb_build_object('native_status','rejected_native_full_reload',
  'native_verified',false,'native_reloaded_verified',true,
  'native_rejection',p_native_proof->>'native_rejection',
  'native_screenshot',p_native_proof->>'native_screenshot',
  'native_conversation_url',p_native_proof->>'native_conversation_url',
  'sent_observed_at',p_native_proof->>'sent_observed_at',
  'no_repeat',true,'target_credit',0,'reconciliation_required',false,
  'canonical_status','not_delivery_verified','delivery_outcome','native_rejected',
  'rejection_recorded_at',now());
 UPDATE public.ig_next_action_receipts SET terminal_status='blocked',receipt=r,completed_at=now()
 WHERE action_id=p_action_id AND action_version=p_action_version;
 -- Original receipt provenance, not a current lease, identifies bookkeeping.
 -- A newer version/recipient/inbound action is never modified.
 UPDATE public.ig_next_actions SET status='blocked',receipt=r,completed_at=now(),
  claim_owner=NULL,claim_token=NULL,claim_run_id=NULL,claim_expires_at=NULL
 WHERE id=p_action_id AND action_version=p_action_version AND action_type='story_reply'
  AND ig_username=h.ig_username
  AND receipt->>'original_claim_token'=p_original_claim_token::text
  AND receipt->>'run_id'=p_original_run_id;
 RETURN jsonb_build_object('recorded',true,'target_credit',0,'receipt',r);
END $$;
REVOKE ALL ON FUNCTION public.record_ig_story_rejection(uuid,integer,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_ig_story_rejection(uuid,integer,uuid,text,jsonb) TO service_role;
