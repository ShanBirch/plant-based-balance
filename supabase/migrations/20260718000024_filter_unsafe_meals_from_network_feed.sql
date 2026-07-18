-- Feed posts have a one-year retention trigger, so hide legacy non-vegan meal
-- cards in the canonical network query instead of deleting member data.
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
      and (
          s.media_type <> 'meal_card'
          and not (
              s.media_type = 'nutrition_card'
              and coalesce(s.caption, '') ~* '"card_type"\s*:\s*"meal"'
          )
          or public.balance_vegan_feed_meal_is_safe(s.caption)
      )
    order by s.created_at desc;
end;
$$;

notify pgrst, 'reload schema';
