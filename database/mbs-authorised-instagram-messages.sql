-- Explicit human requests use the existing sole MBS sender, including linked
-- Instagram clients. A new request is not a retry of an already delivered turn.
create or replace function public.ig_mbs_instagram_requested_message_eligible(a public.ig_next_actions)
returns boolean language plpgsql stable security invoker
set search_path=public,pg_temp as $gate$
declare t public.ig_threads; issued timestamptz; expires timestamptz;
begin
 if a.owner is distinct from 'manual' or a.action_type is distinct from 'reactivation'
 or a.reason->>'policy' is distinct from 'user_requested_checkin_v1'
 or a.reason->>'explicit_user_authorization' is distinct from 'true'
 or coalesce(length(btrim(a.reason->>'authorization_request_id')),0)=0
 or coalesce(length(btrim(a.reason->>'authorization_evidence_ref')),0)=0
 or coalesce(length(btrim(a.reason->>'final_text')),0) not between 1 and 500
 or a.reason->>'full_thread_reviewed' is distinct from 'true'
 or a.reason->>'native_identity_verified' is distinct from 'true'
 or a.reason->>'independent_holds_checked' is distinct from 'true'
 or a.reason->>'page_id' is distinct from '561122130919678'
 or a.reason->>'native_account' is distinct from 'shan_n_sunny'
 or coalesce(a.reason->>'native_conversation_id','') !~ '^[0-9]{5,50}$'
 then return false; end if;
 issued:=(a.reason->>'authorization_issued_at')::timestamptz;
 expires:=(a.reason->>'authorization_expires_at')::timestamptz;
 if issued is null or expires is null or issued>now() or issued<now()-interval '24 hours'
 or expires<=now() or expires>issued+interval '24 hours' then return false; end if;
 select * into t from ig_threads where id=a.thread_id and lower(ig_username)=lower(a.ig_username);
 if not found or t.channel<>'instagram' or nullif(t.subscriber_id,'') is null
 or t.custom_data->>'bot_account' is distinct from 'shan_n_sunny' then return false; end if;
 -- A linked client is not itself a hold on a specifically requested message.
 -- Holds on any known alias still block, including linked-user aliases.
 if exists(select 1 from ig_threads x where
 (x.id=t.id or lower(x.ig_username)=lower(t.ig_username)
 or (t.linked_user_id is not null and x.linked_user_id=t.linked_user_id)) and
 (exists(select 1 from ig_personal_contacts p where lower(p.ig_username)=lower(x.ig_username))
 or x.custom_data->>'client_community_support_enabled'='false'
 or exists(select 1 from jsonb_each(coalesce(x.custom_data,'{}')) f where
 f.key in ('manual_only','manual_review_only','friend_manual_only','codex_ai_opt_out','ai_automation_opt_out',
 'do_not_follow_up','blocked_by_shannon','human_takeover','personal_outreach') and f.value='true'::jsonb)))
 then return false; end if;
 if a.source_message_id is null or a.reason->>'expected_latest_message_id' is distinct from a.source_message_id::text
 or not exists(select 1 from ig_messages where id=a.source_message_id and thread_id=t.id)
 or a.reason->>'expected_latest_message_id' is distinct from
 (select m.id::text from ig_messages m join ig_threads x on x.id=m.thread_id
 where x.id=t.id or lower(x.ig_username)=lower(t.ig_username)
 or (t.linked_user_id is not null and x.linked_user_id=t.linked_user_id)
 order by m.created_at desc,m.id desc limit 1) then return false; end if;
 if a.receipt->>'no_repeat'='true' or a.receipt->>'outbound_attempted'='true'
 or a.receipt->>'uncertain'='true' then return false; end if;
 -- Request identity survives action supersession in the existing receipt ledger.
 if exists(select 1 from ig_next_actions x where x.id is distinct from a.id
 and x.reason->>'authorization_request_id'=a.reason->>'authorization_request_id'
 and (x.receipt->>'no_repeat'='true' or x.receipt->>'outbound_attempted'='true' or x.receipt->>'uncertain'='true'))
 or exists(select 1 from ig_next_action_receipts h where
 h.receipt->>'authorization_request_id'=a.reason->>'authorization_request_id'
 and (h.receipt->>'no_repeat'='true' or h.receipt->>'outbound_attempted'='true' or h.receipt->>'uncertain'='true'))
 or exists(select 1 from ig_messages m where m.thread_id=t.id and m.direction='out'
 and m.created_at>=issued and m.text=a.reason->>'final_text') then return false; end if;
 return true;
exception when invalid_datetime_format or datetime_field_overflow then return false;
end $gate$;
revoke all on function public.ig_mbs_instagram_requested_message_eligible(public.ig_next_actions) from public,anon,authenticated;
grant execute on function public.ig_mbs_instagram_requested_message_eligible(public.ig_next_actions) to service_role;

-- Preserve the existing Messenger predicate and surface/claim functions exactly.
do $patch$
declare definition text; marker text:='BEGIN';
begin
 select pg_get_functiondef('public.ig_mbs_user_requested_checkin_eligible(public.ig_next_actions)'::regprocedure) into definition;
 if position('ig_mbs_instagram_requested_message_eligible' in definition)=0 then
  if position(marker in definition)=0 then raise exception 'MBS predicate changed'; end if;
  definition:=replace(definition,marker,marker||E'\n IF EXISTS(SELECT 1 FROM public.ig_threads WHERE id=a.thread_id AND channel=''instagram'') THEN\n RETURN public.ig_mbs_instagram_requested_message_eligible(a); END IF;');
  execute definition;
 end if;
 -- A requested message may legitimately follow our own last outbound. Only the
 -- exact reviewed manual action can reconcile such a source; reactive replies
 -- continue to require an inbound source. No new sender or fake inbound row.
 select pg_get_functiondef('public.persist_ig_native_delivery_receipt(uuid,integer,uuid,uuid,jsonb)'::regprocedure) into definition;
 marker:='AND direction = ''in'' AND created_at <= v_sent';
 if position('requested_message_outbound_source' in definition)=0 then
  if position(marker in definition)=0 then raise exception 'Native receipt predicate changed'; end if;
  definition:=replace(definition,marker,$replacement$AND (direction = 'in' OR (direction='out' AND EXISTS (
   SELECT 1 FROM public.ig_next_actions requested_message_outbound_source
   WHERE id=p_action_id AND action_version=p_version AND thread_id=p_thread_id
   AND source_message_id=v_source AND owner='manual' AND action_type='reactivation'
   AND reason->>'policy'='user_requested_checkin_v1'
   AND reason->>'explicit_user_authorization'='true'
   AND reason->>'expected_latest_message_id'=v_source::text
   AND reason->>'final_text'=p_receipt->>'delivered_text'
   AND reason->>'full_thread_reviewed'='true' AND reason->>'native_identity_verified'='true'
   AND reason->>'independent_holds_checked'='true'
   AND nullif(reason->>'authorization_evidence_ref','') IS NOT NULL
   AND (reason->>'authorization_issued_at')::timestamptz<=v_sent
   AND (reason->>'authorization_expires_at')::timestamptz>v_sent
  ))) AND created_at <= v_sent$replacement$);
  execute definition;
 end if;
end $patch$;
