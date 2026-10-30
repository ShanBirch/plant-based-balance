-- Shannon30October2026: ask phone type; send only its matching store link.
-- Preserve all existing setup, source, ownership and one-use receipt gates.
CREATE OR REPLACE FUNCTION public.prepare_free_coaching_ready(p_setup_id uuid, p_final_text text, p_expected_message_id uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s balance_free_coaching_setups; t ig_threads; g balance_free_starters; latest uuid; a ig_next_actions;
begin
 select * into s from balance_free_coaching_setups where id=p_setup_id for update;

 if not exists(select 1 from balance_free_coaching_jobs where setup_id=s.id and status='prepared') then raise exception 'Separate worker verification is not complete'; end if;
 select * into t from ig_threads where id=s.thread_id;
 
 select * into g from balance_free_starters where id=s.grant_id;
 if s.id is null or s.notice_status is distinct from 'pending' or s.attempted_at is not null
 or g.revoked_at is not null or g.claim_before<=now() or not free_coaching_thread_allowed(t.id) then raise exception 'Setup notice is not eligible'; end if;
 if p_final_text is null or length(p_final_text) not between 1 and 500 or position(s.invitation_url in p_final_text)=0
 or (case coalesce(p_review->>'phone_platform','unknown')
 when 'ios' then position('https://apps.apple.com/app/balance-fitness-gamified/id6761238161' in p_final_text)=0
   or position('https://play.google.com/store/apps/details?id=com.fitgotchi.app' in p_final_text)>0
 when 'android' then position('https://play.google.com/store/apps/details?id=com.fitgotchi.app' in p_final_text)=0
   or position('https://apps.apple.com/app/balance-fitness-gamified/id6761238161' in p_final_text)>0
 else true end)
 or p_review->>'phone_platform_confirmed' is distinct from 'true'
 or not exists(select 1 from ig_messages phone_source
   where phone_source.id=nullif(p_review->>'phone_platform_source_message_id','')::uuid
     and phone_source.thread_id=t.id and phone_source.direction='in')
 or not coalesce(p_review @> '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true,"answers_latest_turn":true}',false)
 then raise exception 'Fresh native review and verified personal invitation required'; end if;
 select id into latest from ig_messages where thread_id=t.id order by created_at desc,id desc limit 1;
 if latest is null or latest is distinct from p_expected_message_id then raise exception 'Conversation changed'; end if;
 if exists(select 1 from ig_next_actions where thread_id=t.id and (status in ('ready','waiting','needs_you','blocked','claimed') or (status='cooldown' and safe_after>now()))) then
 return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 a:=upsert_ig_next_action(p_thread_id=>t.id,p_ig_username=>t.ig_username,p_lead_state=>'invited',p_owner=>'manual',p_action_type=>'reactivation',
 p_priority=>700,p_source_message_id=>latest,p_reason=>jsonb_build_object('policy','free_coaching_ready_v1','setup_id',s.id,'is_dm',true,'cooldown_scope','dm',
 'final_text',p_final_text,'expected_latest_message_id',latest,'review',p_review),p_supersede=>false);
 if a.reason->>'setup_id' is distinct from s.id::text then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 update balance_free_coaching_setups set notice_status='queued',action_id=a.id,action_version=a.action_version,expected_message_id=latest,
 receipt=receipt||jsonb_build_object('final_text',p_final_text,'prepared_at',now(),'notice_review',p_review) where id=s.id;
 return jsonb_build_object('queued',true,'action',to_jsonb(a));
end;
$function$
