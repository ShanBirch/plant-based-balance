create table public.meal_shop_invitations (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique,
 user_id uuid not null references auth.users(id), plan_id uuid not null references ai_generated_meal_plans(id),
 thread_id uuid not null references ig_threads(id), coach_id uuid not null,
 expires_at timestamptz not null, shop_at timestamptz, follow_up_at timestamptz,
 alert_id uuid references coach_alerts(id), created_at timestamptz not null default now()
);
alter table public.meal_shop_invitations enable row level security;
create or replace function public.save_meal_shop(p_token_hash text,p_shop_at timestamptz,p_follow_up_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare invite meal_shop_invitations; thread ig_threads; alert uuid; notice uuid;
begin
 select * into invite from meal_shop_invitations where token_hash=p_token_hash and expires_at>now() for update;
 if invite.id is null then raise exception 'Invitation expired'; end if;
 select * into thread from ig_threads where id=invite.thread_id and linked_user_id=invite.user_id and channel='messenger';
 if thread.id is null then raise exception 'Facebook connection unavailable'; end if;
 if p_shop_at<now() or p_shop_at>now()+interval '90 days' or p_follow_up_at<=p_shop_at
 or (p_follow_up_at at time zone 'Australia/Brisbane')::date<>(p_shop_at at time zone 'Australia/Brisbane')::date then raise exception 'Invalid shopping time'; end if;
 if invite.alert_id is not null then
 update coach_alerts set scheduled_for=p_follow_up_at,description='Shopping planned for '||(p_shop_at at time zone 'Australia/Brisbane')::text,data=data||jsonb_build_object('shop_at',p_shop_at) where id=invite.alert_id and status='scheduled' returning id into alert;
 if alert is null then raise exception 'This follow-up is already being handled. Contact Shannon to change it.'; end if;
 else
 insert into coach_alerts(coach_id,client_id,client_name,alert_type,priority,status,title,description,suggested_message,scheduled_reply_text,scheduled_for,scheduled_at,idempotency_key,data)
 values(invite.coach_id,invite.user_id,'Jennie','fb_incoming_dm','medium','scheduled','First meal shop: evening check-in','Shopping planned for '||(p_shop_at at time zone 'Australia/Brisbane')::text,'Hey, how did you go with your shop?','Hey, how did you go with your shop?',p_follow_up_at,now(),'meal_shop_followup:'||invite.id,
 jsonb_build_object('channel','messenger','ig_thread_id',thread.id,'subscriber_id',thread.subscriber_id,'scheduled_via','send_later','outbound_voice_message',false,'shop_at',p_shop_at,'shopping_followup',true,'approval_source','Shannon explicit request: first shop evening check-in, 8 October 2026')) returning id into alert;
 end if;
 select id into notice from coach_alerts where idempotency_key='meal_shop_notice:'||invite.id limit 1;
 if notice is not null then
 update coach_alerts set description='Shopping: '||(p_shop_at at time zone 'Australia/Brisbane')::text||'. Evening Facebook check-in scheduled.',data=data||jsonb_build_object('shop_at',p_shop_at,'follow_up_at',p_follow_up_at) where id=notice;
 else
 insert into coach_alerts(coach_id,client_id,client_name,alert_type,priority,status,title,description,idempotency_key,data)
 values(invite.coach_id,invite.user_id,'Jennie','follow_up_review','medium','pending','Jennie planned her first meal shop','Shopping: '||(p_shop_at at time zone 'Australia/Brisbane')::text||'. Evening Facebook check-in scheduled.','meal_shop_notice:'||invite.id,jsonb_build_object('shopping_booking',true,'shop_at',p_shop_at,'follow_up_at',p_follow_up_at))
;
 end if;
 update meal_shop_invitations set shop_at=p_shop_at,follow_up_at=p_follow_up_at,alert_id=alert where id=invite.id;
 return jsonb_build_object('saved',true,'shop_at',p_shop_at,'follow_up_at',p_follow_up_at);
end $$;
revoke all on function public.save_meal_shop(text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.save_meal_shop(text,timestamptz,timestamptz) to service_role;
