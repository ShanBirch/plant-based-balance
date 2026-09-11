-- Read-only dispatcher intake. Run on EVERY wake before applying lane caches.
-- Cursor: paginate by thread_id, not by inbound time (quiet leads must remain).
-- Registration is membership, never permission to contact or proof of intent.
SELECT t.id AS thread_id, t.ig_username, t.profile_name, t.lead_stage,
       t.last_inbound_at, t.last_outbound_at,
       t.custom_data->'paid_lead_dispatch' AS registration,
       t.custom_data->'meta_ad_attribution' AS ad_attribution,
       t.qualifier, t.custom_data,
       q.owner AS action_owner, q.status AS action_status,
       q.action_type, q.due_at, q.safe_after,
       CASE
         WHEN t.linked_user_id IS NOT NULL OR t.lead_stage NOT IN ('new','qualifying','invited') THEN 'client_or_closed'
         WHEN lower(coalesce(t.custom_data->>'bot_account', t.custom_data->'instagram_graph'->>'bot_account','')) <> 'shan_n_sunny' THEN 'account_unresolved'
         WHEN nullif(trim(t.ig_username),'') IS NULL THEN 'username_unresolved'
         WHEN lower(t.ig_username) IN ('shan_n_sunny','cocos_pt_studio','goldcoast_ai_solutions','lara_lessmann','cavazzanafrancesca') THEN 'excluded_identity'
         WHEN EXISTS (
           SELECT 1 FROM unnest(ARRAY['manual_only','manual_review_only','friend_manual_only',
             'do_not_follow_up','blocked_by_shannon','opt_out','opted_out',
             'ai_automation_opt_out','codex_ai_opt_out']) AS flags(key)
           WHERE lower(coalesce(t.custom_data->>flags.key,'false'))='true'
         ) OR t.custom_data->>'client_community_support_enabled'='false' THEN 'suppressed'
         WHEN t.last_inbound_at IS NOT NULL AND
           (t.last_outbound_at IS NULL OR t.last_inbound_at > t.last_outbound_at) THEN 'conversation_first'
         WHEN q.status IN ('ready','waiting','claimed','needs_you','blocked') THEN 'owned_action'
         WHEN EXISTS (SELECT 1 FROM public.coach_alerts a
           WHERE a.status IN ('pending','scheduled') AND
             (a.data->>'thread_id'=t.id::text OR a.data->>'ig_thread_id'=t.id::text)) THEN 'pending_alert'
         ELSE 'review_for_nurture'
       END AS intake_disposition
FROM public.ig_threads t
LEFT JOIN public.ig_next_actions q ON q.thread_id=t.id
WHERE t.channel='instagram'
  -- A referral/click alone is not a lead. Require a saved human inbound.
  AND EXISTS (SELECT 1 FROM public.ig_messages m WHERE m.thread_id=t.id AND m.direction='in')
  AND (t.custom_data->'paid_lead_dispatch'->>'registered_at' IS NOT NULL
    OR upper(coalesce(t.custom_data->'meta_ad_attribution'->>'platform_source',''))='ADS'
    OR lower(coalesce(t.custom_data->'meta_ad_attribution'->>'source','')) IN ('meta_ads','meta_ad','instagram_ads','facebook_ads'))
  AND NOT EXISTS (SELECT 1 FROM unnest(ARRAY['internal_account','internal_test_auto_reply_enabled','is_test_account']) AS flags(key)
    WHERE lower(coalesce(t.custom_data->>flags.key,'false'))='true')
  AND nullif(t.custom_data->>'merged_into_thread_id','') IS NULL
  AND nullif(t.custom_data->>'merged_into_ig_thread_id','') IS NULL
ORDER BY t.id;
