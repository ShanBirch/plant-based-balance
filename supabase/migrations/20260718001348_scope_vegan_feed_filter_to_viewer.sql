-- The Feed diet filter is viewer-specific in the client. Restore the canonical
-- Feed query for everyone and remove the global posting restriction.
drop trigger if exists enforce_vegan_feed_meal_trigger on public.stories;
drop function if exists public.enforce_vegan_feed_meal();

create or replace function public.get_network_active_stories(user_uuid uuid)
returns table(
    story_id uuid,
    user_id uuid,
    user_name text,
    user_email text,
    profile_photo text,
    media_type text,
    media_url text,
    thumbnail_url text,
    caption text,
    duration integer,
    background_color text,
    view_count integer,
    created_at timestamp with time zone,
    expires_at timestamp with time zone,
    has_viewed boolean,
    story_count integer
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
    return query
    select
        s.id as story_id,
        s.user_id,
        u.name as user_name,
        u.email as user_email,
        u.profile_photo,
        s.media_type,
        s.media_url,
        s.thumbnail_url,
        s.caption,
        s.duration,
        s.background_color,
        s.view_count,
        s.created_at,
        s.expires_at,
        (
            s.user_id = user_uuid
            or exists (
                select 1
                from public.story_views sv
                where sv.story_id = s.id
                  and sv.viewer_id = user_uuid
            )
        ) as has_viewed,
        count(*) over (partition by s.user_id)::integer as story_count
    from public.stories s
    join public.users u on u.id = s.user_id
    where s.expires_at > now()
      and (
          coalesce(u.is_test_account, false) = false
          or s.user_id = user_uuid
      )
    order by s.created_at desc;
end;
$$;

drop function if exists public.balance_vegan_feed_meal_is_safe(text);

notify pgrst, 'reload schema';
