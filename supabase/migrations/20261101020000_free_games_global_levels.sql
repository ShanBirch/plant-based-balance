-- All new in-app games and challenges are free. Historical balances and results remain intact.
create or replace function public.my_balance_level_leaderboard()
returns table(user_id uuid,name text,profile_photo text,lifetime_points integer)
language sql stable security definer set search_path='' as $$
 select p.user_id,coalesce(nullif(u.name,''),'Balance member'),u.profile_photo,coalesce(p.lifetime_points,0)
 from public.user_points p join public.users u on u.id=p.user_id
 where auth.uid() is not null and not coalesce(u.is_test_account,false)
 order by coalesce(p.lifetime_points,0) desc,p.user_id limit 10;
$$;
revoke all on function public.my_balance_level_leaderboard() from public,anon;
grant execute on function public.my_balance_level_leaderboard() to authenticated;

create or replace function public.balance_free_game_entry()
returns trigger language plpgsql set search_path='' as $$
begin
 if TG_TABLE_NAME='challenges' then new.entry_fee:=0;else new.coin_bet:=0;end if;
 return new;
end $$;
drop trigger if exists balance_free_entry on public.game_matches;
create trigger balance_free_entry before insert on public.game_matches for each row execute function public.balance_free_game_entry();
drop trigger if exists balance_free_entry on public.quiz_battles;
create trigger balance_free_entry before insert on public.quiz_battles for each row execute function public.balance_free_game_entry();
drop trigger if exists balance_free_entry on public.tamagotchi_battles;
create trigger balance_free_entry before insert on public.tamagotchi_battles for each row execute function public.balance_free_game_entry();
drop trigger if exists balance_free_entry on public.challenges;
create trigger balance_free_entry before insert on public.challenges for each row execute function public.balance_free_game_entry();

CREATE OR REPLACE FUNCTION public.accept_game_challenge(p_match_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE match RECORD; new_bal INTEGER;
BEGIN

    IF auth.uid() IS DISTINCT FROM p_user_id AND coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Use your own account'; END IF;
    SELECT * INTO match FROM public.game_matches WHERE id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
    IF match.status != 'pending' THEN RETURN jsonb_build_object('error', 'not_pending'); END IF;
    IF match.opponent_id IS DISTINCT FROM p_user_id THEN RETURN jsonb_build_object('error','not_opponent'); END IF;
    UPDATE public.game_matches SET coin_bet=0, status = 'active', current_turn = match.challenger_id WHERE id = p_match_id;
    RETURN jsonb_build_object('success', true);
END;
$function$;


CREATE OR REPLACE FUNCTION public.create_game_challenge(p_challenger_id uuid, p_opponent_id uuid, p_game_type text, p_coin_bet integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE match_id UUID; new_bal INTEGER;
BEGIN
    p_coin_bet:=0;

    IF auth.uid() IS DISTINCT FROM p_challenger_id AND coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Use your own account'; END IF;
    INSERT INTO public.game_matches (challenger_id, opponent_id, game_type, coin_bet, current_turn, game_state)
    VALUES (p_challenger_id, p_opponent_id, p_game_type, p_coin_bet, p_challenger_id, '{"board": null}')
    RETURNING id INTO match_id;
    RETURN jsonb_build_object('success', true, 'match_id', match_id);
END;
$function$;


CREATE OR REPLACE FUNCTION public.create_quiz_battle(p_challenger_id uuid, p_opponent_id uuid, p_coin_bet integer DEFAULT 0, p_question_seed text DEFAULT '[]'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    battle_id UUID;
BEGIN
    p_coin_bet:=0;

    IF auth.uid() IS DISTINCT FROM p_challenger_id AND coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Use your own account'; END IF;
    INSERT INTO public.quiz_battles (challenger_id, opponent_id, coin_bet, question_seed)
    VALUES (p_challenger_id, p_opponent_id, p_coin_bet, p_question_seed)
    RETURNING id INTO battle_id;
    RETURN battle_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.create_tamagotchi_battle(p_challenger_id uuid, p_opponent_id uuid, p_coin_bet integer DEFAULT 0, p_challenger_stats jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    battle_id UUID;
BEGIN
    p_coin_bet:=0;

    IF auth.uid() IS DISTINCT FROM p_challenger_id AND coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Use your own account'; END IF;
    INSERT INTO public.tamagotchi_battles (challenger_id, opponent_id, coin_bet, challenger_stats)
    VALUES (p_challenger_id, p_opponent_id, p_coin_bet, p_challenger_stats)
    RETURNING id INTO battle_id;
    RETURN battle_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.create_wellness_challenge(p_name text, p_creator_id uuid, p_start_date date, p_end_date date, p_duration_days integer, p_challenge_type text, p_entry_fee integer, p_rare_reward_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_challenge_id UUID;
    v_new_balance INTEGER;
    v_current_points INTEGER;
BEGIN
    p_entry_fee:=0;

    IF auth.uid() IS DISTINCT FROM p_creator_id AND coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Use your own account'; END IF;
    v_new_balance:=public.get_coin_balance(p_creator_id);

    INSERT INTO public.challenges (
        name, creator_id, start_date, end_date, duration_days, status, entry_fee, challenge_type, rare_reward_id
    ) VALUES (
        p_name, p_creator_id, p_start_date, p_end_date, p_duration_days, 'pending', p_entry_fee, p_challenge_type, p_rare_reward_id
    ) RETURNING id INTO v_challenge_id;

    SELECT COALESCE(current_points, 0) INTO v_current_points
    FROM public.user_points WHERE user_id = p_creator_id;

    INSERT INTO public.challenge_participants (
        challenge_id, user_id, status, accepted_at, starting_points, current_points, challenge_points, has_paid, paid_at
    ) VALUES (
        v_challenge_id, p_creator_id, 'accepted', NOW(), v_current_points, v_current_points, 0, TRUE, NOW()
    );

    RETURN jsonb_build_object('success', true, 'challenge_id', v_challenge_id, 'new_balance', v_new_balance);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'internal_error', 'message', SQLERRM);
END;
$function$;


CREATE OR REPLACE FUNCTION public.join_quiz_battle(p_battle_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    battle RECORD;
BEGIN

    IF auth.uid() IS DISTINCT FROM p_user_id AND coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Use your own account'; END IF;
    SELECT * INTO battle FROM public.quiz_battles WHERE id = p_battle_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;
    IF battle.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'not_pending', 'status', battle.status);
    END IF;
    IF battle.opponent_id != p_user_id THEN
        RETURN jsonb_build_object('error', 'not_opponent');
    END IF;
    IF battle.expires_at < NOW() THEN
        UPDATE public.quiz_battles SET status = 'expired' WHERE id = p_battle_id;
        RETURN jsonb_build_object('error', 'expired');
    END IF;
    UPDATE public.quiz_battles
    SET coin_bet=0, status = 'active'
    WHERE id = p_battle_id;
    RETURN jsonb_build_object(
        'success', true,
        'battle_id', p_battle_id,
        'question_seed', battle.question_seed,
        'coin_bet', battle.coin_bet,
        'challenger_id', battle.challenger_id
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.join_tamagotchi_battle(p_battle_id uuid, p_user_id uuid, p_opponent_stats jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    battle RECORD;
BEGIN

    IF auth.uid() IS DISTINCT FROM p_user_id AND coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Use your own account'; END IF;
    SELECT * INTO battle FROM public.tamagotchi_battles WHERE id = p_battle_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;
    IF battle.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'not_pending', 'status', battle.status);
    END IF;
    IF battle.opponent_id != p_user_id THEN
        RETURN jsonb_build_object('error', 'not_opponent');
    END IF;
    IF battle.expires_at < NOW() THEN
        UPDATE public.tamagotchi_battles SET status = 'expired' WHERE id = p_battle_id;
        RETURN jsonb_build_object('error', 'expired');
    END IF;
    UPDATE public.tamagotchi_battles
    SET coin_bet=0, status = 'active', opponent_stats = p_opponent_stats
    WHERE id = p_battle_id;
    RETURN jsonb_build_object(
        'success', true,
        'battle_id', p_battle_id,
        'coin_bet', battle.coin_bet,
        'challenger_id', battle.challenger_id,
        'challenger_stats', battle.challenger_stats
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.join_wellness_challenge(p_challenge_id uuid, p_user_id uuid, p_weight_goal text DEFAULT 'lose'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_entry_fee        INTEGER;
    v_new_balance      INTEGER;
    v_current_points   INTEGER;
    v_challenge_status TEXT;
    v_user_status      TEXT;
BEGIN

    IF auth.uid() IS DISTINCT FROM p_user_id AND coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Use your own account'; END IF;
    RAISE NOTICE '[JoinChallenge] Starting for user % in challenge %', p_user_id, p_challenge_id;

    -- 1. Verify challenge status
    SELECT status, entry_fee INTO v_challenge_status, v_entry_fee
    FROM public.challenges WHERE id = p_challenge_id;

    IF v_challenge_status NOT IN ('pending', 'active') THEN
        RETURN jsonb_build_object('error', 'invalid_status', 'message', 'This challenge is no longer accepting participants');
    END IF;

    SELECT status INTO v_user_status
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    IF v_user_status = 'accepted' THEN
        RETURN jsonb_build_object('error', 'already_joined', 'message', 'You have already joined this challenge');
    END IF;

    -- 2. Debit coins
    v_new_balance:=public.get_coin_balance(p_user_id);

    -- 3. Get user's current points
    SELECT COALESCE(current_points, 0) INTO v_current_points
    FROM public.user_points
    WHERE user_id = p_user_id;

    -- 4. Upsert participant record (with weight_goal)
    INSERT INTO public.challenge_participants (
        challenge_id, user_id, status, accepted_at,
        starting_points, current_points, challenge_points,
        has_paid, paid_at, weight_goal
    ) VALUES (
        p_challenge_id, p_user_id, 'accepted', NOW(),
        v_current_points, v_current_points, 0,
        TRUE, NOW(),
        COALESCE(p_weight_goal, 'lose')
    )
    ON CONFLICT (challenge_id, user_id) DO UPDATE
    SET
        status          = 'accepted',
        accepted_at     = NOW(),
        starting_points = v_current_points,
        current_points  = v_current_points,
        challenge_points = 0,
        has_paid        = TRUE,
        paid_at         = NOW(),
        weight_goal     = COALESCE(p_weight_goal, 'lose');

    -- 5. Auto-start challenge if 2+ participants
    IF v_challenge_status = 'pending' THEN
        PERFORM public.start_challenge(p_challenge_id);
    END IF;
    RAISE NOTICE '[JoinChallenge] Success. New Balance: %', v_new_balance;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[JoinChallenge] CRITICAL ERROR: %', SQLERRM;
    RETURN jsonb_build_object('error', 'internal_error', 'message', SQLERRM);
END;
$function$;

-- Cached app versions may still call the old entry-charge helper directly.
-- Preserve other coin uses and all historical transaction records.
do $$ declare definition text; begin
 select pg_get_functiondef('public.debit_coins(uuid,integer,text,text,text)'::regprocedure) into definition;
 if position('balance_free_game_entry_guard' in definition)=0 then
  if position('-- Check sufficient balance' in definition)=0 then raise exception 'Expected debit guard location missing'; end if;
  definition:=replace(definition,'-- Check sufficient balance',
   '-- balance_free_game_entry_guard
    IF txn_type IN (''game_bet'',''battle_bet'',''challenge_entry'') THEN RETURN COALESCE(current_bal,0); END IF;
    -- Check sufficient balance');
  execute definition;
 end if;
end $$;
