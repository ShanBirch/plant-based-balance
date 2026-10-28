-- Planning only: viewer and returning-experiment signals never grant send eligibility.
create function public.balance_story_relationship_priority(p_limit integer default 50)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
with viewers as (
 select lower(viewer_username) username,max(observed_at) last_viewed_at,
 count(distinct story_id) stories_viewed,
 count(distinct story_id) filter(where viewer_data->>'story_liked'='true') stories_liked,
 array_agg(distinct snapshot_id) snapshot_ids
 from ig_story_viewer_observations where ig_account='shan_n_sunny'
 and observed_at>now()-interval '7 days' group by lower(viewer_username)
), waiting as (
 select lower(t.ig_username) username,a.variant,a.target_conversation,
 (select count(*) from balance_challenge_timing_conversations c where c.assignment_id=a.id) conversation_number,
 (select max(o.created_at) from ig_messages o where o.thread_id=a.thread_id and o.direction='out'
 and (o.text ilike 'replied to their story%' or exists(select 1 from balance_challenge_timing_conversations c
 where c.assignment_id=a.id and coalesce(c.review->>'opener_message_id',c.review->>'story_opener_message_id')=o.id::text))) last_outreach_at
 from balance_challenge_timing_assignments a join ig_threads t on t.id=a.thread_id
 join balance_challenge_timing_experiments e on e.id=a.experiment_id and e.enabled
 where a.experiment_id='pre_christmas_timing_20261028' and a.variant in ('B','C')
 and not exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and v.kind in ('invited','declined'))
 and (select count(*) from balance_challenge_timing_conversations c where c.assignment_id=a.id)<a.target_conversation
), handles as(select username from viewers union select username from waiting), candidates as (
 select h.username,t.id thread_id,v.last_viewed_at,coalesce(v.stories_viewed,0) stories_viewed,
 coalesce(v.stories_liked,0) stories_liked,v.snapshot_ids,w.variant,w.target_conversation,w.conversation_number,
 w.last_outreach_at,w.last_outreach_at+interval '24 hours' next_approach_at,
 (w.username is not null) awaiting_next_conversation,
 case when v.username is not null and w.username is not null then 0 when v.username is not null then 1 else 2 end priority,
 (t.id is null) identity_review_required,
 case when t.id is null then null
 when t.linked_user_id is not null
 or exists(select 1 from ig_personal_contacts p where lower(p.ig_username)=h.username)
 or exists(select 1 from jsonb_each(coalesce(t.custom_data,'{}')) f where f.key in
 ('manual_only','manual_review_only','friend_manual_only','codex_ai_opt_out','ai_automation_opt_out','do_not_follow_up',
 'blocked_by_shannon','human_takeover','personal_outreach','needs_shannon','safety_hold','authenticity_hold',
 'permanent_needs_you_draft_only','no_ai_send','no_ai_schedule','do_not_auto_send')
 and (f.value='true'::jsonb or f.value->>'enabled'='true')) then 'protected_or_client'
 when exists(select 1 from balance_free_starters s where s.thread_id=t.id)
 or exists(select 1 from balance_free_coaching_jobs j where j.thread_id=t.id) then 'existing_agreement'
 when exists(select 1 from ig_next_actions a where lower(a.ig_username)=h.username
 and a.owner<>'story_operator' and a.status in ('claimed','ready','waiting','needs_you')) then 'pending_other_owner'
 else null end planning_hold,
 false as send_clearance
 from handles h left join viewers v using(username) left join waiting w using(username)
 left join lateral(select * from ig_threads where channel='instagram' and lower(ig_username)=h.username order by updated_at desc,id limit 1)t on true
 where h.username ~ '^[a-z0-9_.]{1,30}$'
), ranked as (
 select c.*,row_number() over(partition by (priority=2) order by (planning_hold is not null),priority,stories_liked desc,stories_viewed desc,last_viewed_at desc nulls last,username) selection_rank from candidates c
), selected as (
 select * from ranked where selection_rank<=greatest(1,least(coalesce(p_limit,50),500))
) select jsonb_build_object('account','shan_n_sunny','observed_at',now(),
 'latest_viewer_snapshot_at',(select max(observed_at) from ig_story_viewer_snapshots where ig_account='shan_n_sunny'),
 'viewer_collection_due',coalesce((select (max(observed_at) at time zone 'Australia/Brisbane')::date<(now() at time zone 'Australia/Brisbane')::date from ig_story_viewer_snapshots where ig_account='shan_n_sunny' and is_complete),true),
 'candidate_count',(select count(*) from candidates),
 'candidates',coalesce((select jsonb_agg(to_jsonb(s)-'selection_rank' order by (planning_hold is not null),priority,stories_liked desc,stories_viewed desc,last_viewed_at desc nulls last,username) from selected s),'[]'::jsonb),
 'planning_only',true,'warning','Refresh full native/canonical identity, holds, response/decline history, current Story and all exact send gates. No viewer or experiment signal is consent.')
$$;
revoke all on function public.balance_story_relationship_priority(integer) from public,anon,authenticated;
grant execute on function public.balance_story_relationship_priority(integer) to service_role;
