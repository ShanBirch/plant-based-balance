-- A native reaction closes an exact reviewed turn; it is never an outbound message.
create or replace function public.workout_acknowledged_inbound_proof(p_thread uuid, p_source uuid, p_proof jsonb)
returns boolean language plpgsql stable set search_path to 'public','pg_temp' as $$
begin
 return coalesce(
 p_proof @> '{"classification":"acknowledged_closed","native_identity_verified":true,"full_thread_reviewed":true,"native_reaction_verified":true,"reaction_suitable":true,"no_open_turn":true,"no_repeat":true}'
 and p_proof->>'source_message_id'=p_source::text
 and p_proof->>'thread_id'=p_thread::text
 and nullif(trim(p_proof->>'reviewed_by'),'') is not null
 and nullif(trim(p_proof->>'native_evidence'),'') is not null
 and nullif(trim(p_proof->>'reaction'),'') is not null
 and exists(select 1 from ig_messages m where m.id=p_source and m.thread_id=p_thread and m.direction='in'
   and m.text=p_proof->>'source_text'
   and (p_proof->>'reviewed_at')::timestamptz between m.created_at and now()+interval '30 seconds'
   and not exists(select 1 from ig_messages newer where newer.thread_id=p_thread and (newer.created_at,newer.id)>(m.created_at,m.id)))
 ,false);
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;
revoke all on function public.workout_acknowledged_inbound_proof(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.workout_acknowledged_inbound_proof(uuid,uuid,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.prepare_workout_accountability(p_event_id uuid, p_final_text text, p_expected_message_id uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v workout_accountability_events; e workout_accountability; t ig_threads; a ig_next_actions; latest uuid; closed_action ig_next_actions; closure jsonb;
begin
 select * into v from workout_accountability_events where id=p_event_id for update;
 select * into e from workout_accountability where id=v.enrollment_id;
 if v.status is distinct from 'pending' or not workout_accountability_allowed(e.id) or v.enrollment_version<>e.version
 or not workout_accountability_phase_eligible(v.id) or v.attempted_at is not null
 or now()<v.due_at or now()>v.expires_at then raise exception 'Reminder not eligible'; end if;
 if p_final_text is null or length(trim(p_final_text)) not between 1 and 500
 or not coalesce(p_review @> '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true}',false)
 then raise exception 'Fresh complete native review required'; end if;
 select * into t from ig_threads where id=e.thread_id for update;
 -- Serialize against the shared recipient queue and never replace a healthy owner.
 perform 1 from ig_next_actions where thread_id=t.id for update;
 select id into latest from ig_messages where thread_id=t.id order by created_at desc,id desc limit 1;
 if latest is null or latest is distinct from p_expected_message_id then raise exception 'Latest conversation changed'; end if;
 if exists(select 1 from ig_messages where id=latest and direction='in') then
  closure:=p_review->'acknowledged_inbound';
  if not workout_acknowledged_inbound_proof(t.id,latest,closure) then raise exception 'Answer fresh inbound first'; end if;
  -- Only retire the exact unattempted ready reply covered by this closure.
  select * into closed_action from ig_next_actions where thread_id=t.id and status='ready'
   and action_type='reply_inbound' and owner='dm_manager' and source_message_id=latest
   and claim_token is null and claim_owner is null and claim_run_id is null and claim_expires_at is null
   and coalesce(receipt,'{}')='{}'
   and id::text=closure->>'action_id' and action_version::text=closure->>'action_version'
   and not exists(select 1 from workout_accountability_events other
     where other.action_id=ig_next_actions.id and other.action_version=ig_next_actions.action_version
     and (other.status in ('queued','reserved','uncertain','sent') or other.attempted_at is not null))
   and not exists(select 1 from ig_next_action_receipts r where r.action_id=ig_next_actions.id
     and r.action_version=ig_next_actions.action_version);
  if exists(select 1 from ig_next_actions q where q.thread_id=t.id and q.id is distinct from closed_action.id
   and (q.status in ('ready','waiting','needs_you','blocked','claimed') or (q.status='cooldown' and q.safe_after>now())))
  then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
  if closed_action.id is not null then
   update ig_next_actions set status='completed',completed_at=now(),
    receipt=jsonb_build_object('result','acknowledged_closed','source_message_id',latest,
      'outbound_attempted',false,'no_repeat',true,'acknowledged_inbound',closure)
    where id=closed_action.id;
  elsif not exists(select 1 from ig_next_actions q where q.thread_id=t.id and q.status='completed'
    and q.action_type='reply_inbound' and q.source_message_id=latest
    and q.id::text=closure->>'action_id' and q.action_version::text=closure->>'action_version'
    and q.receipt->>'result'='acknowledged_closed'
    and workout_acknowledged_inbound_proof(t.id,latest,q.receipt->'acknowledged_inbound')) then
   return jsonb_build_object('queued',false,'reason','existing_action_owns_thread');
  end if;
 end if;
 if (v.kind='logged') is distinct from workout_accountability_logged(v.id) then raise exception 'Workout evidence changed'; end if;
 if exists(select 1 from ig_next_actions where thread_id=t.id and (status in ('ready','waiting','needs_you','blocked','claimed')
 or (status='cooldown' and safe_after>now()))) then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 a:=upsert_ig_next_action(p_thread_id=>t.id,p_ig_username=>t.ig_username,p_lead_state=>'existing_client',p_owner=>'manual',p_action_type=>'reactivation',
 p_priority=>650,p_due_at=>now(),p_reason=>jsonb_build_object('policy','workout_accountability_v1','event_id',v.id,'is_dm',true,
 'cooldown_scope','dm','final_text',p_final_text,'review',p_review,'expected_latest_message_id',latest,'acknowledged_inbound',closure),p_supersede=>false);
 if a.reason->>'event_id' is distinct from v.id::text then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 update workout_accountability_events set status='queued',action_id=a.id,action_version=a.action_version,expected_message_id=latest,
 receipt=receipt||jsonb_build_object('final_text',p_final_text,'prepared_at',now()) where id=v.id;
 return jsonb_build_object('queued',true,'action',to_jsonb(a));
end;
$function$;

CREATE OR REPLACE FUNCTION public.ig_workout_accountability_action_eligible(a ig_next_actions)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v workout_accountability_events; e workout_accountability; latest uuid;
begin
 if a.owner<>'manual' or a.action_type<>'reactivation' or a.reason->>'policy' is distinct from 'workout_accountability_v1' then return false; end if;
 select * into v from workout_accountability_events where id=(a.reason->>'event_id')::uuid;
 select * into e from workout_accountability where id=v.enrollment_id;
 if v.id is null or e.id is null or a.thread_id<>e.thread_id or a.id is distinct from v.action_id or a.action_version is distinct from v.action_version
 or v.status not in ('queued','reserved') or not workout_accountability_phase_eligible(v.id) or v.enrollment_version<>e.version or not workout_accountability_allowed(e.id)
 or now()<v.due_at or now()>v.expires_at then return false; end if;
 if v.status='reserved' and v.claim_token is distinct from a.claim_token then return false; end if;
 select id into latest from ig_messages where thread_id=e.thread_id order by created_at desc,id desc limit 1;
 if latest is null or latest is distinct from v.expected_message_id then return false; end if;
 if exists(select 1 from ig_messages where id=latest and direction='in') then
  if not workout_acknowledged_inbound_proof(e.thread_id,latest,a.reason->'acknowledged_inbound')
   or not exists(select 1 from ig_next_action_receipts r where r.thread_id=e.thread_id
    and r.action_id::text=a.reason->'acknowledged_inbound'->>'action_id'
    and r.action_version::text=a.reason->'acknowledged_inbound'->>'action_version'
    and r.terminal_status='completed' and r.receipt->>'result'='acknowledged_closed'
    and r.receipt->>'source_message_id'=latest::text
    and r.receipt->'acknowledged_inbound'=a.reason->'acknowledged_inbound')
  then return false; end if;
 end if;
 if v.kind='logged' then return workout_accountability_logged(v.id); end if;
 return not workout_accountability_logged(v.id);
exception when invalid_text_representation then return false;
end;
$function$;

