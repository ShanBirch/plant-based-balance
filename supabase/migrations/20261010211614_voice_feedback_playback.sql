-- Coverage comes from contiguous playback, never read receipts or currentTime alone.
create schema if not exists voice_feedback_internal;
revoke all on schema voice_feedback_internal from public, anon;
grant usage on schema voice_feedback_internal to authenticated;

create table public.voice_feedback_playback (
  message_id uuid not null references public.nudges(id) on delete cascade,
  audio_url text not null,
  recipient_id uuid not null references public.users(id),
  duration_seconds numeric not null check (duration_seconds > 0 and duration_seconds <= 14400),
  played_ranges nummultirange not null default '{}'::nummultirange,
  listened_seconds numeric not null default 0,
  started_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (message_id, audio_url)
);
alter table public.voice_feedback_playback enable row level security;
revoke all on public.voice_feedback_playback from public, anon, authenticated;
grant select on public.voice_feedback_playback to authenticated;
grant all on public.voice_feedback_playback to service_role;
create policy "Participants read playback receipts" on public.voice_feedback_playback
  for select to authenticated using (exists (
    select 1 from public.nudges n where n.id=message_id
      and (n.sender_id=(select auth.uid()) or n.receiver_id=(select auth.uid()))
  ));
create index voice_feedback_playback_recipient_idx on public.voice_feedback_playback(recipient_id);

-- Definer internals are outside the exposed API schema. Only these routines may write receipts.
create function voice_feedback_internal.record_playback(
  p_message_id uuid, p_audio_url text, p_duration numeric, p_ranges jsonb, p_ended boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_message public.nudges; v_ranges nummultirange;
  v_row public.voice_feedback_playback; v_seconds numeric;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_message from public.nudges where id=p_message_id;
  if not found or v_message.receiver_id<>v_user or v_message.sender_id=v_user then
    raise exception 'Only the recipient may record playback' using errcode='42501';
  end if;
  if p_audio_url is distinct from (regexp_match(v_message.message,'\[AUDIO:(https?://[^\s\]]+)\]','i'))[1] then
    raise exception 'Audio does not match message' using errcode='22023';
  end if;
  if p_duration is null or p_duration<=0 or p_duration>14400 or p_duration::text in ('NaN','Infinity','-Infinity')
    or jsonb_typeof(p_ranges) is distinct from 'array' then
    raise exception 'Invalid playback data' using errcode='22023';
  end if;
  if jsonb_array_length(p_ranges)>200 then raise exception 'Too many segments' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_ranges) r where jsonb_typeof(r)<>'array' or jsonb_array_length(r)<>2
    or jsonb_typeof(r->0) is distinct from 'number' or jsonb_typeof(r->1) is distinct from 'number'
    or (r->>0)::numeric<0 or (r->>1)::numeric>(p_duration+0.5) or (r->>1)::numeric<=(r->>0)::numeric
    or (r->>1)::numeric-(r->>0)::numeric>30
    or (r->>0)::numeric::text in ('NaN','Infinity','-Infinity') or (r->>1)::numeric::text in ('NaN','Infinity','-Infinity')) then
    raise exception 'Invalid played segment' using errcode='22023';
  end if;
  select coalesce(range_agg(numrange((r->>0)::numeric,least((r->>1)::numeric,p_duration),'[)')), '{}'::nummultirange)
    into v_ranges from jsonb_array_elements(p_ranges) r;
  insert into public.voice_feedback_playback(message_id,audio_url,recipient_id,duration_seconds,played_ranges)
    values(p_message_id,p_audio_url,v_user,p_duration,v_ranges)
    on conflict(message_id,audio_url) do update set
      played_ranges=voice_feedback_playback.played_ranges + excluded.played_ranges,
      last_played_at=now()
    returning * into v_row;
  -- Retain the first measured duration across resumes; reject an unrelated/replaced media duration.
  if abs(v_row.duration_seconds-p_duration)>1 then raise exception 'Audio duration changed' using errcode='22023'; end if;
  select coalesce(sum(upper(r)-lower(r)),0) into v_seconds from unnest(v_row.played_ranges) r;
  update public.voice_feedback_playback set listened_seconds=least(v_seconds,duration_seconds),
    completed_at=case when p_ended and v_seconds>=duration_seconds*0.95 then coalesce(completed_at,now()) else completed_at end
    where message_id=p_message_id and audio_url=p_audio_url;
end $$;
revoke all on function voice_feedback_internal.record_playback(uuid,text,numeric,jsonb,boolean) from public,anon;
grant execute on function voice_feedback_internal.record_playback(uuid,text,numeric,jsonb,boolean) to authenticated;
create function public.record_voice_feedback_playback(p_message_id uuid,p_audio_url text,p_duration numeric,p_ranges jsonb default '[]',p_ended boolean default false)
returns void language sql security invoker set search_path='' as $$
  select voice_feedback_internal.record_playback(p_message_id,p_audio_url,p_duration,p_ranges,p_ended);
$$;
revoke all on function public.record_voice_feedback_playback(uuid,text,numeric,jsonb,boolean) from public,anon;
grant execute on function public.record_voice_feedback_playback(uuid,text,numeric,jsonb,boolean) to authenticated;

create function voice_feedback_internal.get_playback(p_recipient_id uuid)
returns table(message_id uuid,label text,sent_at timestamptz,read_at timestamptz,started_at timestamptz,last_played_at timestamptz,
  completed_at timestamptz,duration_seconds numeric,listened_seconds numeric)
language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_admin boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select exists(select 1 from public.admin_users where user_id=v_user) into v_admin;
  return query select n.id,trim(regexp_replace(n.message,'\[AUDIO:https?://[^\s\]]+\]','','gi')),n.created_at,n.read_at,
    p.started_at,p.last_played_at,p.completed_at,p.duration_seconds,p.listened_seconds
  from public.nudges n
  left join public.voice_feedback_playback p on p.message_id=n.id
    and p.audio_url=(regexp_match(n.message,'\[AUDIO:(https?://[^\s\]]+)\]','i'))[1]
  where n.receiver_id=p_recipient_id and n.message ~* '\[AUDIO:https?://' and n.sender_id<>n.receiver_id
    and (v_admin or n.sender_id=v_user or n.receiver_id=v_user)
  order by n.created_at desc limit 50;
end $$;
revoke all on function voice_feedback_internal.get_playback(uuid) from public,anon;
grant execute on function voice_feedback_internal.get_playback(uuid) to authenticated;
create function public.get_voice_feedback_playback(p_recipient_id uuid)
returns table(message_id uuid,label text,sent_at timestamptz,read_at timestamptz,started_at timestamptz,last_played_at timestamptz,
  completed_at timestamptz,duration_seconds numeric,listened_seconds numeric)
language sql security invoker set search_path='' as $$ select * from voice_feedback_internal.get_playback(p_recipient_id); $$;
revoke all on function public.get_voice_feedback_playback(uuid) from public,anon;
grant execute on function public.get_voice_feedback_playback(uuid) to authenticated;
