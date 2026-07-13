-- One current engagement state for every Instagram/Messenger conversation.
--
-- A lead becomes dead after four outbound messages without an inbound reply.
-- The count only considers the latest 30 days, so the state naturally resets
-- to cold after the 30-day cool-down rather than permanently re-deading them.
-- This view intentionally has no anon/authenticated grants. Server functions
-- use the service role and admin UI data is returned through an authenticated
-- Netlify function.

create or replace view public.ig_thread_engagement_snapshot
with (security_invoker = true) as
with message_times as (
    select
        m.thread_id,
        max(m.created_at) filter (where lower(m.direction) = 'in') as message_last_inbound_at,
        max(m.created_at) filter (where lower(m.direction) = 'out') as message_last_outbound_at,
        max(m.created_at) filter (
            where lower(m.direction) = 'in'
                and coalesce(lower(m.source), '') not like '%reaction%'
                and lower(trim(coalesce(m.text, ''))) not in (
                    '', 'liked a message', 'liked your message',
                    'reacted to your message', 'seen', 'opened'
                )
        ) as last_meaningful_inbound_at
    from public.ig_messages m
    group by m.thread_id
), base_threads as (
    select
        t.id as thread_id,
        t.coach_id,
        t.subscriber_id,
        t.channel,
        t.ig_username,
        t.profile_name,
        t.lead_stage,
        t.linked_user_id,
        t.qualifier,
        case
            when mt.message_last_inbound_at is null then t.last_inbound_at
            when t.last_inbound_at is null then mt.message_last_inbound_at
            else greatest(t.last_inbound_at, mt.message_last_inbound_at)
        end as last_inbound_at,
        case
            when mt.message_last_outbound_at is null then t.last_outbound_at
            when t.last_outbound_at is null then mt.message_last_outbound_at
            else greatest(t.last_outbound_at, mt.message_last_outbound_at)
        end as last_outbound_at,
        mt.last_meaningful_inbound_at,
        coalesce(u.is_test_account, false) as is_test_account,
        coalesce(t.custom_data ->> 'merged_into_thread_id', '') <> ''
            or coalesce(t.custom_data ->> 'merged_into_ig_thread_id', '') <> '' as is_merged,
        exists (
            select 1
            from public.coach_clients cc
            where cc.client_id = t.linked_user_id
                and coalesce(cc.status, 'active') = 'active'
        ) as has_active_coach_assignment,
        exists (
            select 1
            from public.coach_alerts ca
            where ca.status in ('pending', 'scheduled')
                and ca.data ->> 'ig_thread_id' = t.id::text
                and (
                    lower(coalesce(ca.alert_type, '')) in (
                        'incoming_dm', 'ig_incoming_dm', 'fb_incoming_dm',
                        'unread_message', 'follow_up_review', 'dm_follow_up',
                        'ig_follow_up', 'fb_follow_up'
                    )
                    or coalesce(ca.data ->> 'reply_required', 'false') = 'true'
                    or coalesce(ca.data ->> 'needs_reply', 'false') = 'true'
                    or coalesce(ca.data ->> 'open_dm_needs_reply', 'false') = 'true'
                )
        ) as has_pending_dm_reply
    from public.ig_threads t
    left join message_times mt on mt.thread_id = t.id
    left join public.users u on u.id = t.linked_user_id
), engagement_inputs as (
    select
        b.*,
        count(m.id) filter (
            where lower(m.direction) = 'out'
                and m.created_at >= now() - interval '30 days'
                and m.created_at > coalesce(b.last_inbound_at, 'epoch'::timestamptz)
        )::integer as unanswered_outbound_count,
        case
            when coalesce(b.qualifier ->> 'warmth_score', '') ~ '^-?[0-9]+(?:\\.[0-9]+)?$'
                then (b.qualifier ->> 'warmth_score')::numeric
            else 0
        end as qualifier_warmth_score,
        lower(coalesce(b.qualifier ->> 'warmth_label', '')) as qualifier_warmth_label
    from base_threads b
    left join public.ig_messages m on m.thread_id = b.thread_id
    group by
        b.thread_id, b.coach_id, b.subscriber_id, b.channel, b.ig_username,
        b.profile_name, b.lead_stage, b.linked_user_id, b.qualifier,
        b.last_inbound_at, b.last_outbound_at, b.last_meaningful_inbound_at,
        b.is_test_account, b.is_merged, b.has_active_coach_assignment,
        b.has_pending_dm_reply
), classified as (
    select
        e.*,
        case
            when e.linked_user_id is not null
                or e.has_active_coach_assignment
                or e.lead_stage in ('in_app', 'paying') then 'client'
            else 'lead'
        end as relationship_kind,
        case
            when e.last_meaningful_inbound_at is not null
                and e.last_meaningful_inbound_at > coalesce(e.last_outbound_at, 'epoch'::timestamptz)
                and e.last_meaningful_inbound_at >= now() - interval '7 days'
                then true
            else false
        end as open_dm_needs_reply
    from engagement_inputs e
), temperatured as (
    select
        c.*,
        case
            when c.relationship_kind = 'client' then 'client'
            when c.lead_stage = 'churned' then 'dead'
            when c.unanswered_outbound_count >= 4
                and c.last_outbound_at >= now() - interval '30 days' then 'dead'
            when c.last_inbound_at >= now() - interval '7 days' then 'hot'
            when c.last_inbound_at >= now() - interval '30 days'
                or c.qualifier_warmth_label in ('hot', 'warm')
                or c.qualifier_warmth_score >= 70
                or c.lead_stage = 'invited' then 'warm'
            else 'cold'
        end as engagement_temperature,
        case
            when c.unanswered_outbound_count >= 4
                and c.last_outbound_at >= now() - interval '30 days'
                then c.last_outbound_at + interval '30 days'
            else null
        end as dead_until
    from classified c
), prioritised as (
    select
        t.*,
        case
            when t.relationship_kind = 'client' then 'Linked Balance client'
            when t.lead_stage = 'churned' then 'Lead marked churned'
            when t.engagement_temperature = 'dead' then
                format('%s unanswered outbound messages, 30-day cool-down', t.unanswered_outbound_count)
            when t.engagement_temperature = 'hot' then 'Replied in the last 7 days'
            when t.engagement_temperature = 'warm' and t.last_inbound_at >= now() - interval '30 days'
                then 'Replied in the last 30 days'
            when t.engagement_temperature = 'warm' then 'Qualifier signals an interested lead'
            else 'No reply signal in the last 30 days'
        end as engagement_reason,
        (
            case t.engagement_temperature
                when 'hot' then 100
                when 'warm' then 60
                when 'cold' then 25
                else 0
            end
            + least(greatest(t.qualifier_warmth_score, 0), 30)::integer
            + case t.lead_stage when 'invited' then 15 when 'qualifying' then 5 else 0 end
            + case
                when t.last_inbound_at >= now() - interval '1 day' then 20
                when t.last_inbound_at >= now() - interval '7 days' then 10
                when t.last_inbound_at >= now() - interval '30 days' then 5
                else 0
            end
        )::integer as priority_score
    from temperatured t
), ready as (
    select
        p.*,
        case
            when p.is_test_account then 'test_account'
            when p.is_merged then 'merged_thread'
            when p.relationship_kind = 'client' then 'client'
            when p.lead_stage = 'churned' then 'churned'
            when p.engagement_temperature = 'dead' then 'dead_cooldown'
            when p.channel <> 'instagram' then 'not_instagram'
            when coalesce(trim(p.ig_username), '') = '' then 'missing_instagram_handle'
            when p.has_pending_dm_reply or p.open_dm_needs_reply then 'pending_dm_reply'
            when p.last_outbound_at >= now() - interval '20 hours' then 'recent_outreach'
            else null
        end as story_outreach_block_reason
    from prioritised p
)
select
    thread_id,
    coach_id,
    subscriber_id,
    channel,
    ig_username,
    profile_name,
    lead_stage,
    linked_user_id,
    qualifier,
    last_inbound_at,
    last_outbound_at,
    relationship_kind,
    engagement_temperature,
    case when relationship_kind = 'client' then 'client' else engagement_temperature end as engagement_label,
    engagement_reason,
    priority_score,
    unanswered_outbound_count,
    dead_until,
    has_pending_dm_reply,
    open_dm_needs_reply,
    is_test_account,
    is_merged,
    story_outreach_block_reason,
    story_outreach_block_reason is null as story_outreach_eligible
from ready;

revoke all on table public.ig_thread_engagement_snapshot from public, anon, authenticated;
