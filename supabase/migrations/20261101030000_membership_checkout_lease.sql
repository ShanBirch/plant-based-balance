create table if not exists public.coaching_checkout_intents(user_id uuid primary key references auth.users(id),session_id text,lease uuid,lease_until timestamptz);
alter table public.coaching_checkout_intents enable row level security;
revoke all on public.coaching_checkout_intents from public,anon,authenticated;
grant all on public.coaching_checkout_intents to service_role;
create or replace function public.claim_coaching_checkout(p_user_id uuid,p_lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.coaching_checkout_intents;
begin
 insert into public.coaching_checkout_intents(user_id) values(p_user_id) on conflict do nothing;
 select * into row from public.coaching_checkout_intents where user_id=p_user_id for update;
 if row.lease_until>now() then return jsonb_build_object('claimed',false);end if;
 update public.coaching_checkout_intents set lease=p_lease,lease_until=now()+interval '2 minutes' where user_id=p_user_id;
 return jsonb_build_object('claimed',true,'session_id',row.session_id);
end $$;
create or replace function public.finish_coaching_checkout(p_user_id uuid,p_lease uuid,p_session_id text) returns void language sql security definer set search_path='' as $$
 update public.coaching_checkout_intents set session_id=coalesce(p_session_id,session_id),lease=null,lease_until=null where user_id=p_user_id and lease=p_lease;
$$;
revoke all on function public.claim_coaching_checkout(uuid,uuid),public.finish_coaching_checkout(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_coaching_checkout(uuid,uuid),public.finish_coaching_checkout(uuid,uuid,text) to service_role;
do $$ declare definition text; begin
 select pg_get_functiondef('public.my_balance_courses_locked()'::regprocedure) into definition;
 definition:=replace(definition,'''standard_text_coaching_weekly'',''organic_coaching_continuation_weekly''','''standard_text_coaching_weekly'',''standard_voice_coaching_weekly'',''standard_zoom_coaching_weekly'',''organic_coaching_continuation_weekly''');
 execute definition;
end $$;
