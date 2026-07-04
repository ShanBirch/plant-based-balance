-- Feed Reactions Migration
-- Allows users to react to feed posts (stories) with reaction types such as love, muscle, fire, clap, and wow.

create table if not exists public.feed_reactions (
    id uuid primary key default gen_random_uuid(),
    story_id uuid not null references public.stories(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    reaction varchar(20) not null check (reaction in ('love', 'muscle', 'fire', 'clap', 'wow')),
    created_at timestamptz not null default now(),
    unique (story_id, user_id)
);

create index if not exists idx_feed_reactions_story_id on public.feed_reactions(story_id);
create index if not exists idx_feed_reactions_user_id on public.feed_reactions(user_id);
create index if not exists idx_feed_reactions_created_at on public.feed_reactions(created_at desc);

alter table public.feed_reactions enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'feed_reactions'
          and policyname = 'Users can view feed reactions'
    ) then
        create policy "Users can view feed reactions"
            on public.feed_reactions
            for select
            to authenticated
            using (true);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'feed_reactions'
          and policyname = 'Users can create their own reactions'
    ) then
        create policy "Users can create their own reactions"
            on public.feed_reactions
            for insert
            to authenticated
            with check ((select auth.uid()) = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'feed_reactions'
          and policyname = 'Users can update their own reactions'
    ) then
        create policy "Users can update their own reactions"
            on public.feed_reactions
            for update
            to authenticated
            using ((select auth.uid()) = user_id)
            with check ((select auth.uid()) = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'feed_reactions'
          and policyname = 'Users can delete their own reactions'
    ) then
        create policy "Users can delete their own reactions"
            on public.feed_reactions
            for delete
            to authenticated
            using ((select auth.uid()) = user_id);
    end if;
end $$;

grant select on public.feed_reactions to authenticated;
grant insert, update, delete on public.feed_reactions to authenticated;

create or replace function public.get_story_reactions(story_uuid uuid)
returns table(reaction varchar, count bigint, reacted_by_me boolean)
language sql
stable
security invoker
set search_path = public
as $$
    select
        fr.reaction,
        count(*)::bigint as count,
        bool_or(fr.user_id = auth.uid()) as reacted_by_me
    from public.feed_reactions fr
    where fr.story_id = story_uuid
    group by fr.reaction
    order by count(*) desc;
$$;

create or replace function public.toggle_feed_reaction(p_story_id uuid, p_user_id uuid, p_reaction varchar)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
    existing_reaction varchar;
begin
    if auth.uid() is null or auth.uid() <> p_user_id then
        raise exception 'not allowed' using errcode = '42501';
    end if;

    if p_reaction not in ('love', 'muscle', 'fire', 'clap', 'wow') then
        raise exception 'invalid reaction' using errcode = '22023';
    end if;

    select fr.reaction into existing_reaction
    from public.feed_reactions fr
    where fr.story_id = p_story_id
      and fr.user_id = p_user_id;

    if existing_reaction is not null then
        if existing_reaction = p_reaction then
            delete from public.feed_reactions
            where story_id = p_story_id
              and user_id = p_user_id;
            return json_build_object('action', 'removed', 'reaction', p_reaction);
        end if;

        update public.feed_reactions
        set reaction = p_reaction,
            created_at = now()
        where story_id = p_story_id
          and user_id = p_user_id;
        return json_build_object('action', 'updated', 'reaction', p_reaction);
    end if;

    insert into public.feed_reactions (story_id, user_id, reaction)
    values (p_story_id, p_user_id, p_reaction);
    return json_build_object('action', 'added', 'reaction', p_reaction);
end;
$$;

revoke all on function public.get_story_reactions(uuid) from public;
revoke all on function public.toggle_feed_reaction(uuid, uuid, varchar) from public;
grant execute on function public.get_story_reactions(uuid) to authenticated;
grant execute on function public.toggle_feed_reaction(uuid, uuid, varchar) to authenticated;
