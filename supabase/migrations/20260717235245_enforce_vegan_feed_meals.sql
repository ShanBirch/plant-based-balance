-- Balance is a vegan community. Keep animal products out of public meal cards,
-- while allowing clearly labelled plant-based alternatives such as coconut yoghurt.
create or replace function public.balance_vegan_feed_meal_is_safe(meal_text text)
returns boolean
language sql
immutable
set search_path = ''
as $$
    select regexp_replace(
        lower(coalesce(meal_text, '')),
        '\m(vegan|plant[ -]?based|dairy[ -]?free|non[ -]?dairy|coconut|soy|soya|oat|almond|cashew|hemp|pea|macadamia|rice)\s+(milk|cheese|yogh?urt|cream|ice cream|butter|egg(s)?)\M|\m(just egg|egg replacer|egg substitute)\M',
        ' ',
        'g'
    ) !~ '\m(egg(s)?|yogh?urt|milk|cheese|cheddar|parmesan|mozzarella|feta|halloumi|ricotta|paneer|dairy|whey|wpi|casein|honey|butter|cream|meat|beef|steak|veal|chicken|turkey|duck|pork|bacon|ham|lamb|mutton|fish|salmon|tuna|prawn(s)?|shrimp|cod|barramundi|sardine(s)?|anchovy|anchovies|gelatin|gelatine|collagen|bone broth|lard)\M'
$$;

revoke all on function public.balance_vegan_feed_meal_is_safe(text) from public, anon, authenticated;

create or replace function public.enforce_vegan_feed_meal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if (
        new.media_type = 'meal_card'
        or (
            new.media_type = 'nutrition_card'
            and coalesce(new.caption, '') ~* '"card_type"\s*:\s*"meal"'
        )
    ) and not public.balance_vegan_feed_meal_is_safe(new.caption) then
        raise exception using
            errcode = '23514',
            message = 'Only vegan meals can be shared to the Balance Feed.';
    end if;
    return new;
end;
$$;

revoke all on function public.enforce_vegan_feed_meal() from public, anon, authenticated;

drop trigger if exists enforce_vegan_feed_meal_trigger on public.stories;
create trigger enforce_vegan_feed_meal_trigger
before insert or update of media_type, caption on public.stories
for each row
execute function public.enforce_vegan_feed_meal();

-- Hide legacy animal-product meal cards without deleting member data.
update public.stories
set expires_at = least(expires_at, now()),
    updated_at = now()
where (
    media_type = 'meal_card'
    or (
        media_type = 'nutrition_card'
        and coalesce(caption, '') ~* '"card_type"\s*:\s*"meal"'
    )
)
and not public.balance_vegan_feed_meal_is_safe(caption);

notify pgrst, 'reload schema';
