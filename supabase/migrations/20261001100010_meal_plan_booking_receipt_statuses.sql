CREATE OR REPLACE FUNCTION public.ig_meal_plan_block_reason(p_thread_id uuid,p_source_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t public.ig_threads%ROWTYPE; m public.ig_messages%ROWTYPE; k text;
BEGIN
 SELECT * INTO t FROM public.ig_threads WHERE id=p_thread_id;
 IF NOT FOUND THEN RETURN 'missing_thread'; END IF;
 SELECT * INTO m FROM public.ig_messages WHERE id=p_source_id AND thread_id=t.id AND direction='out';
 IF NOT FOUND THEN RETURN 'missing_delivered_invitation'; END IF;
 IF t.channel NOT IN ('instagram','facebook','messenger','manychat_facebook','whatsapp','manychat_whatsapp')
 OR t.channel IS NULL THEN RETURN 'unsupported_channel'; END IF;
 IF t.linked_user_id IS NOT NULL OR t.lead_stage IN ('in_app','paying','churned','client','closed','not_now','declined')
 OR nullif(t.custom_data->>'linked_client_id','') IS NOT NULL
 OR nullif(t.custom_data->>'linked_user_id','') IS NOT NULL THEN RETURN 'client_or_closed'; END IF;
 FOREACH k IN ARRAY ARRAY['manual_only','manual_review_only','manual_takeover','manual_ig_required',
 'customer_service_manual_only','friend_manual_only','needs_you_always','needs_you_required',
 'permanent_needs_you','permanent_needs_you_draft_only','needs_you_permanent_person_override',
 'no_ai_send','no_ai_schedule','do_not_auto_send','do_not_follow_up','codex_ai_opt_out',
 'ai_automation_opt_out','operator_human_requested','auto_reply_paused_by_shannon',
 'auto_send_stopped','blocked_by_shannon','browser_hard_exclusion','known_client',
 'internal_account','fake_account','proactive_offer_followup_suppressed'] LOOP
  IF lower(coalesce(t.custom_data->>k,'false')) IN ('true','1','yes') THEN RETURN 'hold:'||k; END IF;
 END LOOP;
 IF nullif(t.custom_data->>'merged_into_thread_id','') IS NOT NULL
 OR nullif(t.custom_data->>'merged_into_ig_thread_id','') IS NOT NULL
 OR nullif(t.custom_data->>'automation_blocked_reason','') IS NOT NULL
 OR nullif(t.custom_data->>'operator_lock','') IS NOT NULL THEN RETURN 'ownership_or_merge_hold'; END IF;
 IF coalesce(t.custom_data->>'conversation_owner','') NOT IN ('','dm_manager','browser_dispatcher','codex_live_worker')
 THEN RETURN 'other_conversation_owner'; END IF;
 IF lower(coalesce(t.profile_name,'')) ~ '^(nat|shane minahan|arunima( sharma)?|dani minahan)$'
 THEN RETURN 'protected_person'; END IF;
 IF EXISTS(SELECT 1 FROM public.balance_bookings b WHERE b.status='confirmed' AND
 (b.metadata->>'ig_thread_id'=t.id::text
 OR (nullif(t.custom_data->>'email','') IS NOT NULL AND lower(b.email)=lower(t.custom_data->>'email'))
 OR (nullif(t.custom_data->>'phone','') IS NOT NULL AND
 regexp_replace(b.phone,'[^0-9]','','g')=regexp_replace(t.custom_data->>'phone','[^0-9]','','g'))))
 THEN RETURN 'already_booked'; END IF;
 IF EXISTS(SELECT 1 FROM public.growth_outcome_events e WHERE
 (e.ig_thread_id=t.id OR e.lead_key=public.ig_meal_plan_person_key(t.id))
 AND e.event_status IN ('confirmed','recorded','active','paid','completed') AND e.event_type IN ('call_booked','subscription_started','purchase','paid','founders_pass_purchased'))
 OR EXISTS(SELECT 1 FROM public.founders_pass_purchases p WHERE p.status='paid'
 AND nullif(t.custom_data->>'email','') IS NOT NULL AND lower(p.email)=lower(t.custom_data->>'email'))
 THEN RETURN 'booking_or_purchase_receipt'; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_messages newer WHERE newer.thread_id=t.id
 AND (newer.created_at,newer.id)>(m.created_at,m.id)) THEN RETURN 'conversation_changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_next_actions q WHERE q.thread_id=t.id AND
 (q.status IN ('needs_you','blocked') OR q.owner='manual')) THEN RETURN 'action_hold'; END IF;
 RETURN NULL;
END $$;
