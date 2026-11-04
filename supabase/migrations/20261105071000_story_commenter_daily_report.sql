create function public.story_commenter_daily_report(p_start date, p_end date)
returns table (send_date date, dms_sent bigint, people_replied bigint)
language sql stable security invoker
set search_path = ''
as $$
  with receipts as (
    select receipt from public.ig_next_actions
    where action_type = 'story_reply' and status = 'completed'
      and completed_at >= p_start::timestamp at time zone 'Australia/Brisbane'
    union all
    select receipt from public.ig_next_action_receipts
    where action_type = 'story_reply' and terminal_status = 'completed'
      and completed_at >= p_start::timestamp at time zone 'Australia/Brisbane'
  ), sent as (
    select distinct m.id, m.thread_id, m.created_at
    from receipts r
    join public.ig_messages m on m.id::text = r.receipt->>'canonical_outbound_message_id'
    where m.direction = 'out'
      and r.receipt->>'target_credit' = '1'
      and r.receipt->>'logical_base_id' like 'balance-story-scheduled-%'
  ), windows as (
    select thread_id, created_at,
      (created_at at time zone 'Australia/Brisbane')::date as local_date,
      lead(created_at) over (partition by thread_id order by created_at, id) as next_send
    from sent
  ), daily as (
    select w.local_date, count(*) as sent,
      count(distinct w.thread_id) filter (where exists (
        select 1 from public.ig_messages i
        where i.thread_id = w.thread_id and i.direction = 'in'
          and i.created_at > w.created_at
          and i.created_at < coalesce(w.next_send, 'infinity'::timestamptz)
      )) as replied
    from windows w
    where w.local_date between p_start and p_end
    group by w.local_date
  )
  select p_start + days.offset_days, coalesce(d.sent, 0), coalesce(d.replied, 0)
  from generate_series(0, p_end - p_start) as days(offset_days)
  left join daily d on d.local_date = p_start + days.offset_days
  order by 1;
$$;

revoke execute on function public.story_commenter_daily_report(date, date) from public, anon, authenticated;
grant execute on function public.story_commenter_daily_report(date, date) to service_role;

comment on function public.story_commenter_daily_report(date, date) is
  'Inclusive Brisbane send-date report. Deduplicates live and archived verified Story Commenter sends by message ID and counts distinct responding threads before the next verified Story send.';

