-- Separate automated provenance: never impersonate a human coach.
alter table public.learn_action_reviews add column ai_review jsonb;
alter table public.learn_action_reviews drop constraint learn_action_reviews_check1;
alter table public.learn_action_reviews add constraint learn_action_reviews_completion_evidence check (
 status<>'completed' or (reviewed_at is not null and report_complete and
 (reviewed_by is not null or coalesce(ai_review->>'reviewer'='ai' and ai_review->>'complete'='true',false)))
);

create function public.apply_learn_action_ai_review(p_review uuid,p_revision integer,p_receipt uuid,p_decision jsonb)
returns public.learn_action_reviews language plpgsql security invoker set search_path=public,pg_temp as $$
declare rec public.learn_action_reviews; old_record jsonb; delivered jsonb; enrol public.learn_action_enrollments;
begin
 select e.* into enrol from public.learn_action_enrollments e join public.learn_action_reviews r on r.enrollment_id=e.id where r.id=p_review for update of e;
 if enrol.id is null or not enrol.active then raise exception 'Current enrollment required' using errcode='40001'; end if;
 select * into rec from public.learn_action_reviews where id=p_review for update;
 if rec.status in ('completed','legacy_completed') then return rec; end if;
 if p_revision is null or rec.revision<>p_revision then raise exception 'Evidence changed' using errcode='40001'; end if;
 select data->'response' into delivered from public.coach_alerts where id=p_receipt and client_id=rec.user_id;
 if delivered is null or jsonb_typeof(rec.report->'weekly_checkin') is distinct from 'object' or delivered->>'occurrence' is distinct from 'weekly'
  or delivered->'learn_action'->>'id' is distinct from rec.id::text
  or delivered->'learn_action'->>'enrollment_id' is distinct from rec.enrollment_id::text
  or delivered->'learn_action'->>'week' is distinct from rec.week::text
  or delivered->'learn_action'->>'revision' is distinct from rec.revision::text
  or not (delivered @> (rec.report->'weekly_checkin')) then
  raise exception 'Matching delivered check-in required' using errcode='42501';
 end if;
 if p_decision->>'reviewer' is distinct from 'ai' or p_decision->>'source_revision' is distinct from rec.revision::text
  or jsonb_typeof(p_decision->'complete') is distinct from 'boolean' then raise exception 'Invalid review decision'; end if;
 if (p_decision->>'complete')::boolean and (
  p_decision->>'action_discussed' is distinct from 'true' or coalesce((p_decision->>'confidence')::numeric,0)<0.9
  or jsonb_typeof(p_decision->'evidence') is distinct from 'array'
  or not exists(select 1 from jsonb_array_elements(p_decision->'evidence') q where q->>'source'='checkin' and length(q->>'quote')>=8)
 ) then raise exception 'Grounded check-in evidence required'; end if;
 old_record=to_jsonb(rec);
 rec.ai_review=p_decision||jsonb_build_object('receipt_id',p_receipt);
 rec.status=case when (p_decision->>'complete')::boolean then 'completed' else 'needs_information' end;
 rec.report_complete=(p_decision->>'complete')::boolean;
 rec.reviewed_by=null; rec.reviewed_at=now(); rec.review_note=left(p_decision->>'note',2000);
 rec.revision=rec.revision+1; rec.updated_at=now();
 update public.learn_action_reviews set status=rec.status,report_complete=rec.report_complete,ai_review=rec.ai_review,
 reviewed_by=null,reviewed_at=rec.reviewed_at,review_note=rec.review_note,revision=rec.revision,updated_at=rec.updated_at where id=rec.id;
 insert into public.learn_action_review_events(review_id,actor_id,operation,before_record,after_record)
 values(rec.id,null,'ai_evidence_review',old_record,to_jsonb(rec));
 return rec;
end $$;
revoke all on function public.apply_learn_action_ai_review(uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_learn_action_ai_review(uuid,integer,uuid,jsonb) to service_role;
