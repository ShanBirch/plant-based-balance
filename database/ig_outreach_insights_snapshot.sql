with t as (
select id,lower(ig_username) handle,lead_stage,linked_user_id,custom_data,
coalesce(custom_data->>'outreach_relationship_kind',case when linked_user_id is not null or lead_stage in ('in_app','paying') then 'client' when custom_data->>'personal_contact'='true' then 'personal' else 'lead' end) kind
from ig_threads where channel='instagram' and nullif(ig_username,'') is not null
), identities as (
select handle,min(id::text) pid,array_agg(id) tids,
case when bool_or(kind='client') then 'client' when bool_or(kind='personal') then 'personal' else 'lead' end kind,
jsonb_build_object('linkedClient',bool_or(linked_user_id is not null or lead_stage in ('in_app','paying')),
'personal',bool_or(custom_data->>'personal_contact'='true' or kind='personal' or exists(select 1 from ig_personal_contacts pc where lower(pc.ig_username)=t.handle)),
'outreachExcluded',bool_or(custom_data->>'outreach_excluded'='true'),
'purchase',bool_or(custom_data#>>'{customer_lifecycle,purchase_id}' is not null),
'manual',bool_or(custom_data->>'manual_only'='true' or custom_data->>'manual_review_only'='true' or custom_data->>'friend_manual_only'='true' or custom_data->>'human_takeover'='true' or custom_data->>'blocked_by_shannon'='true'),
'optOut',bool_or(custom_data->>'opt_out'='true' or custom_data->>'opted_out'='true' or custom_data->>'do_not_contact'='true' or custom_data->>'do_not_follow_up'='true'),
'merged',bool_or(custom_data->>'merged_into_thread_id' is not null or custom_data->>'merged_into_ig_thread_id' is not null),
'formerClient',bool_or(custom_data->>'relationship_state' like 'former_client%' or lead_stage='churned'),
'testAccount',bool_or(custom_data->>'is_test_account'='true' or exists(select 1 from users u where u.id=t.linked_user_id and u.is_test_account=true))) controls
from t group by handle
), activity as (
select i.pid,count(*) filter(where direction='in') inbound,
count(distinct (m.created_at at time zone 'Australia/Brisbane')::date) filter(where direction='in') reply_days,
max(m.created_at) filter(where direction='in') latest
from identities i join ig_messages m on m.thread_id=any(i.tids)
where m.created_at>=now()-interval '30 days' and m.created_at<now()
and coalesce(m.source,'') not ilike '%reaction%' and lower(trim(coalesce(m.text,''))) not in ('','liked a message','liked your message','reacted to your message','seen','opened')
group by i.pid
), stories as (
select h.id,h.action_id,h.action_version,h.ig_username,h.thread_id,h.receipt,h.completed_at,
coalesce(nullif(h.receipt->>'observed_at','')::timestamptz,nullif(h.receipt->>'reviewed_at','')::timestamptz,h.completed_at) at
from ig_next_action_receipts h where action_type='story_reply' and receipt->>'story_id' ~ '^[0-9]+$'
and terminal_status='completed' and receipt->>'native_verified'='true'
and receipt->>'story_url'='https://www.instagram.com/stories/'||lower(h.ig_username)||'/'||(receipt->>'story_id')||'/'
and completed_at>=now()-interval '30 days' and completed_at<now()
)
select jsonb_build_object('asOf',now(),'window',jsonb_build_object('start',now()-interval '30 days','end',now()),
'outreachCandidates',(select jsonb_agg(jsonb_build_object('personId',i.pid,'handle',i.handle,'relationshipKind',i.kind,'controls',i.controls,'replyDays',a.reply_days,'inboundMessages',a.inbound,'lastReply',a.latest)) from identities i join activity a on a.pid=i.pid where a.inbound>0),
'contactProfiles',(select jsonb_agg(jsonb_build_object('personId',pid,'handle',handle,'relationshipKind',kind,'controls',controls,'identityVerified',true,'reviewId','canonical-exact-handle-snapshot-20261115')) from identities),
'storyObservations',(select jsonb_agg(jsonb_build_object('observationId','receipt:'||s.id,'personId',i.pid,'storyId',s.receipt->>'story_id','observedAt',s.at,'state','present','source','historical_action_receipt','evidenceRef','ig_next_action_receipts:'||s.id)) from stories s join identities i on i.handle=lower(s.ig_username)),
'ownContentInteractions',(
select coalesce(jsonb_agg(e),'[]'::jsonb) from (
 select jsonb_build_object('eventId','viewer:'||v.id,'handle',v.viewer_username,
 'contentKey','native-story:'||v.story_id,'contentType','story','at',v.observed_at,
 'kind','view','source','native_viewer_snapshot','evidenceRef','ig_story_viewer_observations:'||v.id,
 'storyLiked',v.viewer_data->'story_liked','likeEvidence',v.viewer_data->>'story_like_evidence',
 'contentDescription',coalesce(c.analysis_summary,s.boundary_evidence->>'story_description',s.boundary_evidence->>'caption'),
 'postedAt',s.story_published_at) e
 from ig_story_viewer_observations v join ig_story_viewer_snapshots s on s.id=v.snapshot_id
 left join lateral (select ci.analysis_summary from ig_content_items ci
   where ci.ig_story_id=v.story_id or ci.ig_media_id=v.story_id order by ci.created_at desc limit 1) c on true
 where v.ig_account='shan_n_sunny' and v.observed_at>=now()-interval '30 days' and v.observed_at<now()
 union all
 select jsonb_build_object('eventId','interaction:'||i.id,'handle',coalesce(i.from_username,t.ig_username),
 'contentKey','content-item:'||c.id,'contentType',c.content_type,'at',i.received_at,
 'kind',case when i.event_type='story_reply' then 'story_reply' else 'post_comment' end,
 'source','content_interaction','evidenceRef','ig_content_interactions:'||i.id,
 'contentDescription',c.analysis_summary,'postedAt',c.posted_at) e
 from ig_content_interactions i join ig_content_items c on c.id=i.content_item_id
 left join ig_threads t on t.id=i.ig_thread_id
 where i.event_type in ('story_reply','comment') and i.received_at>=now()-interval '30 days' and i.received_at<now()
 and (t.custom_data->>'bot_account'='shan_n_sunny'
   or i.raw_payload->'recipient'->>'id'='17841415641641750'
   or c.raw_payload->>'owner_ig_user_id'='17841415641641750')
) events),
'coverage','partial','historicalGaps',jsonb_build_array('Canonical metadata does not establish human authorship, current native identity or complete inbox coverage.','Historical Story action receipts establish observed presence only; receipt time is not publication time.'));
